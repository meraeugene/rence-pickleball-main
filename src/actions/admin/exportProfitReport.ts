"use server";

import ExcelJS from "exceljs";
import { z } from "zod";
import { requireAdmin } from "@/utils/admin/requireAdmin";

const money = z.number().finite();
const text = z.string().max(300);

const reportSchema = z.object({
  periodLabel: text,
  periodStart: text,
  periodEnd: text,
  groupingLabel: text,
  summary: z.object({
    revenue: money,
    bookingValue: money,
    outstanding: money,
    expenses: money,
    profit: money,
    bookings: z.number().int().nonnegative(),
  }),
  previous: z
    .object({ label: text, revenue: money, expenses: money, profit: money })
    .nullable(),
  trend: z
    .array(z.object({ label: text, start: text, end: text, revenue: money, expenses: money, profit: money }))
    .max(1000),
  expenses: z
    .array(
      z.object({
        date: text,
        category: text,
        description: text,
        amount: money,
        recurring: z.boolean(),
        loggedBy: text,
      }),
    )
    .max(20000),
  byCategory: z.array(z.object({ label: text, amount: money })).max(50),
  byCourt: z.array(z.object({ label: text, collected: money, bookingValue: money })).max(200),
  bySlot: z.array(z.object({ label: text, collected: money, bookingValue: money })).max(200),
});

export type ProfitReportInput = z.infer<typeof reportSchema>;

const PESO_FORMAT = '"₱"#,##0.00;[Red]-"₱"#,##0.00';

/** Builds an .xlsx report of the dashboard's current view. Returns base64. */
export async function exportProfitReport(
  input: ProfitReportInput,
): Promise<{ ok: true; base64: string; fileName: string } | { ok: false; error: string }> {
  const adminUser = await requireAdmin();
  if (!adminUser) return { ok: false, error: "Unauthorized." };

  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The report data is invalid. Reload and try again." };
  const report = parsed.data;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "UNO RALLY admin";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Item", key: "item", width: 34 },
    { header: "Amount", key: "amount", width: 18 },
  ];
  const margin = report.summary.revenue > 0 ? report.summary.profit / report.summary.revenue : null;
  summary.addRows([
    { item: `Period: ${report.periodLabel} (${report.periodStart} to ${report.periodEnd})` },
    {},
    { item: "Revenue collected", amount: report.summary.revenue },
    { item: "Expenses", amount: report.summary.expenses },
    { item: report.summary.profit >= 0 ? "Net profit" : "Net loss", amount: report.summary.profit },
    { item: "Profit margin", amount: margin === null ? "—" : margin },
    { item: "Booking value (paid + unpaid)", amount: report.summary.bookingValue },
    { item: "Still to collect", amount: report.summary.outstanding },
    { item: "Confirmed bookings", amount: report.summary.bookings },
  ]);
  if (report.previous) {
    summary.addRows([
      {},
      { item: `Previous period: ${report.previous.label}` },
      { item: "Revenue collected", amount: report.previous.revenue },
      { item: "Expenses", amount: report.previous.expenses },
      { item: "Net profit", amount: report.previous.profit },
    ]);
  }
  summary.getColumn("amount").numFmt = PESO_FORMAT;
  // Row 1 is the header; margin is row 7 and the booking count is row 10.
  summary.getCell("B7").numFmt = "0%";
  summary.getCell("B10").numFmt = "0";
  styleHeader(summary);

  const trend = workbook.addWorksheet(`Trend (${report.groupingLabel})`.slice(0, 31));
  trend.columns = [
    { header: "Period", key: "label", width: 16 },
    { header: "From", key: "start", width: 13 },
    { header: "To", key: "end", width: 13 },
    { header: "Revenue", key: "revenue", width: 16, style: { numFmt: PESO_FORMAT } },
    { header: "Expenses", key: "expenses", width: 16, style: { numFmt: PESO_FORMAT } },
    { header: "Profit", key: "profit", width: 16, style: { numFmt: PESO_FORMAT } },
  ];
  trend.addRows(report.trend);
  styleHeader(trend);

  const expenses = workbook.addWorksheet("Expenses");
  expenses.columns = [
    { header: "Date", key: "date", width: 13 },
    { header: "Category", key: "category", width: 18 },
    { header: "Description", key: "description", width: 40 },
    { header: "Amount", key: "amount", width: 16, style: { numFmt: PESO_FORMAT } },
    { header: "Recurring", key: "recurring", width: 11 },
    { header: "Logged by", key: "loggedBy", width: 30 },
  ];
  expenses.addRows(report.expenses.map((row) => ({ ...row, recurring: row.recurring ? "Yes" : "" })));
  styleHeader(expenses);

  const categories = workbook.addWorksheet("By category");
  categories.columns = [
    { header: "Category", key: "label", width: 20 },
    { header: "Amount", key: "amount", width: 16, style: { numFmt: PESO_FORMAT } },
  ];
  categories.addRows(report.byCategory);
  styleHeader(categories);

  for (const [name, rows] of [
    ["By court", report.byCourt],
    ["By time slot", report.bySlot],
  ] as const) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [
      { header: name === "By court" ? "Court" : "Time slot", key: "label", width: 20 },
      { header: "Revenue collected", key: "collected", width: 18, style: { numFmt: PESO_FORMAT } },
      { header: "Booking value", key: "bookingValue", width: 16, style: { numFmt: PESO_FORMAT } },
    ];
    sheet.addRows(rows);
    styleHeader(sheet);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeLabel = report.periodLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return {
    ok: true,
    base64: Buffer.from(buffer as ArrayBuffer).toString("base64"),
    fileName: `uno-rally-profit-${safeLabel || "report"}.xlsx`,
  };
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F5C8" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}
