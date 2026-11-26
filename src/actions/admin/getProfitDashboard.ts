"use server";

import type { JoinedCourt } from "@/types/admin/adminBooking";
import type {
  DailyRevenue,
  Expense,
  ExpenseCategory,
  ProfitDashboardData,
  RecurringExpense,
  RevenueBreakdownRow,
} from "@/types/admin/expense";
import type { PricingBand } from "@/types/bookingSettings";
import { getJoinedCourtName } from "@/utils/admin/getJoinedCourtName";
import { getManilaDateKey } from "@/utils/admin/getManilaDateKey";
import { isMissingExpensesTable } from "@/utils/admin/isMissingExpensesTable";
import { requireAdmin } from "@/utils/admin/requireAdmin";
import { getBusinessRules } from "@/utils/booking/getBusinessRules";
import { createAdminClient } from "@/utils/supabase/admin";

const QUERY_BATCH_SIZE = 1000;
const OTHER_SLOT = "Other hours";

type AdminClient = ReturnType<typeof createAdminClient>;

type RevenueBookingRow = {
  booking_group_id: string;
  start_at: string;
  total_amount: number;
  downpayment_amount: number;
  courts: JoinedCourt;
};

type ExpenseRow = {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number | string;
  recurring_expense_id?: string | null;
  created_by_email: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

type RecurringRow = {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number | string;
  day_of_month: number;
  start_month: string;
  last_generated_month: string | null;
  active: boolean;
};

export async function getProfitDashboard(): Promise<ProfitDashboardData | null> {
  const adminUser = await requireAdmin();
  if (!adminUser) return null;

  const admin = createAdminClient();

  // Add any recurring expenses that have come due before reading expenses.
  const recurringReady = await generateDueRecurringExpenses(admin);

  const [{ settings, pricingBands }, revenueResult, expenseResult, recurring] =
    await Promise.all([
      getBusinessRules(),
      loadBookingRevenue(admin),
      loadExpenses(admin, recurringReady),
      recurringReady ? loadRecurring(admin) : Promise.resolve([]),
    ]);

  const bands = [...pricingBands].sort(
    (first, second) => first.startHour - second.startHour,
  );
  const { revenue, breakdown, hasOtherSlot } = aggregateRevenue(
    revenueResult,
    bands,
    settings.openHour,
  );

  return {
    generatedAt: new Date().toISOString(),
    expensesReady: expenseResult.ready,
    recurringReady: expenseResult.ready && recurringReady,
    expenses: expenseResult.expenses,
    recurring,
    revenue,
    breakdown,
    slotOrder: [
      ...new Set(bands.map((band) => band.label)),
      ...(hasOtherSlot ? [OTHER_SLOT] : []),
    ],
  };
}

async function generateDueRecurringExpenses(admin: AdminClient) {
  const { error } = await admin.rpc("generate_recurring_expenses", {
    p_today: getManilaDateKey(new Date()),
  });
  if (!error) return true;
  const message = (error.message || "").toLowerCase();
  if (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("generate_recurring_expenses") ||
    isMissingExpensesTable(error)
  ) {
    return false;
  }
  console.error("generate_recurring_expenses failed", { code: error.code });
  return true;
}

async function loadBookingRevenue(admin: AdminClient) {
  const rows: RevenueBookingRow[] = [];
  let offset = 0;

  for (;;) {
    const { count, data, error } = await admin
      .from("bookings")
      .select("booking_group_id,start_at,total_amount,downpayment_amount,courts(name)", {
        count: "exact",
      })
      .eq("status", "ACCEPTED")
      .order("start_at", { ascending: true })
      .range(offset, offset + QUERY_BATCH_SIZE - 1);

    if (error) {
      throw new Error("Unable to load booking revenue for the profit dashboard.");
    }

    const batch = (data || []) as unknown as RevenueBookingRow[];
    rows.push(...batch);
    offset += batch.length;
    if (!batch.length || (count !== null && rows.length >= count)) break;
  }

  return rows;
}

function aggregateRevenue(
  rows: RevenueBookingRow[],
  bands: PricingBand[],
  openHour: number,
) {
  const days = new Map<
    string,
    { collected: number; bookingValue: number; groups: Set<string> }
  >();
  const cells = new Map<string, RevenueBreakdownRow>();
  let hasOtherSlot = false;

  for (const row of rows) {
    const date = getManilaDateKey(row.start_at);
    const collected = Number(row.downpayment_amount) || 0;
    const bookingValue = Number(row.total_amount) || 0;

    const day = days.get(date) || {
      collected: 0,
      bookingValue: 0,
      groups: new Set<string>(),
    };
    day.collected += collected;
    day.bookingValue += bookingValue;
    day.groups.add(row.booking_group_id);
    days.set(date, day);

    const court = getJoinedCourtName(row.courts) || "Unknown court";
    const slot = getSlotLabel(row.start_at, bands, openHour);
    if (slot === OTHER_SLOT) hasOtherSlot = true;
    const key = `${date}|${court}|${slot}`;
    const cell = cells.get(key) || { date, court, slot, collected: 0, bookingValue: 0 };
    cell.collected += collected;
    cell.bookingValue += bookingValue;
    cells.set(key, cell);
  }

  const revenue: DailyRevenue[] = [...days.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([date, day]) => ({
      date,
      collected: day.collected,
      bookingValue: day.bookingValue,
      bookingCount: day.groups.size,
    }));

  return { revenue, breakdown: [...cells.values()], hasOtherSlot };
}

/** Classifies a booking by the pricing band its start hour falls in (Manila time). */
function getSlotLabel(startAt: string, bands: PricingBand[], openHour: number) {
  const hourText = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Manila",
  }).format(new Date(startAt));
  let hour = Number(hourText) % 24;
  // Hours after midnight belong to the previous operating day (e.g. 25 = 1 AM).
  if (hour < openHour % 24) hour += 24;
  return (
    bands.find((band) => hour >= band.startHour && hour < band.endHour)?.label ||
    OTHER_SLOT
  );
}

