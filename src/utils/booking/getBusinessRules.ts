import { unstable_cache } from "next/cache";
import { DEFAULT_PRICING_BANDS } from "@/lib/pricing";
import { ACTIVE_COURT_IDS, COURTS } from "@/data/app/appConfig";
import type { BusinessRules, CourtOption, PricingBand } from "@/types/bookingSettings";
import { createAdminClient } from "@/utils/supabase/admin";

export const DEFAULT_BOOKING_SETTINGS = {
  openHour: 8,
  closeHour: 25,
  timezone: "Asia/Manila",
};

type PricingBandRow = {
  id: string;
  label: string;
  start_hour: number;
  end_hour: number;
  hourly_rate: number;
  sort_order: number;
  active: boolean;
};

type CourtRow = {
  id: string;
  name: string;
  description: string | null;
};

async function loadBusinessRules(): Promise<BusinessRules> {
  const admin = createAdminClient();
  const [settingsResult, pricingResult, courtsResult] = await Promise.all([
    admin
      .from("booking_settings")
      .select("open_hour,close_hour,timezone")
      .eq("id", true)
      .maybeSingle(),
    admin
      .from("pricing_bands")
      .select("id,label,start_hour,end_hour,hourly_rate,sort_order,active")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("start_hour", { ascending: true }),
    admin
      .from("courts")
      .select("id,name,description")
      .order("name", { ascending: true }),
  ]);

  const activeCourts = (courtsResult.data || []).filter((court) =>
    ACTIVE_COURT_IDS.includes(court.id),
  );

  return {
    settings: settingsResult.data
      ? {
          openHour: settingsResult.data.open_hour,
          closeHour: settingsResult.data.close_hour,
          timezone: settingsResult.data.timezone || "Asia/Manila",
        }
      : DEFAULT_BOOKING_SETTINGS,
    pricingBands: pricingResult.data?.length
      ? pricingResult.data.map(mapPricingBand)
      : DEFAULT_PRICING_BANDS,
    courts: activeCourts.length
      ? activeCourts.map(mapCourt)
      : COURTS.filter((court) => ACTIVE_COURT_IDS.includes(court.id)).map((court) => ({
          id: court.id,
          name: court.name,
          description: "Indoor",
        })),
  };
}

export const getBusinessRules = unstable_cache(
  loadBusinessRules,
  ["business-rules"],
  {
    revalidate: 300,
    tags: ["business-rules"],
  },
);

function mapPricingBand(row: PricingBandRow): PricingBand {
  return {
    id: row.id,
    label: row.label,
    startHour: row.start_hour,
    endHour: row.end_hour,
    hourlyRate: row.hourly_rate,
    sortOrder: row.sort_order,
    active: row.active,
  };
}

function mapCourt(row: CourtRow): CourtOption {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
  };
}
