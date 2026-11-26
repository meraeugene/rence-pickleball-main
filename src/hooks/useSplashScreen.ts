"use client";

import { useEffect, useRef, useState } from "react";

const FALLBACK_DURATION_MS = 2400;

export function useSplashScreen() {
  const [visible, setVisible] = useState(true);
  const splashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const splash = splashRef.current;
    let finished = false;

    function finishSplash() {
      if (finished) return;
      finished = true;
      setVisible(false);
    }

    function handleAnimationEnd(event: AnimationEvent) {
      if (event.target === splash && event.animationName === "splash-out") {
        finishSplash();
      }
    }

    if (!splash || getComputedStyle(splash).visibility === "hidden") {
      finishSplash();
      return;
    }

    splash.addEventListener("animationend", handleAnimationEnd);
    const fallbackTimeout = window.setTimeout(
      finishSplash,
      FALLBACK_DURATION_MS,
    );

    return () => {
      splash.removeEventListener("animationend", handleAnimationEnd);
      window.clearTimeout(fallbackTimeout);
    };
  }, []);

  return { splashRef, visible };
}
