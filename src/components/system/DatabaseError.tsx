"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function DatabaseError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-black px-4 py-12 text-white">
      <div className="silver-border glass-panel w-full max-w-xl rounded-[2rem] p-6 sm:p-10">
        <BrandLogo className="mb-8" />
        <p className="font-display text-xs uppercase tracking-[0.25em] text-zinc-500">A quick timeout</p>
        <h1 className="font-display hero-shine-text mt-4 text-3xl font-black uppercase leading-tight">Court details could not be loaded</h1>
        <p className="mt-5 text-sm leading-7 text-zinc-400">Please check your connection and try again in a moment.</p>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <button type="button" className="premium-button h-12 rounded-xl px-5 text-xs font-bold" onClick={reset}>Try again <RefreshCw size={16} /></button>
          <Link className="premium-button-dark h-12 rounded-xl px-5 text-xs" href="/"><ArrowLeft size={15} /> Back to home</Link>
        </div>
      </div>
    </main>
  );
}
