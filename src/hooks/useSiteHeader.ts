"use client";

import { useEffect, useState } from "react";
import { siteNavItems } from "@/data/navigation/siteNavItems";

export function useSiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState(siteNavItems[0].href);

  useEffect(() => {
    const elements = siteNavItems
      .map((item) => document.querySelector(item.href))
      .filter((element): element is Element => Boolean(element));

    if (!elements.length) return;

    let animationFrame = 0;

    function updateActiveSection() {
      animationFrame = 0;
      setScrolled(window.scrollY > 28);

      // Section height must not affect activation: the booking schedule can be
      // several viewports tall and never reach a visibility-ratio threshold.
      const activationLine = window.innerHeight * 0.35;
      let current = elements[0];
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= activationLine) {
          current = element;
        }
      }

      const atPageEnd = window.scrollY > 0 &&
        Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight;
      if (atPageEnd) current = elements[elements.length - 1];

      setActiveSection(`#${current.id}`);
    }

    function scheduleUpdate() {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(updateActiveSection);
      }
    }

    updateActiveSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(document.body);
    elements.forEach((element) => resizeObserver.observe(element));

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return {
    activeSection,
    scrolled,
    setActiveSection,
  };
}
