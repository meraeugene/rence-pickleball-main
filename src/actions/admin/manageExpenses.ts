"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expenseCategoryValues } from "@/data/admin/expenseCategories";
import type { ExpenseFieldName, ExpenseMutationResult } from "@/types/admin/expense";
import { getAdminMutationLockError } from "@/utils/admin/getAdminMutationLockError";
import { getManilaDateKey } from "@/utils/admin/getManilaDateKey";
import { isMissingExpensesTable } from "@/utils/admin/isMissingExpensesTable";
import { requireAdmin } from "@/utils/admin/requireAdmin";
import { createAdminClient } from "@/utils/supabase/admin";

const MISSING_TABLE_ERROR =
  "Expense tracking is not installed yet. Run the expenses migration in Supabase.";
const MISSING_RECURRING_ERROR =
  "Recurring expenses are not installed yet. Run the recurring-expenses migration in Supabase.";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.")
  .refine(
    (value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()),
    "Choose a valid date.",
  );

const baseFields = {
  category: z.enum(expenseCategoryValues, { message: "Choose a category." }),
  description: z
    .string()
    .trim()
    .min(1, "Add a short description.")
    .max(200, "Keep the description under 200 characters."),
  amount: z.coerce
    .number({ message: "Enter an amount." })
    .positive("Amount must be more than zero.")
    .max(9_999_999_999, "Amount is too large.")
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
      "Use at most 2 decimal places.",
    ),
};

const expenseSchema = z.object({ expenseDate: dateSchema, ...baseFields });
const recurringSchema = z.object({
  ...baseFields,
  dayOfMonth: z.coerce
    .number({ message: "Choose a day." })
    .int("Choose a day.")
    .min(1, "Choose a day from 1 to 31.")
    .max(31, "Choose a day from 1 to 31."),
});
const idSchema = z.uuid();

type AdminClient = ReturnType<typeof createAdminClient>;

function readBaseFields(formData: FormData) {
  return {
    category: String(formData.get("category") || ""),
    description: String(formData.get("description") || ""),
    amount: String(formData.get("amount") || "").trim() || undefined,
  };
}

function toFieldErrors(error: z.ZodError) {
  const fieldErrors: Partial<Record<ExpenseFieldName, string>> = {};
  const names: ExpenseFieldName[] = ["expenseDate", "category", "description", "amount", "dayOfMonth"];
  for (const issue of error.issues) {
    const field = issue.path[0] as ExpenseFieldName;
    if (names.includes(field) && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

function invalid(error: z.ZodError): ExpenseMutationResult {
  return { ok: false, error: "Check the highlighted fields.", fieldErrors: toFieldErrors(error) };
}

async function authorize(): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const adminUser = await requireAdmin();
  if (!adminUser?.email) return { ok: false, error: "Unauthorized." };
  const lockError = getAdminMutationLockError();
  if (lockError) return { ok: false, error: lockError };
  return { ok: true, email: adminUser.email.toLowerCase() };
}

function isMissingRecurring(error: { code?: string; message?: string }) {
  const message = (error.message || "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST202" ||
    message.includes("recurring_expense")
  );
}

async function runRecurringGenerator(admin: AdminClient) {
  const { data, error } = await admin.rpc("generate_recurring_expenses", {
    p_today: getManilaDateKey(new Date()),
  });
  if (error) console.error("generate_recurring_expenses failed", { code: error.code });
  return typeof data === "number" ? data : 0;
}

function done(message?: string): ExpenseMutationResult {
  revalidatePath("/admin");
  return { ok: true, message };
}

export async function createExpense(formData: FormData): Promise<ExpenseMutationResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const parsed = expenseSchema.safeParse({
    expenseDate: String(formData.get("expenseDate") || "").trim(),
    ...readBaseFields(formData),
  });
  if (!parsed.success) return invalid(parsed.error);

  const admin = createAdminClient();

  if (formData.get("repeatMonthly") === "true") {
    const { expenseDate, category, description, amount } = parsed.data;
    const { error } = await admin.from("recurring_expenses").insert({
      category,
      description,
      amount,
      day_of_month: Number(expenseDate.slice(8, 10)),
      start_month: `${expenseDate.slice(0, 7)}-01`,
      created_by_email: auth.email,
      updated_by_email: auth.email,
    });
    if (error) {
      if (isMissingRecurring(error)) return { ok: false, error: MISSING_RECURRING_ERROR };
      console.error("create recurring expense failed", { code: error.code });
      return { ok: false, error: "Unable to save this recurring expense." };
    }
    const added = await runRecurringGenerator(admin);
    return done(
      added
        ? `Recurring expense saved. Added ${added} month${added === 1 ? "" : "s"} so far.`
        : `Recurring expense saved. It will be added on ${expenseDate}.`,
    );
  }

  const { error } = await admin.from("expenses").insert({
    expense_date: parsed.data.expenseDate,
    category: parsed.data.category,
    description: parsed.data.description,
    amount: parsed.data.amount,
    created_by_email: auth.email,
    updated_by_email: auth.email,
  });

  if (error) {
    if (isMissingExpensesTable(error)) return { ok: false, error: MISSING_TABLE_ERROR };
    console.error("createExpense failed", { code: error.code });
    return { ok: false, error: "Unable to save this expense." };
  }

  return done("Expense added.");
}

export async function updateExpense(formData: FormData): Promise<ExpenseMutationResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const id = idSchema.safeParse(String(formData.get("id") || ""));
  if (!id.success) return { ok: false, error: "This expense could not be found." };

  const parsed = expenseSchema.safeParse({
    expenseDate: String(formData.get("expenseDate") || "").trim(),
    ...readBaseFields(formData),
  });
  if (!parsed.success) return invalid(parsed.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("expenses")
    .update({
      expense_date: parsed.data.expenseDate,
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount,
      updated_by_email: auth.email,
    })
    .eq("id", id.data)
    .select("id");

  if (error) {
    if (isMissingExpensesTable(error)) return { ok: false, error: MISSING_TABLE_ERROR };
    console.error("updateExpense failed", { code: error.code });
    return { ok: false, error: "Unable to update this expense." };
  }
  if (!data?.length) return { ok: false, error: "This expense was already deleted." };

  return done("Expense updated.");
}

export async function deleteExpense(expenseId: string): Promise<ExpenseMutationResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const id = idSchema.safeParse(expenseId);
  if (!id.success) return { ok: false, error: "This expense could not be found." };

  const admin = createAdminClient();
  const { error } = await admin.from("expenses").delete().eq("id", id.data);

  if (error) {
    if (isMissingExpensesTable(error)) return { ok: false, error: MISSING_TABLE_ERROR };
    console.error("deleteExpense failed", { code: error.code });
    return { ok: false, error: "Unable to delete this expense." };
  }

  return done("Expense deleted.");
}

