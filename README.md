# SupaFund

TEE-governed milestone-based grant escrow on Base. Funders lock USDC, developers hit milestones, a TEE agent cryptographically verifies the work, funds release automatically. No trust required.

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|---|---|
| **SupaFundEscrow** | `0x623B00cDe26c672611c67Bb9aFc4467E51a2fD0c` |
| **TEEOracle** | `0xF5baa3381436e0C8818fB5EA3dA9d40C6c49C70D` |
| **TEE Signer** | `0xD3be111800721a2bc0a3E14E0a4d26b65d24c6B9` |
| **USDC (Base Sepolia)** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

**Chain:** Base Sepolia (84532)

## Architecture

```
Frontend (Next.js) ──► Smart Contracts (Base Sepolia)
                            ▲
                            │ EIP-712 signed attestation
                            │
                       TEE Agent (Rust/Axum)
                       ├─ Verifies GitHub commits
                       ├─ Checks demo/live URLs
                       ├─ Signs MilestoneAttestation (EIP-712)
                       └─ TDX hardware quote (Phala dstack)
```

## How It Works

1. **Funder** creates a grant → USDC locked in escrow
2. **Developer** builds the milestone, pushes code
3. **TEE Agent** verifies the commit exists on GitHub, signs an attestation
4. **Attestation submitted on-chain** → contract verifies signature matches registered TEE signer
5. **Funds released** to developer

## Stack

- **Contracts:** Solidity, Foundry, OpenZeppelin v5, EIP-712
- **Frontend:** Next.js 16, wagmi, RainbowKit, Tailwind CSS v4
- **TEE Agent:** Rust, Axum, Phala dstack-sdk, alloy
- **Chain:** Base Sepolia (L2)

## Running Locally

```bash
# Frontend
pnpm install && pnpm dev

# TEE Agent
cd teeOracle
cp .env.example .env  # add TEE_PRIVATE_KEY
cargo run

# Contracts (test)
cd contracts
forge test -vvv --fork-url https://sepolia.base.org
```

## Built For

Shape Rotator Hackathon 2025