async function loadExpenses(
  admin: AdminClient,
  withRecurringColumn: boolean,
): Promise<{ ready: boolean; expenses: Expense[] }> {
  const baseColumns =
    "id,expense_date,category,description,amount,created_by_email,updated_by_email,created_at,updated_at";
  const columns = withRecurringColumn ? `${baseColumns},recurring_expense_id` : baseColumns;
  const rows: ExpenseRow[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await admin
      .from("expenses")
      .select(columns)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + QUERY_BATCH_SIZE - 1);

    if (error) {
      if (isMissingExpensesTable(error)) return { ready: false, expenses: [] };
      throw new Error("Unable to load expenses.");
    }

    const batch = (data || []) as unknown as ExpenseRow[];
    rows.push(...batch);
    offset += batch.length;
    if (batch.length < QUERY_BATCH_SIZE) break;
  }

  return {
    ready: true,
    expenses: rows.map((row) => ({
      id: row.id,
      expenseDate: row.expense_date,
      category: row.category,
      description: row.description,
      amount: Number(row.amount) || 0,
      recurringExpenseId: row.recurring_expense_id || null,
      createdByEmail: row.created_by_email,
      updatedByEmail: row.updated_by_email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

async function loadRecurring(admin: AdminClient): Promise<RecurringExpense[]> {
  const { data, error } = await admin
    .from("recurring_expenses")
    .select("id,category,description,amount,day_of_month,start_month,last_generated_month,active")
    .order("active", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Unable to load recurring expenses", { code: error.code });
    return [];
  }

  return ((data || []) as RecurringRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    description: row.description,
    amount: Number(row.amount) || 0,
    dayOfMonth: row.day_of_month,
    startMonth: row.start_month.slice(0, 7),
    lastGeneratedMonth: row.last_generated_month ? row.last_generated_month.slice(0, 7) : null,
    active: row.active,
  }));
}
