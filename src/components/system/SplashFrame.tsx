"use client";

/* eslint-disable @next/next/no-img-element */

import type { Ref } from "react";

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
      <div className="splash-content grid justify-items-center">
        <img
          alt="UNO RALLY"
          className="splash-logo h-auto w-32 sm:w-40"
          width={1635}
          height={962}
          src="/uno-rally-logo.png"
        />
      </div>
      <p className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-0 w-full px-6 text-center text-xs font-medium text-zinc-600">
        Developed by{" "}
        <a
          className="cursor-pointer text-zinc-400 no-underline transition hover:text-white"
          href="https://andrewvillalon.online"
          rel="noreferrer"
          target="_blank"
        >
          Andrew Villalon
        </a>
      </p>
    </div>
  );
}
