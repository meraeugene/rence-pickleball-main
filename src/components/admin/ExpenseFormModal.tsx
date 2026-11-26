"use client";

import { useState, useTransition } from "react";
import { Repeat, ReceiptText, X } from "lucide-react";
import {
  createExpense,
  updateExpense,
  updateRecurringExpense,
} from "@/actions/admin/manageExpenses";
import { expenseCategories } from "@/data/admin/expenseCategories";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type {
  Expense,
  ExpenseFieldName,
  RecurringExpense,
} from "@/types/admin/expense";
import { getManilaDateKey } from "@/utils/admin/getManilaDateKey";

type FieldErrors = Partial<Record<ExpenseFieldName, string>>;

export type ExpenseFormTarget =
  | { kind: "new" }
  | { kind: "expense"; expense: Expense }
  | { kind: "recurring"; recurring: RecurringExpense };

export function ExpenseFormModal({
  canRepeat,
  onClose,
  onSaved,
  target,
}: {
  /** Whether the "repeat every month" option is available. */
  canRepeat: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  target: ExpenseFormTarget;
}) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [pending, startTransition] = useTransition();
  const dialogRef = useDialogFocus(true, () => {
    if (!pending) onClose();
  });
  const today = getManilaDateKey(new Date());
  const expense = target.kind === "expense" ? target.expense : null;
  const recurring = target.kind === "recurring" ? target.recurring : null;
  const values = expense || recurring;

  const title =
    target.kind === "new"
      ? "Add expense"
      : target.kind === "expense"
        ? "Edit expense"
        : "Edit recurring expense";
  const subtitle =
    target.kind === "new"
      ? "Record money spent running the venue."
      : target.kind === "expense"
        ? expense?.recurringExpenseId
          ? "Changes apply to this month only, not the recurring rule."
          : "Changes update the profit totals right away."
        : "Changes apply to months not added yet. Past months stay as they are.";

  function submit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    if (expense) formData.set("id", expense.id);
    if (recurring) formData.set("id", recurring.id);
    if (target.kind === "new") formData.set("repeatMonthly", String(repeatMonthly));

    startTransition(async () => {
      const result =
        target.kind === "new"
          ? await createExpense(formData)
          : target.kind === "expense"
            ? await updateExpense(formData)
            : await updateRecurringExpense(formData);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors || {});
        return;
      }
      onSaved(result.message || "Saved.");
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div
        aria-labelledby="expense-form-title"
        aria-modal="true"
        className="max-h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-md overflow-y-auto overscroll-contain rounded-xl border border-white/15 bg-zinc-950 p-4 shadow-2xl outline-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-5"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-300/25 bg-rose-300/10 text-rose-200">
              {recurring ? <Repeat className="h-5 w-5" /> : <ReceiptText className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-white" id="expense-form-title">
                {title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-zinc-400">{subtitle}</p>
            </div>
          </div>
          <button
            aria-label="Close expense form"
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-white/10 text-zinc-400 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed"
            disabled={pending}
            type="button"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <form className="mt-4 grid gap-4" action={submit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            {recurring ? (
              <Field error={fieldErrors.dayOfMonth} label="Day of month">
                <select
                  aria-invalid={Boolean(fieldErrors.dayOfMonth)}
                  className={`${inputClass(Boolean(fieldErrors.dayOfMonth))} cursor-pointer`}
                  defaultValue={String(recurring.dayOfMonth)}
                  name="dayOfMonth"
                >
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>
                      {day}
                      {day > 28 ? " (or last day)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field
                error={fieldErrors.expenseDate}
                label={repeatMonthly ? "First date" : "Date"}
              >
                <input
                  aria-invalid={Boolean(fieldErrors.expenseDate)}
                  className={inputClass(Boolean(fieldErrors.expenseDate))}
                  defaultValue={expense?.expenseDate || today}
                  max="2100-12-31"
                  min="2020-01-01"
                  name="expenseDate"
                  required
                  type="date"
                />
              </Field>
            )}
            <Field error={fieldErrors.category} label="Category">
              <select
                aria-invalid={Boolean(fieldErrors.category)}
                className={`${inputClass(Boolean(fieldErrors.category))} cursor-pointer`}
                defaultValue={values?.category || ""}
                name="category"
                required
              >
                <option disabled value="">
                  Choose…
                </option>
                {expenseCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field error={fieldErrors.description} label="Description">
            <input
              aria-invalid={Boolean(fieldErrors.description)}
              className={inputClass(Boolean(fieldErrors.description))}
              defaultValue={values?.description || ""}
              maxLength={200}
              name="description"
              placeholder="e.g. Meralco bill"
              required
              type="text"
            />
          </Field>

          <Field error={fieldErrors.amount} label={recurring || repeatMonthly ? "Amount each month" : "Amount"}>
            <div
              className={[
                "flex items-center rounded-lg border bg-black/40 px-3 focus-within:border-lime-300/45",
                fieldErrors.amount ? "border-red-400/50" : "border-white/15",
              ].join(" ")}
            >
              <span className="text-sm text-zinc-400">PHP</span>
              <input
                aria-invalid={Boolean(fieldErrors.amount)}
                className="min-w-0 flex-1 bg-transparent px-2 py-3 text-base font-bold text-white outline-none sm:text-sm"
                defaultValue={values ? String(values.amount) : ""}
                inputMode="decimal"
                min="0.01"
                name="amount"
                placeholder="0.00"
                required
                step="0.01"
                type="number"
              />
            </div>
          </Field>

          {target.kind === "new" && canRepeat ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-3">
              <input
                checked={repeatMonthly}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-lime-300"
                type="checkbox"
                onChange={(event) => setRepeatMonthly(event.target.checked)}
              />
              <span className="text-xs leading-5 text-zinc-400">
                <span className="block font-bold text-zinc-200">Repeat every month</span>
                For rent, salaries, and bills. Added on the same day every month.
              </span>
            </label>
          ) : null}

          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="min-h-11 cursor-pointer rounded-lg border border-white/10 px-4 font-display text-xs font-bold uppercase tracking-[0.14em] text-zinc-400 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending}
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="premium-button min-h-11 cursor-pointer rounded-lg px-5 font-display text-xs font-bold uppercase tracking-[0.14em] disabled:cursor-wait disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? "Saving..." : target.kind === "new" ? "Add expense" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-xs font-bold text-zinc-300">
      {label}
      {children}
      {error ? <span className="text-xs font-semibold text-red-300">{error}</span> : null}
    </label>
  );
}

function inputClass(hasError: boolean) {
  return [
    "h-11 w-full min-w-0 rounded-lg border bg-black/40 px-3 text-base text-white outline-none transition [color-scheme:dark] focus:border-lime-300/45 sm:text-sm",
    hasError ? "border-red-400/50" : "border-white/15",
  ].join(" ");
}
