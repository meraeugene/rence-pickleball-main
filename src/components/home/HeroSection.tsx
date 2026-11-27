import { ArrowDown, ArrowRight, CalendarDays, Clock3, MapPin, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { formatHourRange } from "@/lib/pricing";
import type { BusinessRules } from "@/types/bookingSettings";

export function HeroSection({ businessRules, preview = false }: { businessRules: BusinessRules; preview?: boolean }) {
  return (
    <section id="home" className="modern-hero relative overflow-hidden bg-black">
      <Image alt="UNO RALLY indoor pickleball court" className="object-cover object-center" fill priority quality={75} sizes="100vw" src="/uno-rally-court-hero.png" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.9),rgba(0,0,0,0.48)),linear-gradient(0deg,#000,transparent_70%)]" />
      <div className="site-container relative pb-10 pt-36 sm:pt-44">
        <div className="max-w-2xl">
          <div className="reveal-up">
            <p className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-[0.55rem] font-bold uppercase tracking-[0.18em] text-zinc-300 sm:text-[0.6rem]">
              <MapPin aria-hidden="true" className="h-3 w-3 shrink-0 text-white" /> Cagayan de Oro Pickleball
            </p>
            <h1 className="font-display hero-shine-text text-5xl font-black uppercase leading-[1.05] tracking-tight sm:text-7xl xl:text-8xl">One more<br />rally.<span className="sr-only"> UNO RALLY, indoor pickleball court in Cagayan de Oro</span></h1>
            <p className="mt-7 max-w-md text-sm leading-8 text-zinc-300 sm:text-base">Great courts, good company. Book your spot and play.</p>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <a className="premium-button h-14 rounded-xl px-6 text-xs font-black uppercase tracking-widest" href="#schedule">Book a court <ArrowRight size={17} /></a>
              <a className="flex items-center gap-3 text-xs text-zinc-400 hover:text-white" href="#amenities"><ArrowDown size={15} /> Explore the venue</a>
            </div>
          </div>
        </div>
        <div className="modern-hero-stats mt-12 grid gap-4 border-t border-white/15 pt-6 sm:grid-cols-3">
          <div className="flex items-center gap-4"><span className="icon-chip h-11 w-11 rounded-xl"><ShieldCheck size={19} /></span><div><p className="font-display text-lg font-bold">{preview ? "Court booking" : `${businessRules.courts.length} PRO COURT${businessRules.courts.length === 1 ? "" : "S"}`}</p><p className="mt-1 text-[0.65rem] text-zinc-500">Indoor and ready</p></div></div>
          <div className="flex items-center gap-4"><span className="icon-chip h-11 w-11 rounded-xl"><Clock3 size={19} /></span><div><p className="font-display text-sm font-bold">{preview ? "Schedule available soon" : formatHourRange(businessRules.settings.openHour, businessRules.settings.closeHour)}</p><p className="mt-1 text-[0.65rem] text-zinc-500">Open daily</p></div></div>
          <div className="flex items-center gap-4"><span className="icon-chip h-11 w-11 rounded-xl"><CalendarDays size={19} /></span><div><p className="font-display text-sm font-bold">Your time. Your court.</p><p className="mt-1 text-[0.65rem] text-zinc-500">Book online in minutes</p></div></div>
        </div>
      </div>
    </section>
  );
}
