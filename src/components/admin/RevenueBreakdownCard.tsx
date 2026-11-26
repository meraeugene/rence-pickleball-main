"use client";

import { formatPeso } from "@/utils/admin/formatProfitPeso";
import { BreakdownBarList } from "./BreakdownBarList";
import { CHART_COLORS } from "@/data/admin/chartColors";

export type RevenueBreakdownItem = {
  label: string;
  collected: number;
  bookingValue: number;
};

export function RevenueBreakdownCard({
  emptyText,
  items,
  subtitle,
  title,
}: {
  emptyText: string;
  items: RevenueBreakdownItem[];
  subtitle: string;
  title: string;
}) {
  const total = items.reduce((sum, item) => sum + item.collected, 0);

  return (
    <figure className="rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
        </div>
        {total > 0 ? (
          <p className="shrink-0 text-sm font-semibold text-white">{formatPeso(total)}</p>
        ) : null}
      </div>
      {items.length && total > 0 ? (
        <BreakdownBarList
          color={CHART_COLORS.revenue}
          items={items.map((item) => ({
            key: item.label,
            label: item.label,
            value: item.collected,
            detail:
              item.bookingValue > item.collected
                ? `${formatPeso(item.bookingValue - item.collected)} still to collect`
                : undefined,
          }))}
          valueLabel="revenue"
        />
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-white/10 py-12 text-center text-sm text-zinc-400">
          {emptyText}
        </p>
      )}
    </figure>
  );
}
