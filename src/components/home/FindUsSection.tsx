import { ExternalLink, MapPin, Phone, Clock3 } from "lucide-react";
import { brandConfig } from "@/data/brand/brandConfig";
import { formatHourRange } from "@/lib/pricing";
import type { BookingSettings } from "@/types/bookingSettings";

export function FindUsSection({ settings, preview = false }: { settings: BookingSettings; preview?: boolean }) {
  return (
    <section id="find-us" className="court-section relative py-16">
      <div className="site-container">
        <div className="modern-visit-grid grid gap-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:p-10">
          <div>
            <p className="font-display text-sm font-black uppercase tracking-[0.35em] text-zinc-500">Find Us</p>
            <h2 className="font-display hero-shine-text mt-4 text-4xl font-black uppercase sm:text-5xl">UNO RALLY</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-300">
              {brandConfig.address || "Visit UNO RALLY Picklecafe using the map below."}
            </p>
            {brandConfig.mapsUrl && (
              <a className="premium-button mt-7 h-14 rounded-xl px-5 font-display text-xs uppercase" href={brandConfig.mapsUrl} rel="noreferrer" target="_blank">
                Open in Google Maps <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <iframe className="mt-7 h-64 w-full rounded-2xl border border-white/10" title="UNO RALLY venue location" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" src={brandConfig.mapsEmbedUrl} />
          </div>
          <div className="modern-visit-details grid content-center gap-4">
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/35 p-5 text-zinc-200">
              <span className="icon-chip h-11 w-11 rounded-xl"><Clock3 className="h-5 w-5" /></span>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Hours</p>
                <p className="mt-1 text-sm font-bold">{preview ? "Opening hours coming soon" : `Open daily / ${formatHourRange(settings.openHour, settings.closeHour)}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/35 p-5 text-zinc-200">
              <span className="icon-chip h-11 w-11 rounded-xl"><MapPin className="h-5 w-5" /></span>
              <div><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Venue</p><p className="mt-1 text-sm font-bold">UNO RALLY Pickleball</p></div>
            </div>
            {brandConfig.phone && (
              <a className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/35 p-5 text-zinc-200 transition hover:border-white/35" href={`tel:${brandConfig.phone.replace(/[^+\d]/g, "")}`}>
                <span className="icon-chip h-11 w-11 rounded-xl"><Phone className="h-5 w-5" /></span>
                <div><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Call</p><p className="mt-1 font-bold">{brandConfig.phone}</p></div>
              </a>
            )}
            {brandConfig.socialUrl && (
              <a className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/35 p-5 text-zinc-200 transition hover:border-white/35" href={brandConfig.socialUrl} rel="noreferrer" target="_blank">
                <span className="icon-chip h-11 w-11 rounded-xl font-black">f</span>
                <div><p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Facebook</p><p className="mt-1 font-bold">UNO RALLY</p></div>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
