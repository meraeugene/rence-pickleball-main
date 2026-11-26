import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { brandConfig } from "@/data/brand/brandConfig";

export default function FooterSection() {
  return (
    <footer className="court-section relative bg-black py-10">
      <div className="site-container">
        <div className="modern-footer-grid">
          <div><Link href="/" aria-label="UNO RALLY home"><BrandLogo className="w-32" /></Link><p className="mt-5 max-w-xs text-xs leading-7 text-zinc-500">Professional courts. Good company.<br />One more reason to play.</p></div>
          <div><p className="mb-5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-500">Get on the court</p><nav aria-label="Footer sections" className="grid gap-3 text-xs text-zinc-300"><a href="#schedule">Book a court</a><a href="#amenities">The amenities</a><a href="#announcements">Announcements</a></nav></div>
          <div><p className="mb-5 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-500">Stay connected</p><nav aria-label="Venue links" className="grid gap-3 text-xs text-zinc-300"><a href="#find-us">Find UNO RALLY</a>{brandConfig.socialUrl && <a href={brandConfig.socialUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">Facebook <ArrowUpRight size={13} /></a>}<a href="#home">Back to top</a></nav></div>
        </div>
        <div className="mt-9 flex flex-wrap justify-between gap-4 border-t border-white/10 pt-6 text-[0.6rem] text-zinc-600"><p>UNO RALLY / Pickleball</p><a href="https://andrewvillalon.online" target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-white">Developed by Andrew Villalon</a></div>
      </div>
    </footer>
  );
}
