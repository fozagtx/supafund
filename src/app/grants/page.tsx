"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { ESCROW_ABI, ESCROW_ADDRESS } from "@/config/contracts";

const COLORS = [
  { bg: "bg-card-blue-dark", accent: "text-card-blue" },
  { bg: "bg-card-mint-dark", accent: "text-card-mint" },
  { bg: "bg-card-cyan-dark", accent: "text-card-cyan" },
  { bg: "bg-card-lavender-dark", accent: "text-card-lavender" },
];

export default function GrantsPage() {
  const { data: count } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "grantCount",
  });

  const grantCount = count !== undefined ? Number(count) : 0;
  const ids = Array.from({ length: grantCount }, (_, i) => BigInt(i));

  const { data: grantsData } = useReadContracts({
    contracts: ids.map((id) => ({
      address: ESCROW_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "grants" as const,
      args: [id] as const,
    })),
    query: { enabled: grantCount > 0 },
  });

  const grants = grantsData
    ?.map((g, i) => (g.result ? { id: i, data: g.result } : null))
    .filter(Boolean) as { id: number; data: readonly [string, string, bigint, bigint, boolean, string] }[] | undefined;

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-12">
      <div className="mb-8 sm:mb-10">
        <h1 className="text-3xl sm:text-5xl lg:text-[56px] leading-tight mb-3">
          All <span className="text-yo-yellow">Grants</span>
        </h1>
        <p className="text-muted text-sm sm:text-base">
          Active and completed grant escrows on Base Sepolia.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {grants?.map((g, i) => {
          const color = COLORS[i % COLORS.length];
          const [funder, recipient, totalAmount, , active] = g.data;
          return (
            <Link key={g.id} href={`/grant/${g.id}`} className="block">
              <div className={`${color.bg} rounded-[20px] sm:rounded-[30px] p-6 sm:p-10 hover:scale-[1.02] transition-transform`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h3 className={`text-xl sm:text-[28px] ${color.accent}`}>Grant #{g.id}</h3>
                  <span className={`self-start sm:self-auto rounded-full px-4 py-1 text-[13px] font-bold uppercase tracking-[0.96px] ${active ? "bg-yo-yellow text-black" : "bg-surface-2 text-muted"}`}>
                    {active ? "Active" : "Completed"}
                  </span>
                </div>
                <p className="text-muted text-sm truncate">
                  Funder: <span className="text-text-primary font-medium">{funder.slice(0, 6)}...{funder.slice(-4)}</span>
                </p>
                <p className="text-muted text-sm truncate">
                  Recipient: <span className="text-text-primary font-medium">{recipient.slice(0, 6)}...{recipient.slice(-4)}</span>
                </p>
                <p className={`text-xl sm:text-2xl font-bold ${color.accent} mt-4`}>
                  {formatUnits(totalAmount, 6)} USDC
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {(!grants || grants.length === 0) && (
        <div className="text-center py-16 sm:py-24">
          <div className="bg-surface-1 rounded-[20px] sm:rounded-[30px] p-8 sm:p-12 max-w-md mx-auto">
            <p className="text-4xl sm:text-5xl mb-4 opacity-30">0</p>
            <h3 className="text-xl sm:text-2xl text-text-primary mb-3">No Grants Yet</h3>
            <p className="text-muted text-sm mb-6">Be the first to deploy a milestone-based grant.</p>
            <Link
              href="/create"
              className="inline-block bg-yo-yellow text-black rounded-full px-8 py-3 text-[13px] font-bold uppercase tracking-[0.96px] hover:brightness-110 transition-all"
            >
              Create Grant
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
