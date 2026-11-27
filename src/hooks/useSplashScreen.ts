"use client";

import { useEffect, useRef, useState } from "react";

// Keep in sync with --splash-hold in globals.css (4000ms + 360ms fade + margin).
const FALLBACK_DURATION_MS = 5000;
export const SPLASH_SEEN_KEY = "uno-rally-splash-seen";

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

    try {
      window.sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
    } catch {
      // Storage can be unavailable (private mode); the splash just shows again.
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
