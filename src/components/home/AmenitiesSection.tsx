import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

const amenities = [
  { title: "Pro courts", body: "Black courts, pro lights, pro spacing.", image: "/amenity-court.png", number: "01" },
  { title: "Roofed courts", body: "Covered play. Stay focused on the rally.", image: "/amenity-roof.png", number: "02" },
  { title: "Between games", body: "Take a break. Catch up with your crew.", image: "/amenity-coffee.png", number: "03" },
];

export function AmenitiesSection() {
  return (
    <section id="amenities" className="court-section relative py-16 sm:py-20">
      <div className="site-container">
        <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-[0.6rem] font-bold uppercase tracking-[0.25em] text-zinc-500">The venue / UNO RALLY</p><h2 className="font-display hero-shine-text mt-4 text-3xl font-black uppercase leading-tight sm:text-4xl">Built around<br />the game.</h2></div>
          <a href="#schedule" className="flex items-center gap-4 text-xs text-zinc-400 hover:text-white">Find your court <ArrowUpRight size={17} /></a>
        </div>
        <div className="modern-amenities-grid">
          {amenities.map(amenity => (
            <article className="modern-amenity-card silver-border glass-panel overflow-hidden rounded-[1.5rem]" key={amenity.number}>
              <div className="modern-amenity-image relative bg-black/50">
                <span className="absolute left-5 top-5 z-10 text-[0.6rem] tracking-widest text-zinc-500">{amenity.number}</span>
                <Image alt={amenity.title} src={amenity.image} fill className="object-contain p-6 opacity-95" sizes="(min-width: 1024px) 35vw, 100vw" />
              </div>
              <div className="modern-amenity-copy p-6">
                <h3 className="font-display text-base font-black uppercase leading-relaxed text-white">{amenity.title}</h3>
                <p className="mt-3 text-xs leading-7 text-zinc-400">{amenity.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
