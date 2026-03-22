"use client";

import { use, useState } from "react";
import { formatUnits } from "viem";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { ESCROW_ABI, ESCROW_ADDRESS, TEE_AGENT_URL } from "@/config/contracts";

const EXPLORER = "https://sepolia.basescan.org";
const STATUS_LABELS = ["Pending", "Verified", "Released", "Disputed"] as const;
const STATUS_STYLES = [
  "bg-surface-2 text-muted",
  "bg-card-cyan-dark text-card-cyan",
  "bg-yo-yellow text-black",
  "bg-red-900 text-red-300",
] as const;

interface TeeResponse {
  attestation: {
    grant_id: string;
    milestone_index: string;
    git_commit_hash: string;
    verified: boolean;
    timestamp: string;
  };
  signature: string;
  signer: string;
  tee_quote: string | null;
}

export default function GrantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const grantId = BigInt(id);
  const { address } = useAccount();

  const { data: grant, refetch: refetchGrant } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "grants",
    args: [grantId],
  });

  const { data: milestones, refetch: refetchMilestones } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "getMilestones",
    args: [grantId],
  });

  // Verify milestone via TEE agent
  const [verifyingIdx, setVerifyingIdx] = useState<number | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [showVerifyForm, setShowVerifyForm] = useState<number | null>(null);

  const { writeContractAsync: verifyOnChain, data: verifyTx } = useWriteContract();
  const { isLoading: verifyTxPending, isSuccess: verifyTxSuccess } = useWaitForTransactionReceipt({ hash: verifyTx });

  const { writeContractAsync: releaseOnChain, data: releaseTx } = useWriteContract();
  const { isLoading: releasePending, isSuccess: releaseSuccess } = useWaitForTransactionReceipt({ hash: releaseTx });

  const { writeContractAsync: disputeOnChain, data: disputeTx } = useWriteContract();
  const { isLoading: disputePending } = useWaitForTransactionReceipt({ hash: disputeTx });

  // Refetch after tx success
  if (verifyTxSuccess || releaseSuccess) {
    refetchGrant();
    refetchMilestones();
  }

  function parseError(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    // Common contract revert reasons
    if (msg.includes("Commit not found")) return "Commit not found in that repository. Check the owner, repo name, and commit hash.";
    if (msg.includes("does not match required prefix")) return "Commit hash doesn't match the required prefix for this milestone. Make sure you're using a commit from the correct repo.";
    if (msg.includes("Demo URL unreachable")) return "The demo URL could not be reached.";
    if (msg.includes("Live URL unreachable")) return "The live URL could not be reached.";
    if (msg.includes("Invalid commit hash hex")) return "Invalid commit hash format. Enter a 40-character hex hash (no 0x prefix needed).";
    if (msg.includes("User rejected")) return "Transaction rejected in wallet.";
    if (msg.includes("user rejected")) return "Transaction rejected in wallet.";
    if (msg.includes("InvalidSignature") || msg.includes("invalid signature")) return "On-chain signature verification failed. The TEE signer may not be registered.";
    if (msg.includes("AlreadyVerified") || msg.includes("already verified")) return "This milestone has already been verified.";
    if (msg.includes("NotPending")) return "This milestone is not in pending status.";
    if (msg.includes("GrantNotActive")) return "This grant is no longer active.";
    if (msg.includes("GitHub check failed") || msg.includes("BAD_GATEWAY")) return "Could not reach GitHub API. Try again in a moment.";
    if (msg.includes("fetch") || msg.includes("NetworkError") || msg.includes("Failed to fetch")) return "Could not reach TEE agent. Check your internet connection.";
    // Truncate long messages
    if (msg.length > 200) return msg.slice(0, 200) + "...";
    return msg;
  }

  async function handleVerify(milestoneIndex: number) {
    setVerifyingIdx(milestoneIndex);
    setVerifyError(null);

    try {
      // 1. Call TEE agent
      const res = await fetch(`${TEE_AGENT_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_id: Number(grantId),
          milestone_index: milestoneIndex,
          repo_owner: repoOwner,
          repo_name: repoName,
          commit_hash: commitHash,
          expected_prefix: milestones?.[milestoneIndex]?.requiredGitCommitPrefix,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `TEE agent returned ${res.status}`);
      }

      const tee: TeeResponse = await res.json();

      // 2. Submit attestation on-chain
      await verifyOnChain({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "verifyMilestone",
        args: [
          grantId,
          BigInt(milestoneIndex),
          {
            grantId: BigInt(tee.attestation.grant_id),
            milestoneIndex: BigInt(tee.attestation.milestone_index),
            gitCommitHash: tee.attestation.git_commit_hash as `0x${string}`,
            verified: tee.attestation.verified,
            timestamp: BigInt(tee.attestation.timestamp),
          },
          tee.signature as `0x${string}`,
        ],
      });

      setShowVerifyForm(null);
    } catch (e) {
      setVerifyError(parseError(e));
    } finally {
      setVerifyingIdx(null);
    }
  }

  async function handleRelease(milestoneIndex: number) {
    setVerifyError(null);
    try {
      await releaseOnChain({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "releaseMilestone",
        args: [grantId, BigInt(milestoneIndex)],
      });
    } catch (e) {
      setVerifyError(parseError(e));
    }
  }

  async function handleDispute(milestoneIndex: number) {
    setVerifyError(null);
    try {
      await disputeOnChain({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "disputeMilestone",
        args: [grantId, BigInt(milestoneIndex)],
      });
    } catch (e) {
      setVerifyError(parseError(e));
    }
  }

  if (!grant) {
    return (
      <div className="text-center py-20 px-4">
        <p className="text-muted">Loading grant...</p>
      </div>
    );
  }

  const [funder, recipient, totalAmount, , active] = grant;
  const isFunder = address?.toLowerCase() === funder?.toLowerCase();

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-12">
      {/* Grant Header */}
      <div className="bg-surface-1 rounded-[20px] sm:rounded-[30px] p-5 sm:p-8 lg:p-10 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl sm:text-4xl lg:text-[56px] leading-none">Grant #{id}</h1>
          <span
            className={`self-start sm:self-auto shrink-0 rounded-full px-5 sm:px-6 py-2 text-[13px] font-bold uppercase tracking-[0.96px] ${
              active ? "bg-yo-yellow text-black" : "bg-surface-2 text-muted"
            }`}
          >
            {active ? "Active" : "Completed"}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
          <div className="bg-surface-2 rounded-[16px] p-4 sm:p-5">
            <p className="text-muted text-xs sm:text-sm mb-1">Total Amount</p>
            <p className="text-yo-yellow text-xl sm:text-2xl font-bold">{formatUnits(totalAmount, 6)} USDC</p>
          </div>
          <div className="bg-surface-2 rounded-[16px] p-4 sm:p-5 min-w-0">
            <p className="text-muted text-xs sm:text-sm mb-1">Funder</p>
            <p className="text-text-primary font-mono text-[11px] sm:text-sm break-all">{funder}</p>
          </div>
          <div className="bg-surface-2 rounded-[16px] p-4 sm:p-5 min-w-0">
            <p className="text-muted text-xs sm:text-sm mb-1">Recipient</p>
            <p className="text-text-primary font-mono text-[11px] sm:text-sm break-all">{recipient}</p>
          </div>
        </div>
      </div>

      {/* Global error banner */}
      {verifyError && (
        <div className="bg-red-900/40 border border-red-500/30 rounded-[16px] p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-lg shrink-0">!</span>
            <div>
              <p className="text-red-300 text-sm font-medium">{verifyError}</p>
              <button onClick={() => setVerifyError(null)} className="text-red-400/60 text-xs mt-1 hover:text-red-300">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Milestones */}
      <h2 className="text-xl sm:text-2xl lg:text-[40px] mb-4 sm:mb-6">Milestones</h2>
      <div className="space-y-3 sm:space-y-5">
        {milestones?.map((m, i) => (
          <div key={i} className="bg-surface-1 rounded-[20px] sm:rounded-[30px] p-6 sm:p-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h3 className="text-lg sm:text-xl text-text-primary">Milestone {i + 1}</h3>
              <span className={`self-start sm:self-auto rounded-full px-4 py-1 text-[13px] font-bold uppercase tracking-[0.96px] ${STATUS_STYLES[m.status]}`}>
                {STATUS_LABELS[m.status]}
              </span>
            </div>
            <div className="bg-surface-2 rounded-[16px] p-4 sm:p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted text-sm">Amount</span>
                <span className="text-yo-yellow font-bold">{formatUnits(m.amount, 6)} USDC</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-muted text-sm">Git Commit Prefix</span>
                <span className="text-text-primary font-mono text-sm break-all">
                  {m.requiredGitCommitPrefix.replace(/0+$/, "") || "—"}
                </span>
              </div>
              {m.completedAt > 0n && (
                <div className="flex justify-between items-center">
                  <span className="text-muted text-sm">Completed</span>
                  <span className="text-text-primary text-sm">
                    {new Date(Number(m.completedAt) * 1000).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            {m.status === 0 && (
              <div className="mt-4 space-y-3">
                {showVerifyForm === i ? (
                  <div className="bg-surface-2 rounded-[16px] p-4 sm:p-5 space-y-3">
                    <input
                      type="text"
                      placeholder="Repo owner (e.g. octocat)"
                      value={repoOwner}
                      onChange={(e) => setRepoOwner(e.target.value)}
                      className="w-full bg-surface-3 text-text-primary rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yo-yellow placeholder:text-muted"
                    />
                    <input
                      type="text"
                      placeholder="Repo name (e.g. hello-world)"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      className="w-full bg-surface-3 text-text-primary rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yo-yellow placeholder:text-muted"
                    />
                    <input
                      type="text"
                      placeholder="Full commit hash (40 hex chars)"
                      value={commitHash}
                      onChange={(e) => setCommitHash(e.target.value)}
                      className="w-full bg-surface-3 text-text-primary rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yo-yellow placeholder:text-muted"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleVerify(i)}
                        disabled={verifyingIdx === i || verifyTxPending || !repoOwner || !repoName || !commitHash}
                        className="bg-yo-yellow text-black rounded-full px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.96px] hover:brightness-110 transition-all disabled:opacity-40"
                      >
                        {verifyingIdx === i ? "Calling TEE..." : verifyTxPending ? "Confirming tx..." : "Verify"}
                      </button>
                      <button
                        onClick={() => setShowVerifyForm(null)}
                        className="bg-surface-3 text-text-primary rounded-full px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.96px] hover:bg-surface-2 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {verifyError && (
                      <p className="text-red-400 text-sm">{verifyError}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowVerifyForm(i)}
                      className="bg-yo-yellow text-black rounded-full px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.96px] hover:brightness-110 transition-all"
                    >
                      Verify Milestone
                    </button>
                    {isFunder && (
                      <button
                        onClick={() => handleDispute(i)}
                        disabled={disputePending}
                        className="bg-red-900 text-red-300 rounded-full px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.96px] hover:bg-red-800 transition-colors disabled:opacity-40"
                      >
                        {disputePending ? "Disputing..." : "Dispute"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Release button for verified milestones */}
            {m.status === 1 && (
              <div className="mt-4">
                <button
                  onClick={() => handleRelease(i)}
                  disabled={releasePending}
                  className="bg-yo-yellow text-black rounded-full px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.96px] hover:brightness-110 transition-all disabled:opacity-40"
                >
                  {releasePending ? "Releasing..." : "Release Funds"}
                </button>
              </div>
            )}

            {/* Explorer links */}
            {verifyTx && (
              <a href={`${EXPLORER}/tx/${verifyTx}`} target="_blank" rel="noopener noreferrer" className="text-yo-yellow text-xs mt-3 inline-block hover:underline">
                Verify tx on explorer →
              </a>
            )}
            {releaseTx && (
              <a href={`${EXPLORER}/tx/${releaseTx}`} target="_blank" rel="noopener noreferrer" className="text-yo-yellow text-xs mt-3 inline-block hover:underline ml-4">
                Release tx on explorer →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
