import { hasBookingConfig, hasSupabaseConfig } from "@/utils/env/appEnv";
import {
  DEFAULT_BOOKING_SETTINGS,
  getBusinessRules,
} from "@/utils/booking/getBusinessRules";
import { DEFAULT_PRICING_BANDS } from "@/lib/pricing";
import { getPublishedAnnouncements } from "@/utils/announcements/getAnnouncements";
import { ACTIVE_COURT_IDS, COURTS } from "@/data/app/appConfig";
import { todayInManila } from "@/lib/time";
import { AmenitiesSection } from "@/components/home/AmenitiesSection";
import { BookingWidget } from "@/components/booking-widget/BookingWidget";
import { CustomerBookingsSection } from "@/components/customer-bookings/CustomerBookingsSection";
import { FindUsSection } from "@/components/home/FindUsSection";
import { HeroSection } from "@/components/home/HeroSection";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import { SiteHeader } from "@/components/home/SiteHeader";
import { TournamentSection } from "@/components/home/TournamentSection";
import FooterSection from "@/components/home/FooterSection";
import { SplashScreen } from "@/components/system/SplashScreen";

// Served as a cached page from Vercel's edge and refreshed in the background
// at most once a minute (admin changes to announcements refresh it at once).
// Anything about the signed-in visitor loads in the browser afterwards.
export const revalidate = 60;
export const preferredRegion = "sin1";

export default async function Home() {
  const bookingsReady = hasBookingConfig();
  const [businessRules, announcements] = await Promise.all([
    bookingsReady
      ? getBusinessRules()
      : {
          settings: DEFAULT_BOOKING_SETTINGS,
          courts: COURTS.filter((court) => ACTIVE_COURT_IDS.includes(court.id)).map((court) => ({ ...court, description: "Indoor" })),
          pricingBands: DEFAULT_PRICING_BANDS,
        },
    bookingsReady ? getPublishedAnnouncements() : [],
  ]);

  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-black"
        href="#main-content"
      >
        Skip to content
      </a>
      <LocalBusinessJsonLd settings={businessRules.settings} />
      <SplashScreen />
      <SiteHeader servicesReady={hasSupabaseConfig()} />
      <main
        id="main-content"
        className="relative min-h-screen overflow-hidden bg-black text-white"
      >
        <div className="pointer-events-none fixed left-1/2 top-0 hidden h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-white/10 blur-[130px] sm:block" />
        <HeroSection businessRules={businessRules} preview={!bookingsReady} />
        <CustomerBookingsSection bookings={[]} signedIn={false} />
        <AmenitiesSection />
        <BookingWidget
          initialDate={todayInManila()}
          courts={businessRules.courts}
          pricingBands={businessRules.pricingBands}
          signedIn={false}
          servicesReady={bookingsReady}
        />
        <TournamentSection announcements={announcements} />
        <FindUsSection
          settings={businessRules.settings}
          preview={!bookingsReady}
        />
      </main>
      <FooterSection />
    </>
  );
}
