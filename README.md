# SupaFund

TEE-governed milestone-based grant escrow on Base. Funders lock USDC, developers hit milestones, a TEE agent cryptographically verifies the work, funds release automatically. No trust required.

## Live Deployment

| Component | URL / Address |
|---|---|
| **Frontend** | _Deploy to Vercel_ |
| **TEE Agent** | [`https://93ab46af00b77ebba45695c33d3f56e693750aeb-3001.dstack-pha-prod2.phala.network`](https://93ab46af00b77ebba45695c33d3f56e693750aeb-3001.dstack-pha-prod2.phala.network/health) |
| **TEE Agent Dashboard** | [Phala Cloud CVM](https://cloud.phala.com/dashboard/cvms/app_93ab46af00b77ebba45695c33d3f56e693750aeb) |

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|---|---|
| **SupaFundEscrow** | [`0x623B00cDe26c672611c67Bb9aFc4467E51a2fD0c`](https://sepolia.basescan.org/address/0x623B00cDe26c672611c67Bb9aFc4467E51a2fD0c) |
| **TEEOracle** | [`0xF5baa3381436e0C8818fB5EA3dA9d40C6c49C70D`](https://sepolia.basescan.org/address/0xF5baa3381436e0C8818fB5EA3dA9d40C6c49C70D) |
| **TEE Signer** | `0xD3be111800721a2bc0a3E14E0a4d26b65d24c6B9` |
| **USDC (Base Sepolia)** | [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |

**Chain:** Base Sepolia (84532)

## Architecture

```
┌─────────────────┐       ┌──────────────────────────┐
│   Frontend       │──────►│  SupaFundEscrow          │
│   (Next.js)      │       │  (Base Sepolia)          │
│                  │       │  ├─ createGrant()        │
│  Connect wallet  │       │  ├─ verifyMilestone()    │
│  Create grants   │       │  ├─ releaseMilestone()   │
│  Verify & release│       │  └─ disputeMilestone()   │
└────────┬─────────┘       └──────────▲───────────────┘
         │                            │
         │  POST /verify              │ EIP-712 signed attestation
         ▼                            │
┌─────────────────────────────────────┘
│   TEE Agent (Rust/Axum)
│   Running on Phala Cloud CVM
│   ├─ Verifies GitHub commit exists (public repos)
│   ├─ Validates commit hash matches grant prefix
│   ├─ Checks demo/live URLs reachable
│   ├─ Signs MilestoneAttestation (EIP-712)
│   └─ TDX hardware attestation quote (Phala dstack)
└─────────────────────────────────────
```

## How It Works

1. **Funder** creates a grant with milestones → USDC locked in escrow with git commit prefixes per milestone
2. **Developer** builds the milestone, pushes code to a public GitHub repo
3. **Anyone** submits the repo + commit hash to the TEE agent for verification
4. **TEE Agent** (running in a Phala CVM) verifies:
   - Commit exists on GitHub via API
   - Commit hash matches the required prefix stored on-chain
   - Demo/live URLs are reachable (if provided)
   - Signs an EIP-712 `MilestoneAttestation` struct
   - Generates TDX hardware attestation quote binding the signature to the TEE
5. **Attestation submitted on-chain** → `TEEOracle` contract recovers signer, checks it's a registered TEE signer
6. **Funder releases funds** → USDC transferred from escrow to developer

## Security Model

- **No human oracle** — verification is automated and deterministic
- **Commit prefix binding** — each milestone specifies a required git commit prefix, preventing verification of unrelated repos
- **EIP-712 typed signatures** — attestations are domain-separated and structured, not raw hashes
- **TEE hardware attestation** — TDX quotes prove the signature was produced inside a genuine Phala dstack CVM (when running in production)
- **On-chain signer registry** — only owner-registered TEE signers can produce valid attestations
- **NonReentrant + SafeERC20** — standard Solidity security patterns

## Stack

- **Contracts:** Solidity 0.8.24, Foundry, OpenZeppelin v5 (EIP-712, Ownable, ReentrancyGuard, SafeERC20)
- **Frontend:** Next.js 16 (Turbopack), wagmi 3.x, RainbowKit, Tailwind CSS v4
- **TEE Agent:** Rust, Axum 0.8, alloy 1.x, Phala dstack-sdk 0.1.2, reqwest
- **Infrastructure:** Phala Cloud CVM (TDX), Base Sepolia (L2), USDC
- **Docker:** Multi-stage Rust build, deployed to ghcr.io, pulled by Phala CVM

## Running Locally

```bash
# Frontend
pnpm install && pnpm dev

# TEE Agent (dev mode — no TEE hardware)
cd teeOracle
echo "TEE_PRIVATE_KEY=0x..." > .env
cargo run
# Agent runs on http://localhost:3001

# Contracts (fork tests against Base Sepolia)
cd contracts
forge test -vvv --fork-url https://sepolia.base.org
```

## Deploying TEE Agent to Phala Cloud

```bash
cd teeOracle

# Build and push Docker image
docker build --platform linux/amd64 -t ghcr.io/<user>/supafund-tee-agent:latest .
docker push ghcr.io/<user>/supafund-tee-agent:latest

# Deploy to Phala Cloud
npx phala deploy
# Select docker-compose.yml, set TEE_PRIVATE_KEY as encrypted env var
```

## Project Structure

```
supafund/
├── src/                    # Next.js frontend
│   ├── app/
│   │   ├── page.tsx        # Landing page
│   │   ├── create/         # Create grant form
│   │   ├── grants/         # All grants list
│   │   └── grant/[id]/     # Grant detail + verify/release
│   └── config/
│       ├── contracts.ts    # ABIs, addresses, TEE agent URL
│       └── wagmi.ts        # Wallet config
├── contracts/              # Foundry project
│   ├── src/
│   │   ├── SupaFundEscrow.sol
│   │   └── TEEOracle.sol
│   ├── test/
│   │   └── SupaFundEscrow.t.sol
│   └── script/
│       └── Deploy.s.sol
└── teeOracle/              # Rust TEE agent
    ├── src/main.rs
    ├── Cargo.toml
    ├── Dockerfile
    └── docker-compose.yml
```

## Built For

Shape Rotator Hackathon 2025
