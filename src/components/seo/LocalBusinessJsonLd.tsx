import { brandConfig } from "@/data/brand/brandConfig";
import type { BookingSettings } from "@/types/bookingSettings";
import { getAppUrl } from "@/utils/env/appEnv";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function toClock(hour: number) {
  const normalized = ((hour % 24) + 24) % 24;
  return `${String(normalized).padStart(2, "0")}:00`;
}

/**
 * Structured data so Google can show UNO RALLY as a local pickleball venue
 * (name, location, hours, booking link, Facebook) in search and Maps results.
 */
export function LocalBusinessJsonLd({ settings }: { settings: BookingSettings }) {
  const url = getAppUrl().replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "@id": `${url}/#venue`,
    name: "UNO RALLY",
    alternateName: "UNO RALLY Pickleball",
    description:
      "Indoor pickleball court in Cagayan de Oro. Book court time online, play open daily, and join the UNO RALLY community.",
    url,
    image: [`${url}/uno-rally-social-v2.png`, `${url}/uno-rally-court-hero.png`],
    logo: `${url}/uno-rally-icon-v2.png`,
    sport: "Pickleball",
    address: {
      "@type": "PostalAddress",
      ...(brandConfig.address ? { streetAddress: brandConfig.address } : {}),
      addressLocality: "Cagayan de Oro",
      addressRegion: "Misamis Oriental",
      addressCountry: "PH",
    },
    geo: { "@type": "GeoCoordinates", latitude: 8.477137, longitude: 124.624064 },
    hasMap: brandConfig.mapsUrl,
    ...(brandConfig.phone ? { telephone: brandConfig.phone } : {}),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: DAYS,
        opens: toClock(settings.openHour),
        closes: toClock(settings.closeHour),
      },
    ],
    priceRange: "₱₱",
    currenciesAccepted: "PHP",
    sameAs: [brandConfig.socialUrl].filter(Boolean),
    potentialAction: {
      "@type": "ReserveAction",
      target: `${url}/#schedule`,
      name: "Book a court",
    },
  };

  return (
    <script
      type="application/ld+json"
      // Escape "<" so the JSON can never close the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
