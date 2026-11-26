"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  ReceiptText,
  Repeat,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { deleteExpense } from "@/actions/admin/manageExpenses";
import { exportProfitReport } from "@/actions/admin/exportProfitReport";
import {
  expenseCategories,
  getExpenseCategoryLabel,
} from "@/data/admin/expenseCategories";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type {
  Expense,
  ExpenseCategory,
  ProfitDashboardData,
} from "@/types/admin/expense";
import { formatPeso } from "@/utils/admin/formatProfitPeso";
import { getManilaDateKey } from "@/utils/admin/getManilaDateKey";
import {
  buildTrendBuckets,
  formatDateLabel,
  getBucketStart,
  getDefaultGranularity,
  getPreviousPeriod,
  inPeriod,
  resolvePeriod,
  type Granularity,
  type Period,
  type PeriodMode,
} from "@/utils/admin/profitPeriods";
import { ExpenseFormModal, type ExpenseFormTarget } from "./ExpenseFormModal";
import { ProfitTrendChart, type ProfitTrendPoint } from "./ProfitTrendChart";
import { BreakdownBarList } from "./BreakdownBarList";
import { CHART_COLORS } from "@/data/admin/chartColors";
import { RecurringExpensesCard } from "./RecurringExpensesCard";
import { RevenueBreakdownCard, type RevenueBreakdownItem } from "./RevenueBreakdownCard";

type CategoryFilter = "ALL" | ExpenseCategory;

const EXPENSE_PAGE_SIZE = 20;
const PERIOD_OPTIONS: Array<[PeriodMode, string]> = [
  ["month", "Month"],
  ["year", "Year"],
  ["range", "Date range"],
  ["all", "All time"],
];
const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

