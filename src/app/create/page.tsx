"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { ESCROW_ABI, ESCROW_ADDRESS, ERC20_ABI, USDC_ADDRESS } from "@/config/contracts";

const EXPLORER = "https://sepolia.basescan.org";

interface Milestone {
  amount: string;
  gitCommitPrefix: string;
}

export default function CreateGrantPage() {
  const { address } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [teeVerifier, setTeeVerifier] = useState("0xF5baa3381436e0C8818fB5EA3dA9d40C6c49C70D");
  const [milestones, setMilestones] = useState<Milestone[]>([{ amount: "", gitCommitPrefix: "" }]);

  const { writeContract: approve, data: approveTx } = useWriteContract();
  const { writeContract: create, data: createTx } = useWriteContract();
  const { isLoading: approving, isSuccess: approved } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isLoading: creating, isSuccess } = useWaitForTransactionReceipt({ hash: createTx });

  const totalAmount = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
  const formReady = recipient.startsWith("0x") && teeVerifier.startsWith("0x") && totalAmount > 0;

  function updateMilestone(i: number, field: keyof Milestone, value: string) {
    setMilestones((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  }

  function handleApprove() {
    approve({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ESCROW_ADDRESS, parseUnits(String(totalAmount), 6)],
    });
  }

  function handleCreate() {
    const amounts = milestones.map((m) => parseUnits(m.amount, 6));
    const prefixes = milestones.map((m) => {
      // If empty, pass bytes32(0) — means "any commit accepted"
      const raw = m.gitCommitPrefix.trim().replace(/^0x/i, "");
      if (!raw) return "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
      // Pad hex prefix to bytes32 (right-padded with zeros)
      const hexStr = `0x${raw.padEnd(64, "0")}` as `0x${string}`;
      return hexStr;
    });
    create({
      address: ESCROW_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "createGrant",
      args: [recipient as `0x${string}`, teeVerifier as `0x${string}`, amounts, prefixes],
    });
  }

  if (!address) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 sm:py-24">
        <div className="bg-surface-1 rounded-[20px] sm:rounded-[30px] p-6 sm:p-10 text-center">
          <h2 className="text-xl sm:text-2xl mb-3">Connect Wallet</h2>
          <p className="text-muted text-sm">Connect your wallet to create a grant.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-4xl lg:text-[56px] leading-none mb-6 sm:mb-8">Create Grant</h1>

      {isSuccess ? (
        <div className="bg-card-mint-dark rounded-[20px] sm:rounded-[30px] p-6 sm:p-10 text-center space-y-4">
          <h2 className="text-card-mint text-2xl sm:text-3xl mb-3">Grant Created</h2>
          <p className="text-muted text-sm">Your grant has been submitted on-chain.</p>
          {createTx && (
            <a
              href={`${EXPLORER}/tx/${createTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-yo-yellow text-black rounded-full px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.96px] hover:brightness-110 transition-all"
            >
              View on Explorer
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Addresses */}
          <div className="bg-surface-1 rounded-[20px] sm:rounded-[30px] p-5 sm:p-8 lg:p-10 space-y-4 sm:space-y-5">
            <div>
              <label className="text-muted text-xs sm:text-sm block mb-2 uppercase tracking-[0.96px] font-bold">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full bg-surface-2 text-text-primary rounded-full px-4 sm:px-6 py-3 text-sm outline-none focus:ring-2 focus:ring-yo-yellow placeholder:text-muted"
              />
            </div>
            <div>
              <label className="text-muted text-xs sm:text-sm block mb-2 uppercase tracking-[0.96px] font-bold">
                TEE Verifier Address
              </label>
              <input
                type="text"
                value={teeVerifier}
                onChange={(e) => setTeeVerifier(e.target.value)}
                placeholder="0x..."
                className="w-full bg-surface-2 text-text-primary rounded-full px-4 sm:px-6 py-3 text-sm outline-none focus:ring-2 focus:ring-yo-yellow placeholder:text-muted"
              />
            </div>
          </div>

          {/* Milestones */}
          <div className="bg-surface-1 rounded-[20px] sm:rounded-[30px] p-5 sm:p-8 lg:p-10">
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <h3 className="text-base sm:text-xl">Milestones</h3>
              <button
                onClick={() => setMilestones((prev) => [...prev, { amount: "", gitCommitPrefix: "" }])}
                className="bg-surface-2 text-text-primary rounded-full px-4 sm:px-5 py-2 text-[13px] font-bold uppercase tracking-[0.96px] hover:bg-surface-3 transition-colors"
              >
                + Add
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {milestones.map((m, i) => (
                <div key={i} className="bg-surface-2 rounded-[12px] sm:rounded-[16px] p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted text-xs sm:text-sm">Milestone {i + 1}</span>
                    {milestones.length > 1 && (
                      <button
                        onClick={() => setMilestones((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 text-xs sm:text-sm hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    value={m.amount}
                    onChange={(e) => updateMilestone(i, "amount", e.target.value)}
                    placeholder="Amount (USDC)"
                    className="w-full bg-surface-3 text-text-primary rounded-full px-4 sm:px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yo-yellow placeholder:text-muted"
                  />
                  <div>
                    <input
                      type="text"
                      value={m.gitCommitPrefix}
                      onChange={(e) => updateMilestone(i, "gitCommitPrefix", e.target.value.replace(/[^0-9a-fA-F]/g, ""))}
                      placeholder="Git commit prefix (optional — leave empty to accept any commit)"
                      maxLength={40}
                      className="w-full bg-surface-3 text-text-primary rounded-full px-4 sm:px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yo-yellow placeholder:text-muted font-mono"
                    />
                    <p className="text-muted text-[11px] mt-1 px-4">
                      Hex only (0-9, a-f). Leave empty to accept any commit from the repo.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="bg-surface-1 rounded-[20px] sm:rounded-[30px] p-5 sm:p-8 lg:p-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
              <div>
                <p className="text-muted text-xs sm:text-sm">Total</p>
                <p className="text-yo-yellow text-2xl sm:text-3xl font-bold">{totalAmount} USDC</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button
                  onClick={handleApprove}
                  disabled={approving || !formReady || approved}
                  className={`rounded-full px-6 sm:px-8 py-3 text-[13px] font-bold uppercase tracking-[0.96px] transition-all w-full sm:w-auto ${
                    approved
                      ? "bg-card-mint-dark text-card-mint cursor-default"
                      : formReady && !approving
                        ? "bg-yo-yellow text-black hover:brightness-110 animate-pulse"
                        : "bg-surface-2 text-muted opacity-40 cursor-not-allowed"
                  }`}
                >
                  {approving ? "Approving..." : approved ? "Approved" : "1. Approve USDC"}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !approved}
                  className={`rounded-full px-6 sm:px-8 py-3 text-[13px] font-bold uppercase tracking-[0.96px] transition-all w-full sm:w-auto ${
                    approved && !creating
                      ? "bg-yo-yellow text-black hover:brightness-110 animate-pulse"
                      : "bg-surface-2 text-muted opacity-40 cursor-not-allowed"
                  }`}
                >
                  {creating ? "Creating..." : "2. Create Grant"}
                </button>
              </div>
            </div>
            {approveTx && (
              <a
                href={`${EXPLORER}/tx/${approveTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-yo-yellow text-xs mt-3 inline-block hover:underline"
              >
                Approve tx on explorer →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
