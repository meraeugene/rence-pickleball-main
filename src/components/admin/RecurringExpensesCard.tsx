"use client";

import { useState, useTransition } from "react";
import { Pause, Pencil, Play, Repeat, Trash2 } from "lucide-react";
import {
  deleteRecurringExpense,
  setRecurringExpenseActive,
} from "@/actions/admin/manageExpenses";
import { getExpenseCategoryLabel } from "@/data/admin/expenseCategories";
import type { RecurringExpense } from "@/types/admin/expense";
import { formatPeso } from "@/utils/admin/formatProfitPeso";
import { formatMonthLabel } from "@/utils/admin/profitPeriods";

export function RecurringExpensesCard({
  canEdit,
  items,
  onChanged,
  onEdit,
}: {
  canEdit: boolean;
  items: RecurringExpense[];
  onChanged: (message: string) => void;
  onEdit: (item: RecurringExpense) => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const monthlyTotal = items
    .filter((item) => item.active)
    .reduce((sum, item) => sum + item.amount, 0);

  function run(id: string, action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await action();
      setPendingId(null);
      setConfirmId(null);
      if (!result.ok) {
        setError(result.error || "Something went wrong.");
        return;
      }
      onChanged(result.message || "Saved.");
    });
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
      <div className="flex flex-col gap-1 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-zinc-400" />
          <h3 className="font-display text-sm font-bold text-white">Recurring expenses</h3>
        </div>
        <p className="text-xs text-zinc-400">
          {formatPeso(monthlyTotal)} per month from {items.filter((item) => item.active).length} active
        </p>
      </div>
      {error ? (
        <p className="mx-4 mt-3 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100" role="alert">
          {error}
        </p>
      ) : null}
      {items.length ? (
        <ul className="divide-y divide-white/[0.07]">
          {items.map((item) => {
            const busy = pendingId === item.id;
            return (
              <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
                <div className={`min-w-0 ${item.active ? "" : "opacity-50"}`}>
                  <p className="truncate text-sm font-bold text-white">
                    {item.description}
                    {!item.active ? (
                      <span className="ml-2 rounded-full border border-white/15 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-zinc-400">
                        Paused
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {formatPeso(item.amount)} · {getExpenseCategoryLabel(item.category)} · day{" "}
                    {item.dayOfMonth} of each month · since {formatMonthLabel(item.startMonth)}
                  </p>
                </div>
                {confirmId === item.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-zinc-400">Stop and remove this rule?</span>
                    <SmallButton disabled={busy} onClick={() => setConfirmId(null)}>Keep</SmallButton>
                    <SmallButton danger disabled={busy} onClick={() => run(item.id, () => deleteRecurringExpense(item.id))}>
                      {busy ? "Removing..." : "Remove"}
                    </SmallButton>
                  </div>
                ) : (
                  <div className="flex shrink-0 gap-2">
                    <SmallButton disabled={!canEdit || busy} label="Edit" onClick={() => onEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </SmallButton>
                    <SmallButton
                      disabled={!canEdit || busy}
                      label={item.active ? "Pause" : "Resume"}
                      onClick={() => run(item.id, () => setRecurringExpenseActive(item.id, !item.active))}
                    >
                      {item.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </SmallButton>
                    <SmallButton danger disabled={!canEdit || busy} label="Remove" onClick={() => setConfirmId(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </SmallButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-8 text-center text-sm text-zinc-400">
          No recurring expenses yet. Turn on &quot;Repeat every month&quot; when adding rent, salaries, or bills.
        </p>
      )}
      <p className="border-t border-white/10 px-4 py-3 text-xs leading-5 text-zinc-400">
        Added to your expenses automatically each month. Removing a rule keeps past entries.
      </p>
    </section>
  );
}

function SmallButton({
  children,
  danger = false,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  disabled: boolean;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={[
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
        danger
          ? "border-red-400/25 text-red-300 hover:border-red-400/50 hover:bg-red-400/10"
          : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white",
      ].join(" ")}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
      {label ? <span className="hidden sm:inline">{label}</span> : null}
    </button>
  );
}
