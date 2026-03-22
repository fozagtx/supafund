"use client";

import { useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="w-full px-4 sm:px-8 lg:px-12 py-4 sm:py-5">
      <div className="max-w-[1700px] mx-auto flex items-center justify-between">
        <Link href="/" className="shrink-0">
          <span className="text-yo-yellow text-xl sm:text-2xl font-bold uppercase tracking-wide">
            SupaFund
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-5">
          <Link
            href="/grants"
            className="text-muted hover:text-text-primary text-[13px] font-bold uppercase tracking-[0.96px] transition-colors"
          >
            Grants
          </Link>
          <Link
            href="/create"
            className="bg-yo-yellow text-black rounded-full px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.96px] hover:brightness-110 transition-all"
          >
            Create Grant
          </Link>
          <ConnectButton
            accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
            showBalance={{ smallScreen: false, largeScreen: true }}
          />
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden flex flex-col gap-1.5 p-2"
        >
          <span className={`block w-6 h-0.5 bg-text-primary transition-transform ${open ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-6 h-0.5 bg-text-primary transition-opacity ${open ? "opacity-0" : ""}`} />
          <span className={`block w-6 h-0.5 bg-text-primary transition-transform ${open ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden mt-4 pb-4 flex flex-col items-center gap-4 border-t border-surface-2 pt-4">
          <Link
            href="/grants"
            onClick={() => setOpen(false)}
            className="text-muted hover:text-text-primary text-[13px] font-bold uppercase tracking-[0.96px]"
          >
            Grants
          </Link>
          <Link
            href="/create"
            onClick={() => setOpen(false)}
            className="bg-yo-yellow text-black rounded-full px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.96px]"
          >
            Create Grant
          </Link>
          <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
        </div>
      )}
    </nav>
  );
}
