export const ESCROW_ADDRESS = "0x623B00cDe26c672611c67Bb9aFc4467E51a2fD0c" as const;
export const TEE_ORACLE_ADDRESS = "0xF5baa3381436e0C8818fB5EA3dA9d40C6c49C70D" as const;
export const TEE_AGENT_URL = "http://localhost:3001" as const;
export const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

export const ESCROW_ABI = [
  {
    type: "function",
    name: "createGrant",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "teeVerifier", type: "address" },
      { name: "amounts", type: "uint256[]" },
      { name: "gitCommitPrefixes", type: "bytes32[]" },
    ],
    outputs: [{ name: "grantId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getMilestones",
    inputs: [{ name: "grantId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "amount", type: "uint256" },
          { name: "requiredGitCommitPrefix", type: "bytes32" },
          { name: "demoVideoURL", type: "string" },
          { name: "liveSiteURL", type: "string" },
          { name: "status", type: "uint8" },
          {
            name: "teeAttestation",
            type: "tuple",
            components: [
              { name: "grantId", type: "uint256" },
              { name: "milestoneIndex", type: "uint256" },
              { name: "gitCommitHash", type: "bytes32" },
              { name: "verified", type: "bool" },
              { name: "timestamp", type: "uint256" },
            ],
          },
          { name: "completedAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "grantCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "grants",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "funder", type: "address" },
      { name: "recipient", type: "address" },
      { name: "totalAmount", type: "uint256" },
      { name: "currentMilestone", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "teeVerifier", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMilestoneCount",
    inputs: [{ name: "grantId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifyMilestone",
    inputs: [
      { name: "grantId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
      {
        name: "attestation",
        type: "tuple",
        components: [
          { name: "grantId", type: "uint256" },
          { name: "milestoneIndex", type: "uint256" },
          { name: "gitCommitHash", type: "bytes32" },
          { name: "verified", type: "bool" },
          { name: "timestamp", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "releaseMilestone",
    inputs: [
      { name: "grantId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "disputeMilestone",
    inputs: [
      { name: "grantId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
