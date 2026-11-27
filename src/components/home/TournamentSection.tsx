import { Megaphone } from "lucide-react";
import Image from "next/image";
import type { Announcement } from "@/types/announcement";

export function TournamentSection({ announcements = [] }: { announcements?: Announcement[] }) {
  return (
    <section id="announcements" className="court-section relative py-16">
      <div className="site-container">
        <div className="mb-8 border-b border-white/10 pb-8">
          <p className="font-display text-sm font-black uppercase tracking-[0.35em] text-zinc-500">
            Latest Updates
          </p>
          <h2 className="font-display hero-shine-text mt-3 text-[clamp(1.35rem,4.5vw,3.5rem)] font-black uppercase leading-tight">
            Announcements
          </h2>
        </div>

        {announcements.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {announcements.map((announcement) => (
              <AnnouncementCard announcement={announcement} key={announcement.id} />
            ))}
          </div>
        ) : (
          <div className="silver-border glass-panel grid min-h-64 place-items-center rounded-[2rem] px-6 py-12 text-center sm:min-h-72">
            <div className="max-w-md">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-zinc-300">
                <Megaphone className="h-6 w-6" />
              </span>
              <h3 className="font-display mt-6 text-xl font-black uppercase tracking-[0.12em] text-white sm:text-2xl">
                No announcements yet
              </h3>
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                Events and promos coming soon.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <article className="silver-border glass-panel flex flex-col overflow-hidden rounded-[1.5rem]">
      {announcement.imageUrl ? (
        <a
          aria-label={`Open full picture: ${announcement.title}`}
          className="relative block aspect-[4/5] bg-black"
          href={announcement.imageUrl}
          rel="noreferrer"
          target="_blank"
        >
          <Image
            alt={announcement.title}
            className="object-contain"
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            src={announcement.imageUrl}
          />
        </a>
      ) : null}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-zinc-500">
          {formatAnnouncementDate(announcement.createdAt)}
        </p>
        <h3 className="font-display mt-2 text-base font-black uppercase leading-snug tracking-[0.06em] text-white sm:text-lg">
          {announcement.title}
        </h3>
        {announcement.body ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-400">{announcement.body}</p>
        ) : null}
      </div>
    </article>
  );
}

function formatAnnouncementDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
