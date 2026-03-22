use alloy::primitives::{FixedBytes, U256};
use alloy::signers::{local::PrivateKeySigner, SignerSync};
use alloy::sol;
use alloy::sol_types::SolStruct;
use alloy::sol_types::eip712_domain;
use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use dstack_sdk::dstack_client::DstackClient;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::{error, info, warn};

// EIP-712 typed struct matching TEEOracle.sol
sol! {
    #[derive(Serialize, Deserialize)]
    struct MilestoneAttestation {
        uint256 grantId;
        uint256 milestoneIndex;
        bytes32 gitCommitHash;
        bool verified;
        uint256 timestamp;
    }
}

#[derive(Clone)]
struct AppState {
    signer: PrivateKeySigner,
    dstack: Arc<DstackClient>,
    tee_enabled: bool,
}

#[derive(Deserialize)]
struct VerifyRequest {
    grant_id: u64,
    milestone_index: u64,
    repo_owner: String,
    repo_name: String,
    commit_hash: String,
    expected_prefix: Option<String>,
    demo_url: Option<String>,
    live_url: Option<String>,
}

#[derive(Serialize)]
struct VerifyResponse {
    attestation: AttestationData,
    signature: String,
    signer: String,
    tee_quote: Option<String>,
}

#[derive(Serialize)]
struct AttestationData {
    grant_id: String,
    milestone_index: String,
    git_commit_hash: String,
    verified: bool,
    timestamp: String,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    signer: String,
    tee_enabled: bool,
    tee_info: Option<serde_json::Value>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    dotenv::dotenv().ok();

    // Try to derive key from dstack TEE, fall back to env var
    let dstack = Arc::new(DstackClient::new(None));
    let (signer, tee_enabled) = match dstack.get_key(Some("supafund-signer".to_string()), None).await {
        Ok(key_resp) => {
            info!("TEE key derived via dstack CVM");
            let signer: PrivateKeySigner = key_resp.key
                .parse()
                .expect("Failed to parse TEE-derived key");
            (signer, true)
        }
        Err(e) => {
            warn!("dstack unavailable ({}), falling back to TEE_PRIVATE_KEY env", e);
            let private_key = std::env::var("TEE_PRIVATE_KEY")
                .expect("TEE_PRIVATE_KEY must be set when running outside TEE");
            let signer: PrivateKeySigner = private_key
                .parse()
                .expect("Invalid private key");
            (signer, false)
        }
    };

    info!("TEE Agent signer address: {:?}", signer.address());
    info!("TEE hardware attestation: {}", if tee_enabled { "ENABLED (Phala dstack CVM)" } else { "DISABLED (dev mode)" });

    let state = Arc::new(AppState {
        signer,
        dstack,
        tee_enabled,
    });

    let app = Router::new()
        .route("/health", axum::routing::get(health))
        .route("/verify", post(verify_milestone))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = "0.0.0.0:3001";
    info!("TEE Agent listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    let tee_info = if state.tee_enabled {
        match state.dstack.info().await {
            Ok(info) => Some(serde_json::to_value(info).unwrap_or_default()),
            Err(_) => None,
        }
    } else {
        None
    };

    Json(HealthResponse {
        status: "ok".to_string(),
        signer: format!("{:?}", state.signer.address()),
        tee_enabled: state.tee_enabled,
        tee_info,
    })
}

