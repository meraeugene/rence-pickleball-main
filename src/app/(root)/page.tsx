import type { User } from "@supabase/supabase-js";
import {
  getAdminEmails,
  hasSupabaseConfig,
  hasBookingConfig,
} from "@/utils/env/appEnv";
import { createClient } from "@/utils/supabase/server";
import {
  getAcceptedBookings,
  getUserBookingHistory,
} from "@/utils/booking/getAcceptedBookings";
import {
  DEFAULT_BOOKING_SETTINGS,
  getBusinessRules,
} from "@/utils/booking/getBusinessRules";
import { DEFAULT_PRICING_BANDS } from "@/lib/pricing";
import { COURTS } from "@/data/app/appConfig";
import { getUserAvatarUrl } from "@/utils/users/getUserAvatarUrl";
import { getUserDisplayName } from "@/utils/users/getUserDisplayName";
import { todayInManila } from "@/lib/time";
import { AmenitiesSection } from "@/components/home/AmenitiesSection";
import { BookingWidget } from "@/components/booking-widget/BookingWidget";
import { CustomerBookingsSection } from "@/components/customer-bookings/CustomerBookingsSection";
import { FindUsSection } from "@/components/home/FindUsSection";
import { HeroSection } from "@/components/home/HeroSection";
import { SiteHeader } from "@/components/home/SiteHeader";
import { TournamentSection } from "@/components/home/TournamentSection";
import FooterSection from "@/components/home/FooterSection";
import { SplashScreen } from "@/components/system/SplashScreen";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export default async function Home() {
  const servicesReady = hasSupabaseConfig();
  const bookingsReady = hasBookingConfig();
  let user: User | null = null;
  if (servicesReady) {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
  }
  const initialName = getUserDisplayName(user);
  const avatarUrl = getUserAvatarUrl(user) || "";
  const isAdmin = Boolean(
    user?.email && getAdminEmails().includes(user.email.toLowerCase()),
  );
  const [bookings, bookingHistory, businessRules] = await Promise.all([
    user && bookingsReady ? getAcceptedBookings(user.id) : [],
    user && bookingsReady ? getUserBookingHistory(user.id) : [],
    bookingsReady
      ? getBusinessRules()
      : {
          settings: DEFAULT_BOOKING_SETTINGS,
          courts: COURTS.map((court) => ({ ...court, description: "Indoor" })),
          pricingBands: DEFAULT_PRICING_BANDS,
        },
  ]);

  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:text-black"
        href="#main-content"
      >
        Skip to content
      </a>
      <SplashScreen />
      <SiteHeader
        avatarUrl={avatarUrl}
        bookings={bookings}
        email={user?.email}
        fullName={initialName}
        isAdmin={isAdmin}
        isGuest={Boolean(user?.is_anonymous)}
        signedIn={Boolean(user)}
        servicesReady={servicesReady}
      />
      <main
        id="main-content"
        className="relative min-h-screen overflow-hidden bg-black text-white"
      >
        <div className="pointer-events-none fixed left-1/2 top-0 hidden h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-white/10 blur-[130px] sm:block" />
        <HeroSection businessRules={businessRules} preview={!bookingsReady} />
        <CustomerBookingsSection
          bookings={bookingHistory}
          signedIn={Boolean(user)}
        />
        <AmenitiesSection />
        <BookingWidget
          initialDate={todayInManila()}
          initialEmail={user?.email || ""}
          initialName={initialName}
          courts={businessRules.courts}
          pricingBands={businessRules.pricingBands}
          signedIn={Boolean(user)}
          servicesReady={bookingsReady}
        />
        <TournamentSection />
        <FindUsSection
          settings={businessRules.settings}
          preview={!bookingsReady}
        />
      </main>
      <FooterSection />
    </>
  );
}
