export type ExpenseCategory =
  | "UTILITIES"
  | "RENT"
  | "STAFF"
  | "EQUIPMENT"
  | "MAINTENANCE"
  | "SUPPLIES"
  | "MARKETING"
  | "OTHER";

export type Expense = {
  id: string;
  /** Manila calendar date, YYYY-MM-DD. */
  expenseDate: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  /** Set when this row was generated from a recurring expense. */
  recurringExpenseId: string | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecurringExpense = {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  /** 1–31; months with fewer days use their last day. */
  dayOfMonth: number;
  /** First month it applies to, YYYY-MM. */
  startMonth: string;
  /** Last month already added to expenses, YYYY-MM. */
  lastGeneratedMonth: string | null;
  active: boolean;
};

/** Revenue from accepted bookings, totalled per Manila play date. */
export type DailyRevenue = {
  /** Manila calendar date, YYYY-MM-DD. */
  date: string;
  /** Payments actually recorded on accepted bookings. */
  collected: number;
  /** Full price of accepted bookings, paid or not. */
  bookingValue: number;
  bookingCount: number;
};

/** Revenue per Manila play date, court and pricing time slot. */
export type RevenueBreakdownRow = {
  date: string;
  court: string;
  slot: string;
  collected: number;
  bookingValue: number;
};

export type ProfitDashboardData = {
  generatedAt: string;
  /** False when the expenses migration has not been run yet. */
  expensesReady: boolean;
  /** False when the recurring-expenses migration has not been run yet. */
  recurringReady: boolean;
  expenses: Expense[];
  recurring: RecurringExpense[];
  revenue: DailyRevenue[];
  breakdown: RevenueBreakdownRow[];
  /** Time-slot labels in display order (from pricing bands). */
  slotOrder: string[];
};

export type ExpenseFieldName =
  | "expenseDate"
  | "category"
  | "description"
  | "amount"
  | "dayOfMonth";

export type ExpenseMutationResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<ExpenseFieldName, string>> };
