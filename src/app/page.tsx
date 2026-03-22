import Link from "next/link";

const FEATURES = [
  {
    title: "TEE Verified",
    desc: "Milestones are cryptographically verified inside Trusted Execution Environments. No human judges needed.",
    colors: "bg-card-blue-dark text-card-blue",
  },
  {
    title: "Auto Payouts",
    desc: "USDC releases automatically when TEE attestations confirm milestone completion on-chain.",
    colors: "bg-card-mint-dark text-card-mint",
  },
  {
    title: "Git Native",
    desc: "Milestones are tied to git commit hashes. Ship code, get paid. No paperwork.",
    colors: "bg-card-cyan-dark text-card-cyan",
  },
  {
    title: "Dispute Safe",
    desc: "Funders can dispute milestones. Funds stay locked in escrow until resolution.",
    colors: "bg-card-lavender-dark text-card-lavender",
  },
];

const STEPS = [
  { num: "01", title: "Fund", desc: "Funder creates a grant with USDC milestones and git commit targets." },
  { num: "02", title: "Build", desc: "Recipient ships code. Each milestone has a git commit prefix to hit." },
  { num: "03", title: "Verify", desc: "TEE agent checks commits, generates EIP-712 attestation, posts on-chain." },
  { num: "04", title: "Release", desc: "Smart contract releases USDC to recipient. Automatic. Trustless." },
];

const STATS = [
  { value: "~2 min", label: "Verification Time" },
  { value: "0", label: "Human Judges" },
  { value: "USDC", label: "Native Payments" },
  { value: "EIP-712", label: "Attestation Standard" },
];

export default function Home() {
  return (
    <div>
      {/* HERO */}
      <section className="max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 pt-16 sm:pt-24 lg:pt-32 pb-20 sm:pb-28 lg:pb-36 text-center">
        <h1 className="text-5xl sm:text-7xl lg:text-[88px] leading-[0.95] mb-6">
          <span className="text-yo-yellow">Trustless</span>
          <br />
          Grant Funding
        </h1>
        <p className="text-muted text-base sm:text-lg lg:text-xl max-w-2xl mx-auto mb-10">
          TEE-governed escrow that verifies milestones cryptographically and
          releases USDC automatically. No judges. No delays. Just ship.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/create"
            className="w-full sm:w-auto bg-yo-yellow text-black rounded-full px-8 py-3.5 text-[13px] font-bold uppercase tracking-[0.96px] hover:brightness-110 transition-all text-center"
          >
            Create a Grant
          </Link>
          <Link
            href="/grants"
            className="w-full sm:w-auto bg-surface-2 text-text-primary rounded-full px-8 py-3.5 text-[13px] font-bold uppercase tracking-[0.96px] hover:bg-surface-3 transition-colors text-center"
          >
            Explore Grants
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-surface-1 w-full">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 py-12 sm:py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {STATS.map((s) => (
              <div key={s.label} className="bg-surface-2 rounded-2xl sm:rounded-[20px] p-4 sm:p-6 text-center">
                <p className="text-yo-yellow text-2xl sm:text-3xl lg:text-4xl font-bold mb-1">{s.value}</p>
                <p className="text-muted text-xs sm:text-sm uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-surface-2 w-full">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 py-16 sm:py-24">
          <h2 className="text-center text-3xl sm:text-4xl lg:text-[56px] leading-tight mb-10 sm:mb-14">
            Why <span className="text-yo-yellow">SupaFund</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className={`${f.colors.split(" ")[0]} rounded-[20px] sm:rounded-[30px] p-6 sm:p-10`}>
                <h3 className={`${f.colors.split(" ")[1]} text-xl sm:text-2xl lg:text-[32px] mb-3 sm:mb-4`}>
                  {f.title}
                </h3>
                <p className="text-muted text-sm sm:text-base leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-surface-1 w-full">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 py-16 sm:py-24">
          <h2 className="text-center text-3xl sm:text-4xl lg:text-[56px] leading-tight mb-10 sm:mb-14">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {STEPS.map((s) => (
              <div key={s.num} className="bg-surface-2 rounded-[20px] sm:rounded-[30px] p-6 sm:p-8">
                <span className="text-yo-yellow text-4xl sm:text-5xl lg:text-6xl font-bold opacity-30 block">
                  {s.num}
                </span>
                <h3 className="text-text-primary text-xl sm:text-2xl mt-3 sm:mt-4 mb-2 sm:mb-3">{s.title}</h3>
                <p className="text-muted text-sm sm:text-base leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1700px] mx-auto px-4 sm:px-8 lg:px-12 py-20 sm:py-32 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-[56px] leading-tight mb-6">
          Start <span className="text-yo-yellow">Funding</span>
        </h2>
        <p className="text-muted text-base sm:text-lg max-w-xl mx-auto mb-10">
          Deploy milestone-based grants in minutes. Verified by TEEs, settled in USDC.
        </p>
        <Link
          href="/create"
          className="inline-block w-full sm:w-auto bg-yo-yellow text-black rounded-full px-10 py-4 text-[13px] font-bold uppercase tracking-[0.96px] hover:brightness-110 transition-all"
        >
          Create a Grant
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-surface-2 px-4 sm:px-8 lg:px-12 py-8">
        <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-yo-yellow font-bold uppercase tracking-wide text-sm">SupaFund</span>
          <span className="text-muted text-xs sm:text-sm">TEE-governed grant escrow on Base</span>
        </div>
      </footer>
    </div>
  );
}
