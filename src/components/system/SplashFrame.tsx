"use client";

/* eslint-disable @next/next/no-img-element */

import type { Ref } from "react";
import { DeveloperCredit } from "@/components/brand/DeveloperCredit";

export function SplashFrame({
  autoExit = false,
  className = "",
  exiting = false,
  rootRef,
}: {
  autoExit?: boolean;
  className?: string;
  exiting?: boolean;
  rootRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={rootRef}
      aria-busy="true"
      aria-label="Loading UNO RALLY Pickleball"
      role="status"
      className={[
        "splash-screen grid place-items-center bg-black px-8",
        autoExit ? "splash-screen-auto-exit" : "",
        exiting ? "splash-screen-exit" : "",
        className,
      ].join(" ")}
    >
      <div className="splash-content grid w-full max-w-5xl justify-items-center gap-7">
        <img
          alt="UNO RALLY"
          className="splash-logo h-auto w-40 sm:w-48"
          width={1228}
          height={773}
          src="/uno-rally-logo-new.png"
        />
        <div className="w-full max-w-[14rem]">
          <div className="h-[3px] overflow-hidden rounded-full bg-white/12">
            <div className="splash-loading-line h-full rounded-full bg-white" />
          </div>
          <p className="mt-4 whitespace-nowrap text-center font-display text-[0.56rem] font-black uppercase tracking-[0.2em] text-zinc-500 sm:text-[0.62rem]">
            Cagayan de Oro Pickleball
          </p>
        </div>
      </div>
      <DeveloperCredit
        stacked
        className="splash-credit absolute bottom-[max(1.75rem,env(safe-area-inset-bottom))] left-0 w-full px-6 text-center text-xs font-medium leading-5 text-zinc-500"
      />
    </div>
  );
}