async fn verify_milestone(
    State(state): State<Arc<AppState>>,
    Json(req): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, (StatusCode, String)> {
    info!(
        "Verifying grant={} milestone={} commit={}",
        req.grant_id, req.milestone_index, req.commit_hash
    );

    // 1. Verify the commit exists on GitHub (public repos, no token needed)
    let commit_exists = check_github_commit(
        &req.repo_owner,
        &req.repo_name,
        &req.commit_hash,
    )
    .await
    .map_err(|e| {
        error!("GitHub check failed: {}", e);
        (StatusCode::BAD_GATEWAY, format!("GitHub check failed: {}", e))
    })?;

    if !commit_exists {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            "Commit not found in repository".to_string(),
        ));
    }
    info!("Commit verified on GitHub (repo: {}/{})", req.repo_owner, req.repo_name);

    // 1b. Verify commit hash matches the expected prefix from the grant
    if let Some(ref prefix) = req.expected_prefix {
        let prefix_clean = prefix.trim_end_matches('0').to_lowercase();
        if !prefix_clean.is_empty() && !req.commit_hash.to_lowercase().starts_with(&prefix_clean) {
            return Err((
                StatusCode::UNPROCESSABLE_ENTITY,
                format!(
                    "Commit hash does not match required prefix. Expected: {}..., Got: {}",
                    prefix_clean, &req.commit_hash
                ),
            ));
        }
        info!("Commit prefix matched: {}", prefix_clean);
    }

    // 2. Verify URLs are reachable (if provided)
    if let Some(ref url) = req.demo_url {
        check_url_reachable(url).await.map_err(|e| {
            (StatusCode::UNPROCESSABLE_ENTITY, format!("Demo URL unreachable: {}", e))
        })?;
        info!("Demo URL verified: {}", url);
    }

    if let Some(ref url) = req.live_url {
        check_url_reachable(url).await.map_err(|e| {
            (StatusCode::UNPROCESSABLE_ENTITY, format!("Live URL unreachable: {}", e))
        })?;
        info!("Live URL verified: {}", url);
    }

    // 3. Build the attestation
    let commit_bytes = hex::decode(req.commit_hash.strip_prefix("0x").unwrap_or(&req.commit_hash))
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid commit hash hex: {}", e)))?;

    let mut commit_hash_padded = [0u8; 32];
    let len = commit_bytes.len().min(32);
    commit_hash_padded[..len].copy_from_slice(&commit_bytes[..len]);

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let attestation = MilestoneAttestation {
        grantId: U256::from(req.grant_id),
        milestoneIndex: U256::from(req.milestone_index),
        gitCommitHash: FixedBytes::from(commit_hash_padded),
        verified: true,
        timestamp: U256::from(timestamp),
    };

    // 4. EIP-712 sign the attestation
    let domain = eip712_domain! {
        name: "SupaFund",
        version: "1",
    };

    let signing_hash = attestation.eip712_signing_hash(&domain);
    let signature = state
        .signer
        .sign_hash_sync(&signing_hash)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Signing failed: {}", e)))?;

    let sig_bytes = {
        let mut buf = [0u8; 65];
        buf[..32].copy_from_slice(&signature.r().to_be_bytes::<32>());
        buf[32..64].copy_from_slice(&signature.s().to_be_bytes::<32>());
        buf[64] = if signature.v() { 28 } else { 27 };
        buf
    };

    // 5. Generate TDX attestation quote if running in TEE
    //    Binds the EIP-712 digest to hardware attestation — proves this
    //    specific signature was produced inside a genuine Phala dstack CVM.
    let tee_quote = if state.tee_enabled {
        let mut report_data = [0u8; 64];
        let hash = Sha256::digest(signing_hash.as_slice());
        report_data[..32].copy_from_slice(&hash);

        match state.dstack.get_quote(report_data.to_vec()).await {
            Ok(quote_resp) => {
                info!("TDX attestation quote generated");
                Some(quote_resp.quote)
            }
            Err(e) => {
                warn!("Failed to get TDX quote: {}", e);
                None
            }
        }
    } else {
        None
    };

    info!("Attestation signed for grant={} milestone={}", req.grant_id, req.milestone_index);

    Ok(Json(VerifyResponse {
        attestation: AttestationData {
            grant_id: req.grant_id.to_string(),
            milestone_index: req.milestone_index.to_string(),
            git_commit_hash: format!("0x{}", hex::encode(commit_hash_padded)),
            verified: true,
            timestamp: timestamp.to_string(),
        },
        signature: format!("0x{}", hex::encode(sig_bytes)),
        signer: format!("{:?}", state.signer.address()),
        tee_quote,
    }))
}

async fn check_github_commit(
    owner: &str,
    repo: &str,
    commit_sha: &str,
) -> Result<bool, String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/commits/{}",
        owner, repo, commit_sha
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "supafund-tee-agent")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    match resp.status().as_u16() {
        200 => Ok(true),
        404 => Ok(false),
        status => Err(format!("GitHub API returned status {}", status)),
    }
}

async fn check_url_reachable(url: &str) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(url)
        .header("User-Agent", "supafund-tee-agent")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if resp.status().is_success() || resp.status().is_redirection() {
        Ok(())
    } else {
        Err(format!("URL returned status {}", resp.status()))
    }
}
