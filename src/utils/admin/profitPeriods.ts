/**
 * Pure date helpers for the Expenses & Profit dashboard.
 * All keys are Manila calendar dates as strings (YYYY-MM-DD), so plain string
 * comparison orders them correctly.
 */

export type PeriodMode = "month" | "year" | "range" | "all";
export type Granularity = "day" | "week" | "month" | "year";

export type Period = { start: string; end: string; label: string };

export type TrendBucket = {
  key: string;
  label: string;
  start: string;
  end: string;
  /** False for the dimmed context buckets shown before the selected period. */
  inPeriod: boolean;
};

export const MAX_TREND_BUCKETS = 400;
const CONTEXT_BUCKETS: Partial<Record<Granularity, number>> = { month: 6, year: 5 };

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function shiftMonth(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function lastDayOfMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${monthKey}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
}

export function daysBetween(start: string, end: string) {
  return Math.round(
    (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}

export function startOfWeek(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

export function inPeriod(date: string, period: { start: string; end: string }) {
  return date >= period.start && date <= period.end;
}

export function resolvePeriod(
  mode: PeriodMode,
  values: { month: string; year: string; rangeFrom: string; rangeTo: string },
  allDates: string[],
  today: string,
): Period {
  if (mode === "month") {
    return {
      start: `${values.month}-01`,
      end: lastDayOfMonth(values.month),
      label: formatMonthLabel(values.month),
    };
  }
  if (mode === "year") {
    return { start: `${values.year}-01-01`, end: `${values.year}-12-31`, label: values.year };
  }
  if (mode === "range") {
    const [start, end] =
      values.rangeFrom <= values.rangeTo
        ? [values.rangeFrom, values.rangeTo]
        : [values.rangeTo, values.rangeFrom];
    return { start, end, label: `${formatDateLabel(start)} – ${formatDateLabel(end)}` };
  }
  const sorted = [...allDates].sort();
  return { start: sorted[0] || today, end: sorted.at(-1) || today, label: "All time" };
}

/** The period of the same length just before the selected one, or null for all time. */
export function getPreviousPeriod(mode: PeriodMode, period: Period): Period | null {
  if (mode === "all") return null;
  if (mode === "month") {
    const month = shiftMonth(period.start.slice(0, 7), -1);
    return { start: `${month}-01`, end: lastDayOfMonth(month), label: formatMonthLabel(month) };
  }
  if (mode === "year") {
    const year = String(Number(period.start.slice(0, 4)) - 1);
    return { start: `${year}-01-01`, end: `${year}-12-31`, label: year };
  }
  const length = daysBetween(period.start, period.end) + 1;
  const end = addDays(period.start, -1);
  const start = addDays(end, -(length - 1));
  return { start, end, label: `${formatDateLabel(start)} – ${formatDateLabel(end)}` };
}

export function getDefaultGranularity(mode: PeriodMode, period: Period): Granularity {
  if (mode === "month") return "day";
  if (mode === "year") return "month";
  const days = daysBetween(period.start, period.end) + 1;
  if (mode === "range") return days <= 62 ? "day" : days <= 200 ? "week" : "month";
  return days > 3 * 366 ? "year" : "month";
}

/** Returns the start date of the bucket a date belongs to. */
export function getBucketStart(date: string, granularity: Granularity) {
  if (granularity === "day") return date;
  if (granularity === "week") return startOfWeek(date);
  if (granularity === "month") return `${date.slice(0, 7)}-01`;
  return `${date.slice(0, 4)}-01-01`;
}

function nextBucketStart(start: string, granularity: Granularity) {
  if (granularity === "day") return addDays(start, 1);
  if (granularity === "week") return addDays(start, 7);
  if (granularity === "month") return `${shiftMonth(start.slice(0, 7), 1)}-01`;
  return `${Number(start.slice(0, 4)) + 1}-01-01`;
}

function previousBucketStart(start: string, granularity: Granularity) {
  if (granularity === "day") return addDays(start, -1);
  if (granularity === "week") return addDays(start, -7);
  if (granularity === "month") return `${shiftMonth(start.slice(0, 7), -1)}-01`;
  return `${Number(start.slice(0, 4)) - 1}-01-01`;
}

function bucketEnd(start: string, granularity: Granularity) {
  return addDays(nextBucketStart(start, granularity), -1);
}

/**
 * Builds chart buckets covering the period. When the grouping matches the
 * period itself (one month grouped by month, one year by year), earlier
 * buckets are added as dimmed context so there is something to compare.
 * Returns null when there would be too many buckets to draw.
 */
export function buildTrendBuckets(
  mode: PeriodMode,
  period: Period,
  granularity: Granularity,
): TrendBucket[] | null {
  const firstInPeriod = getBucketStart(period.start, granularity);
  let first = firstInPeriod;
  const isSingleBucket =
    (mode === "month" && granularity === "month") || (mode === "year" && granularity === "year");
  if (isSingleBucket) {
    for (let index = 1; index < (CONTEXT_BUCKETS[granularity] || 1); index += 1) {
      first = previousBucketStart(first, granularity);
    }
  }

  const buckets: TrendBucket[] = [];
  for (let start = first; start <= period.end; start = nextBucketStart(start, granularity)) {
    if (buckets.length >= MAX_TREND_BUCKETS) return null;
    const end = bucketEnd(start, granularity);
    const isContext = start < firstInPeriod;
    // Clip partial buckets (e.g. a week that starts before the range) to the period.
    const clippedStart = isContext || start >= period.start ? start : period.start;
    const clippedEnd = isContext || end <= period.end ? end : period.end;
    buckets.push({
      key: start,
      label: formatBucketLabel(clippedStart, clippedEnd, granularity),
      start: clippedStart,
      end: clippedEnd,
      inPeriod: !isContext,
    });
  }
  return buckets;
}

export function formatBucketLabel(start: string, end: string, granularity: Granularity) {
  const date = new Date(`${start}T00:00:00Z`);
  if (granularity === "day") {
    return new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  }
  if (granularity === "week") {
    const startLabel = new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
    const endLabel = new Intl.DateTimeFormat("en-PH", { day: "numeric", timeZone: "UTC" }).format(
      new Date(`${end}T00:00:00Z`),
    );
    if (start === end) return startLabel;
    return start.slice(0, 7) === end.slice(0, 7) ? `${startLabel}–${endLabel}` : startLabel;
  }
  if (granularity === "month") {
    return new Intl.DateTimeFormat("en-PH", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
  }
  return start.slice(0, 4);
}

export function formatMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${monthKey}-01T00:00:00Z`),
  );
}

export function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
