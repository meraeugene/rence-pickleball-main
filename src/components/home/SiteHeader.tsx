"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { siteNavItems } from "@/data/navigation/siteNavItems";
import { useSiteHeader } from "@/hooks/useSiteHeader";
import type { UserBooking } from "@/types/userBooking";
import { AuthButton } from "@/components/auth/AuthButton";
import { BrandLogo } from "@/components/brand/BrandLogo";

type SiteHeaderProps = {
  avatarUrl?: string | null;
  email?: string | null;
  fullName?: string | null;
  isAdmin?: boolean;
  isGuest?: boolean;
  signedIn?: boolean;
  bookings?: UserBooking[];
  servicesReady?: boolean;
};

export function SiteHeader({ servicesReady = true, ...authProps }: SiteHeaderProps) {
  const { activeSection, scrolled, setActiveSection } = useSiteHeader();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  return (
    <header className={[
      "fixed inset-x-0 top-0 z-40 border-b transition-all duration-300",
      scrolled || menuOpen
        ? "border-white/10 bg-black/45 shadow-[0_18px_70px_rgba(0,0,0,0.32)] sm:backdrop-blur-xl"
        : "border-transparent bg-transparent",
    ].join(" ")}>
      <div className="site-container">
        <div className="flex min-h-14 items-center justify-between gap-3 sm:min-h-16">
          <Link className="shrink-0" href="/" aria-label="UNO RALLY home">
            <BrandLogo className="max-w-16 sm:max-w-20" priority />
          </Link>
          <nav aria-label="Main sections" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/30 p-1 backdrop-blur-xl xl:flex">
            {siteNavItems.map((item) => (
              <a
                aria-current={activeSection === item.href ? "location" : undefined}
                className={[
                  "rounded-full px-4 py-2 font-display text-[0.6rem] font-black uppercase tracking-[0.14em] transition",
                  activeSection === item.href
                    ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    : "text-zinc-400 hover:bg-white/[0.08] hover:text-white",
                ].join(" ")}
                href={item.href}
                key={item.href}
                onClick={() => setActiveSection(item.href)}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {servicesReady ? <AuthButton {...authProps} /> : (
              <a className="premium-button-dark min-h-10 rounded-xl px-4 font-display text-[0.6rem] font-bold uppercase tracking-wider" href="#schedule">Book a court</a>
            )}
            <button ref={menuButton} className="menu-icon-button xl:!hidden" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="mobile-navigation" className="mt-2 grid gap-1 rounded-2xl border border-white/15 bg-black/95 p-4 xl:hidden" aria-label="Mobile sections">
            {siteNavItems.map((item) => (
              <a key={item.href} aria-current={activeSection === item.href ? "location" : undefined} className={`rounded-xl px-4 py-3 font-display text-xs uppercase tracking-wider ${activeSection === item.href ? "bg-white/[0.14] text-white" : "text-zinc-300 hover:bg-white/10"}`} href={item.href} onClick={() => { setActiveSection(item.href); setMenuOpen(false); }}>{item.label}</a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