export function ProfitDashboard({
  data,
  lockError,
}: {
  data: ProfitDashboardData;
  lockError: string | null;
}) {
  const router = useRouter();
  const today = getManilaDateKey(new Date());
  const [mode, setMode] = useState<PeriodMode>("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(today.slice(0, 4));
  const [rangeFrom, setRangeFrom] = useState(`${today.slice(0, 7)}-01`);
  const [rangeTo, setRangeTo] = useState(today);
  const [granularityChoice, setGranularityChoice] = useState<Granularity | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [formTarget, setFormTarget] = useState<ExpenseFormTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, startExport] = useTransition();
  const canEdit = data.expensesReady && !lockError;

  const allDates = useMemo(
    () => [...data.revenue.map((day) => day.date), ...data.expenses.map((expense) => expense.expenseDate)],
    [data.revenue, data.expenses],
  );
  const yearOptions = useMemo(() => {
    const years = new Set(allDates.map((date) => date.slice(0, 4)));
    years.add(today.slice(0, 4));
    return [...years].sort((first, second) => second.localeCompare(first));
  }, [allDates, today]);

  const period = useMemo(
    () => resolvePeriod(mode, { month, year, rangeFrom, rangeTo }, allDates, today),
    [mode, month, year, rangeFrom, rangeTo, allDates, today],
  );
  const previousPeriod = useMemo(() => getPreviousPeriod(mode, period), [mode, period]);
  const granularity = granularityChoice || getDefaultGranularity(mode, period);

  const totals = useMemo(() => summarize(data, period), [data, period]);
  const previousTotals = useMemo(
    () => (previousPeriod ? summarize(data, previousPeriod) : null),
    [data, previousPeriod],
  );

  const buckets = useMemo(() => buildTrendBuckets(mode, period, granularity), [mode, period, granularity]);
  const trend = useMemo(() => buildTrendPoints(data, buckets || [], granularity), [data, buckets, granularity]);

  const periodExpenses = useMemo(
    () => data.expenses.filter((expense) => inPeriod(expense.expenseDate, period)),
    [data.expenses, period],
  );

  const categoryBreakdown = useMemo(
    () =>
      expenseCategories
        .map((category) => {
          const amount = sum(
            periodExpenses.filter((expense) => expense.category === category.value).map((expense) => expense.amount),
          );
          return { ...category, amount, share: totals.expenses ? (amount / totals.expenses) * 100 : 0 };
        })
        .filter((category) => category.amount > 0)
        .sort((first, second) => second.amount - first.amount),
    [periodExpenses, totals.expenses],
  );

  const { byCourt, bySlot } = useMemo(() => {
    const rows = data.breakdown.filter((row) => inPeriod(row.date, period));
    const group = (key: "court" | "slot") => {
      const map = new Map<string, RevenueBreakdownItem>();
      for (const row of rows) {
        const item = map.get(row[key]) || { label: row[key], collected: 0, bookingValue: 0 };
        item.collected += row.collected;
        item.bookingValue += row.bookingValue;
        map.set(row[key], item);
      }
      return [...map.values()];
    };
    const slotIndex = (label: string) => {
      const index = data.slotOrder.indexOf(label);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    return {
      byCourt: group("court").sort((first, second) => first.label.localeCompare(second.label, undefined, { numeric: true })),
      bySlot: group("slot").sort((first, second) => slotIndex(first.label) - slotIndex(second.label)),
    };
  }, [data.breakdown, data.slotOrder, period]);

  const listedExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return periodExpenses.filter(
      (expense) =>
        (categoryFilter === "ALL" || expense.category === categoryFilter) &&
        (!query ||
          expense.description.toLowerCase().includes(query) ||
          getExpenseCategoryLabel(expense.category).toLowerCase().includes(query)),
    );
  }, [periodExpenses, categoryFilter, search]);
  const listedTotal = sum(listedExpenses.map((expense) => expense.amount));
  const totalPages = Math.max(1, Math.ceil(listedExpenses.length / EXPENSE_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageExpenses = listedExpenses.slice((safePage - 1) * EXPENSE_PAGE_SIZE, safePage * EXPENSE_PAGE_SIZE);

  function changePeriod(update: () => void) {
    update();
    setGranularityChoice(null);
    setCurrentPage(1);
  }

  function handleSaved(message: string) {
    setFormTarget(null);
    setDeleteTarget(null);
    setNotice(message);
    router.refresh();
  }

  function downloadCsv() {
    const header = ["Date", "Category", "Description", "Amount", "Recurring", "Logged by"];
    const rows = listedExpenses.map((expense) => [
      expense.expenseDate,
      getExpenseCategoryLabel(expense.category),
      expense.description,
      expense.amount.toFixed(2),
      expense.recurringExpenseId ? "Yes" : "",
      expense.updatedByEmail || expense.createdByEmail || "",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    triggerDownload(
      new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }),
      `uno-rally-expenses-${period.start}-to-${period.end}.csv`,
    );
  }

  function downloadExcel() {
    setExportError(null);
    startExport(async () => {
      const result = await exportProfitReport({
        periodLabel: period.label,
        periodStart: period.start,
        periodEnd: period.end,
        groupingLabel: GRANULARITY_LABELS[granularity],
        summary: {
          revenue: totals.revenue,
          bookingValue: totals.bookingValue,
          outstanding: totals.outstanding,
          expenses: totals.expenses,
          profit: totals.profit,
          bookings: totals.bookings,
        },
        previous:
          previousPeriod && previousTotals
            ? {
                label: previousPeriod.label,
                revenue: previousTotals.revenue,
                expenses: previousTotals.expenses,
                profit: previousTotals.profit,
              }
            : null,
        trend: trend
          .filter((point) => point.inPeriod)
          .map(({ label, start, end, revenue, expenses, profit }) => ({ label, start, end, revenue, expenses, profit })),
        expenses: periodExpenses.map((expense) => ({
          date: expense.expenseDate,
          category: getExpenseCategoryLabel(expense.category),
          description: expense.description,
          amount: expense.amount,
          recurring: Boolean(expense.recurringExpenseId),
          loggedBy: expense.updatedByEmail || expense.createdByEmail || "",
        })),
        byCategory: categoryBreakdown.map((item) => ({ label: item.label, amount: item.amount })),
        byCourt,
        bySlot,
      });
      if (!result.ok) {
        setExportError(result.error);
        return;
      }
      const bytes = Uint8Array.from(atob(result.base64), (character) => character.charCodeAt(0));
      triggerDownload(
        new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        result.fileName,
      );
    });
  }

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-lime-300">
            Expenses &amp; profit
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-white">{period.label}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Confirmed booking revenue minus expenses, by play date.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 px-4 font-display text-xs font-bold uppercase tracking-[0.14em] text-zinc-300 transition hover:border-white/25 hover:text-white disabled:cursor-wait disabled:opacity-60"
            disabled={exporting}
            type="button"
            onClick={downloadExcel}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {exporting ? "Preparing..." : "Export Excel"}
          </button>
          <button
            className="premium-button inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 font-display text-xs font-bold uppercase tracking-[0.16em] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canEdit}
            type="button"
            onClick={() => {
              setNotice(null);
              setFormTarget({ kind: "new" });
            }}
          >
            <Plus className="h-4 w-4" />
            Add expense
          </button>
        </div>
      </div>

      {!data.expensesReady ? (
        <Banner tone="amber">
          Expense tracking isn&apos;t set up in the database yet. Run{" "}
          <code className="rounded bg-black/40 px-1">supabase/migrations/20261125000000_add_expenses.sql</code>{" "}
          in the Supabase SQL editor, then reload this page.
        </Banner>
      ) : !data.recurringReady ? (
        <Banner tone="amber">
          Recurring expenses aren&apos;t set up yet. Run{" "}
          <code className="rounded bg-black/40 px-1">supabase/migrations/20261125020000_add_recurring_expenses.sql</code>{" "}
          to turn them on.
        </Banner>
      ) : null}
      {lockError ? <Banner tone="amber">{lockError}</Banner> : null}
      {exportError ? (
        <Banner tone="amber" onDismiss={() => setExportError(null)}>
          {exportError}
        </Banner>
      ) : null}
      {notice ? (
        <Banner tone="lime" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      ) : null}

      <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950 p-3 md:grid-cols-[auto_1fr] md:items-end">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Period</p>
          <div className="flex w-fit flex-wrap rounded-xl border border-white/10 bg-black/30 p-1">
            {PERIOD_OPTIONS.map(([value, label]) => (
              <button
                aria-pressed={mode === value}
                className={[
                  "h-8 cursor-pointer rounded-lg px-3 text-xs font-bold uppercase tracking-[0.1em] transition",
                  mode === value ? "bg-white text-black" : "text-zinc-400 hover:bg-white/[0.08] hover:text-white",
                ].join(" ")}
                key={value}
                type="button"
                onClick={() => changePeriod(() => setMode(value))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          {mode === "month" ? (
            <PeriodInput label="Month">
              <input
                className={periodInputClass}
                type="month"
                value={month}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) changePeriod(() => setMonth(value));
                }}
              />
            </PeriodInput>
          ) : null}
          {mode === "year" ? (
            <PeriodInput label="Year">
              <select
                className={periodInputClass}
                value={year}
                onChange={(event) => {
                  const value = event.target.value;
                  changePeriod(() => setYear(value));
                }}
              >
                {yearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </PeriodInput>
          ) : null}
          {mode === "range" ? (
            <>
              <PeriodInput label="From">
                <input
                  className={periodInputClass}
                  max={rangeTo}
                  type="date"
                  value={rangeFrom}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value) changePeriod(() => setRangeFrom(value));
                  }}
                />
              </PeriodInput>
              <PeriodInput label="To">
                <input
                  className={periodInputClass}
                  min={rangeFrom}
                  type="date"
                  value={rangeTo}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value) changePeriod(() => setRangeTo(value));
                  }}
                />
              </PeriodInput>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          change={compare(totals.revenue, previousTotals?.revenue)}
          icon={<CircleDollarSign className="h-5 w-5" />}
          label="Revenue collected"
          note={`${totals.bookings} confirmed booking${totals.bookings === 1 ? "" : "s"}`}
          previousLabel={previousPeriod?.label}
          value={formatPeso(totals.revenue)}
        />
        <Metric
          change={compare(totals.expenses, previousTotals?.expenses)}
          icon={<ReceiptText className="h-5 w-5" />}
          invertTone
          label="Expenses"
          note={`${periodExpenses.length} expense${periodExpenses.length === 1 ? "" : "s"} logged`}
          previousLabel={previousPeriod?.label}
          value={formatPeso(totals.expenses)}
        />
        <Metric
          accent={totals.profit >= 0 ? "lime" : "red"}
          change={compare(totals.profit, previousTotals?.profit)}
          icon={totals.profit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          label={totals.profit >= 0 ? "Net profit" : "Net loss"}
          note="Revenue collected minus expenses"
          previousLabel={previousPeriod?.label}
          value={formatPeso(totals.profit)}
        />
        <Metric
          icon={<TrendingUp className="h-5 w-5" />}
          label="Profit margin"
          note={`${formatPeso(totals.outstanding)} still to collect on these bookings`}
          value={totals.margin === null ? "—" : `${Math.round(totals.margin)}%`}
        />
      </div>

      <div className="mt-6">
        <ProfitTrendChart
          granularity={granularity}
          points={trend}
          tooMany={buckets === null}
          onGranularityChange={setGranularityChoice}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <RevenueBreakdownCard
          emptyText="No booking revenue in this period."
          items={byCourt}
          subtitle="Collected per court."
          title="Revenue by court"
        />
        <RevenueBreakdownCard
          emptyText="No booking revenue in this period."
          items={bySlot}
          subtitle="Collected per rate band."
          title="Revenue by time slot"
        />
        <CategoryBreakdown items={categoryBreakdown} total={totals.expenses} />
      </div>

      {data.recurringReady ? (
        <RecurringExpensesCard
          canEdit={canEdit}
          items={data.recurring}
          onChanged={handleSaved}
          onEdit={(recurring) => {
            setNotice(null);
            setFormTarget({ kind: "recurring", recurring });
          }}
        />
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-white">Expenses</h3>
              <p className="mt-1 text-xs text-zinc-400">
                {listedExpenses.length} item{listedExpenses.length === 1 ? "" : "s"} · {formatPeso(listedTotal)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 focus-within:border-lime-300/45 sm:w-64">
                <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                <span className="sr-only">Search expenses</span>
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-400"
                  placeholder="Search descriptions"
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </label>
              <button
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-bold text-zinc-400 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!listedExpenses.length}
                type="button"
                onClick={downloadCsv}
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={categoryFilter === "ALL"}
              label="All categories"
              onClick={() => {
                setCategoryFilter("ALL");
                setCurrentPage(1);
              }}
            />
            {expenseCategories.map((category) => (
              <FilterChip
                active={categoryFilter === category.value}
                key={category.value}
                label={category.label}
                onClick={() => {
                  setCategoryFilter(category.value);
                  setCurrentPage(1);
                }}
              />
            ))}
          </div>
        </div>

        {pageExpenses.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="border-b border-white/10 bg-white/[0.035]">
                <tr className="font-display text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                  <th className="px-4 py-3" scope="col">Date</th>
                  <th className="px-4 py-3" scope="col">Category</th>
                  <th className="px-4 py-3" scope="col">Description</th>
                  <th className="px-4 py-3 text-right" scope="col">Amount</th>
                  <th className="px-4 py-3" scope="col">Logged by</th>
                  <th className="px-4 py-3 text-right" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.07]">
                {pageExpenses.map((expense) => (
                  <tr className="transition hover:bg-white/[0.025]" key={expense.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-300">{formatDateLabel(expense.expenseDate)}</td>
                    <td className="px-4 py-3">
                      <CategoryBadge category={expense.category} />
                    </td>
                    <td className="max-w-[18rem] px-4 py-3 text-sm text-white">
                      <p className="flex items-center gap-2">
                        <span className="truncate" title={expense.description}>
                          {expense.description}
                        </span>
                        {expense.recurringExpenseId ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-300/25 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-cyan-200" title="Added by a recurring expense">
                            <Repeat className="h-3 w-3" />
                            Monthly
                          </span>
                        ) : null}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-bold text-white">{formatPeso(expense.amount)}</td>
                    <td className="max-w-[12rem] px-4 py-3 text-xs text-zinc-400">
                      <p className="truncate" title={expense.updatedByEmail || expense.createdByEmail || ""}>
                        {expense.updatedByEmail || expense.createdByEmail || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <IconButton
                          disabled={!canEdit}
                          label={`Edit ${expense.description}`}
                          onClick={() => {
                            setNotice(null);
                            setFormTarget({ kind: "expense", expense });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          danger
                          disabled={!canEdit}
                          label={`Delete ${expense.description}`}
                          onClick={() => {
                            setNotice(null);
                            setDeleteTarget(expense);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-12 text-center text-sm text-zinc-400">
            {!data.expensesReady
              ? "Expenses will show here once tracking is set up."
              : search || categoryFilter !== "ALL"
                ? "No expenses match this search or category."
                : "No expenses logged for this period yet."}
          </p>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Expense pages" className="flex items-center justify-center gap-2 border-t border-white/10 px-4 py-4">
            <PageButton disabled={safePage === 1} onClick={() => setCurrentPage(safePage - 1)}>
              Previous
            </PageButton>
            <span className="px-2 text-xs text-zinc-400">
              Page {safePage} of {totalPages}
            </span>
            <PageButton disabled={safePage === totalPages} onClick={() => setCurrentPage(safePage + 1)}>
              Next
            </PageButton>
          </nav>
        ) : null}
      </div>

      {formTarget ? (
        <ExpenseFormModal
          canRepeat={data.recurringReady}
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      ) : null}
      {deleteTarget ? (
        <DeleteExpenseDialog
          expense={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => handleSaved("Expense deleted.")}
        />
      ) : null}
    </section>
  );
}

function summarize(data: ProfitDashboardData, period: Period) {
  const days = data.revenue.filter((day) => inPeriod(day.date, period));
  const revenue = sum(days.map((day) => day.collected));
  const bookingValue = sum(days.map((day) => day.bookingValue));
  const expenses = sum(
    data.expenses.filter((expense) => inPeriod(expense.expenseDate, period)).map((expense) => expense.amount),
  );
  const profit = Math.round((revenue - expenses) * 100) / 100;
  return {
    bookings: days.reduce((total, day) => total + day.bookingCount, 0),
    bookingValue,
    expenses,
    margin: revenue > 0 ? (profit / revenue) * 100 : null,
    outstanding: Math.max(0, bookingValue - revenue),
    profit,
    revenue,
  };
}

function buildTrendPoints(
  data: ProfitDashboardData,
  buckets: NonNullable<ReturnType<typeof buildTrendBuckets>>,
  granularity: Granularity,
): ProfitTrendPoint[] {
  const points = new Map<string, ProfitTrendPoint>(
    buckets.map((bucket) => [bucket.key, { ...bucket, revenue: 0, expenses: 0, profit: 0 }]),
  );
  const add = (date: string, field: "revenue" | "expenses", amount: number) => {
    const point = points.get(getBucketStart(date, granularity));
    if (point && date >= point.start && date <= point.end) point[field] += amount;
  };
  for (const day of data.revenue) add(day.date, "revenue", day.collected);
  for (const expense of data.expenses) add(expense.expenseDate, "expenses", expense.amount);
  return [...points.values()].map((point) => ({
    ...point,
    revenue: round2(point.revenue),
    expenses: round2(point.expenses),
    profit: round2(point.revenue - point.expenses),
  }));
}

type Change = { percent: number | null; difference: number } | null;

function compare(current: number, previous: number | undefined): Change {
  if (previous === undefined) return null;
  const difference = round2(current - previous);
  return {
    difference,
    percent: previous === 0 ? null : (difference / Math.abs(previous)) * 100,
  };
}

function DeleteExpenseDialog({
  expense,
  onClose,
  onDeleted,
}: {
  expense: Expense;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useDialogFocus(true, () => {
    if (!pending) onClose();
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4">
      <div
        aria-labelledby="delete-expense-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-xl border border-red-400/25 bg-zinc-950 p-5 shadow-2xl outline-none sm:rounded-2xl"
        ref={dialogRef}
        role="alertdialog"
        tabIndex={-1}
      >
        <h3 className="font-display text-base font-bold text-white" id="delete-expense-title">
          Delete this expense?
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          <span className="font-bold text-white">{expense.description}</span> · {formatPeso(expense.amount)} on{" "}
          {formatDateLabel(expense.expenseDate)}. This can&apos;t be undone.
          {expense.recurringExpenseId
            ? " Only this month is deleted; the recurring rule keeps adding future months."
            : ""}
        </p>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 cursor-pointer rounded-lg border border-white/10 px-4 font-display text-xs font-bold uppercase tracking-[0.14em] text-zinc-400 transition hover:border-white/25 hover:text-white disabled:opacity-60"
            disabled={pending}
            type="button"
            onClick={onClose}
          >
            Keep it
          </button>
          <button
            className="min-h-11 cursor-pointer rounded-lg border border-red-400/40 bg-red-500/15 px-4 font-display text-xs font-bold uppercase tracking-[0.14em] text-red-100 transition hover:bg-red-500/25 disabled:cursor-wait disabled:opacity-60"
            disabled={pending}
            type="button"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await deleteExpense(expense.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                onDeleted();
              });
            }}
          >
            {pending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryBreakdown({
  items,
  total,
}: {
  items: Array<{ value: ExpenseCategory; label: string; colorClass: string; amount: number; share: number }>;
  total: number;
}) {
  return (
    <figure className="rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Expenses by category</h3>
          <p className="mt-1 text-xs text-zinc-400">Where spending went this period.</p>
        </div>
        {total ? <p className="shrink-0 text-sm font-semibold text-white">{formatPeso(total)}</p> : null}
      </div>
      {items.length ? (
        <BreakdownBarList
          color={CHART_COLORS.expenses}
          items={items.map((item) => ({ key: item.value, label: item.label, value: item.amount }))}
          valueLabel="expenses"
        />
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-white/10 py-12 text-center text-sm text-zinc-400">
          No expenses in this period.
        </p>
      )}
    </figure>
  );
}

function Metric({
  accent = "neutral",
  change,
  icon,
  invertTone = false,
  label,
  note,
  previousLabel,
  value,
}: {
  accent?: "lime" | "red" | "neutral";
  change?: Change;
  icon: React.ReactNode;
  /** For expenses, going up is bad. */
  invertTone?: boolean;
  label: string;
  note: string;
  previousLabel?: string;
  value: string;
}) {
  const tone =
    accent === "lime"
      ? "border-lime-300/25 bg-lime-300/[0.07]"
      : accent === "red"
        ? "border-red-400/30 bg-red-400/[0.07]"
        : "border-white/10 bg-zinc-950";
  const iconTone = accent === "lime" ? "text-lime-200" : accent === "red" ? "text-red-200" : "text-zinc-400";
  const isGood = change ? (invertTone ? change.difference < 0 : change.difference > 0) : false;
  const changeTone =
    !change || change.difference === 0 ? "text-zinc-400" : isGood ? "text-lime-300" : "text-red-300";

  return (
    <article className={`rounded-2xl border p-4 ${tone}`}>
      <div className={iconTone}>{icon}</div>
      <p className="mt-4 text-xs font-bold text-zinc-400">{label}</p>
      <p className="mt-2 font-display text-xl font-bold text-white">{value}</p>
      {change ? (
        <p className={`mt-1.5 text-xs font-bold ${changeTone}`} title={previousLabel ? `Compared with ${previousLabel}` : undefined}>
          {change.difference === 0
            ? "No change"
            : `${change.difference > 0 ? "▲" : "▼"} ${
                change.percent === null ? formatPeso(Math.abs(change.difference)) : `${Math.abs(Math.round(change.percent))}%`
              }`}
          <span className="font-normal text-zinc-400"> vs {previousLabel || "previous period"}</span>
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-zinc-400">{note}</p>
    </article>
  );
}

function Banner({ children, onDismiss, tone }: { children: React.ReactNode; onDismiss?: () => void; tone: "amber" | "lime" }) {
  return (
    <div
      className={[
        "mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "amber"
          ? "border-amber-300/30 bg-amber-300/[0.08] text-amber-100"
          : "border-lime-300/30 bg-lime-300/[0.08] text-lime-100",
      ].join(" ")}
      role="status"
    >
      {tone === "amber" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : null}
      <p className="flex-1 leading-6">{children}</p>
      {onDismiss ? (
        <button aria-label="Dismiss" className="cursor-pointer opacity-70 hover:opacity-100" type="button" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function PeriodInput({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
      {label}
      {children}
    </label>
  );
}

const periodInputClass =
  "h-10 cursor-pointer rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm normal-case tracking-normal text-white outline-none transition [color-scheme:dark] hover:border-white/25 focus:border-lime-300/45";

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={[
        "h-8 cursor-pointer rounded-lg border px-3 text-xs font-bold transition",
        active
          ? "border-lime-300/35 bg-lime-300/12 text-lime-100"
          : "border-white/10 bg-white/[0.025] text-zinc-400 hover:border-white/25 hover:bg-white/[0.07] hover:text-white",
      ].join(" ")}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function CategoryBadge({ category }: { category: ExpenseCategory }) {
  const colorClass = expenseCategories.find((item) => item.value === category)?.colorClass || "bg-zinc-400";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-zinc-300">
      <span className={`h-2 w-2 rounded-full ${colorClass}`} />
      {getExpenseCategoryLabel(category)}
    </span>
  );
}

function IconButton({
  children,
  danger = false,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={[
        "grid h-9 w-9 cursor-pointer place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-35",
        danger
          ? "border-red-400/20 text-red-300 hover:border-red-400/50 hover:bg-red-400/10"
          : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white",
      ].join(" ")}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PageButton({ children, disabled, onClick }: { children: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button
      className="h-9 cursor-pointer rounded-lg border border-white/10 px-3 text-xs font-bold text-zinc-400 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function sum(values: number[]) {
  return round2(values.reduce((total, value) => total + value, 0));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function csvCell(value: string) {
  // Prefix formula-like cells so spreadsheet apps don't run them.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