/** Edits a recurring expense. Only months not yet added are affected. */
export async function updateRecurringExpense(formData: FormData): Promise<ExpenseMutationResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const id = idSchema.safeParse(String(formData.get("id") || ""));
  if (!id.success) return { ok: false, error: "This recurring expense could not be found." };

  const parsed = recurringSchema.safeParse({
    ...readBaseFields(formData),
    dayOfMonth: String(formData.get("dayOfMonth") || "").trim() || undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("recurring_expenses")
    .update({
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount,
      day_of_month: parsed.data.dayOfMonth,
      updated_by_email: auth.email,
    })
    .eq("id", id.data)
    .select("id");

  if (error) {
    if (isMissingRecurring(error)) return { ok: false, error: MISSING_RECURRING_ERROR };
    console.error("updateRecurringExpense failed", { code: error.code });
    return { ok: false, error: "Unable to update this recurring expense." };
  }
  if (!data?.length) return { ok: false, error: "This recurring expense was already deleted." };

  await runRecurringGenerator(admin);
  return done("Recurring expense updated. Changes apply to upcoming months.");
}

/**
 * Pauses or resumes a recurring expense. Resuming skips the paused months, so
 * only the current month onward is added.
 */
export async function setRecurringExpenseActive(
  recurringId: string,
  active: boolean,
): Promise<ExpenseMutationResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const id = idSchema.safeParse(recurringId);
  if (!id.success) return { ok: false, error: "This recurring expense could not be found." };

  const admin = createAdminClient();
  const update: Record<string, unknown> = { active: Boolean(active), updated_by_email: auth.email };

  if (active) {
    const { data: current, error: readError } = await admin
      .from("recurring_expenses")
      .select("last_generated_month")
      .eq("id", id.data)
      .maybeSingle();
    if (readError || !current) {
      return { ok: false, error: "This recurring expense could not be found." };
    }
    const today = getManilaDateKey(new Date());
    const [year, month] = today.split("-").map(Number);
    const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
    const last = (current as { last_generated_month: string | null }).last_generated_month;
    if (!last || last < previousMonth) update.last_generated_month = previousMonth;
  }

  const { data, error } = await admin
    .from("recurring_expenses")
    .update(update)
    .eq("id", id.data)
    .select("id");

  if (error) {
    if (isMissingRecurring(error)) return { ok: false, error: MISSING_RECURRING_ERROR };
    console.error("setRecurringExpenseActive failed", { code: error.code });
    return { ok: false, error: "Unable to update this recurring expense." };
  }
  if (!data?.length) return { ok: false, error: "This recurring expense was already deleted." };

  if (active) await runRecurringGenerator(admin);
  return done(active ? "Recurring expense resumed." : "Recurring expense paused.");
}

/** Deletes the recurring rule. Expenses it already added are kept. */
export async function deleteRecurringExpense(recurringId: string): Promise<ExpenseMutationResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const id = idSchema.safeParse(recurringId);
  if (!id.success) return { ok: false, error: "This recurring expense could not be found." };

  const admin = createAdminClient();
  const { error } = await admin.from("recurring_expenses").delete().eq("id", id.data);

  if (error) {
    if (isMissingRecurring(error)) return { ok: false, error: MISSING_RECURRING_ERROR };
    console.error("deleteRecurringExpense failed", { code: error.code });
    return { ok: false, error: "Unable to delete this recurring expense." };
  }

  return done("Recurring expense removed. Expenses it already added were kept.");
}
