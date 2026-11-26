"use client";

import { useState } from "react";
import { formatPeso } from "@/utils/admin/formatProfitPeso";
import { CHART_COLORS } from "@/data/admin/chartColors";

export type BreakdownBar = {
  key: string;
  label: string;
  value: number;
  detail?: string;
};

// Horizontal bars for one measure, one color. Hover, tap or focus a row to see its details.
export function BreakdownBarList({
  color,
  items,
  valueLabel,
}: {
  color: string;
  items: BreakdownBar[];
  valueLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <ul
      className="mt-4 grid gap-0.5"
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setActive(null);
      }}
    >
      {items.map((item) => {
        const share = total ? (item.value / total) * 100 : 0;
        const isActive = active === item.key;
        const dimmed = active !== null && !isActive;
        return (
          <li key={item.key}>
            <div
              aria-label={`${item.label}: ${formatPeso(item.value)}, ${formatShare(share)} of ${valueLabel}${item.detail ? `. ${item.detail}` : ""}`}
              className={[
                "relative cursor-pointer rounded-lg px-2 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/30",
                isActive ? "bg-white/[0.05]" : "hover:bg-white/[0.03]",
              ].join(" ")}
              role="button"
              tabIndex={0}
              onBlur={() => setActive(null)}
              onClick={() => setActive(item.key)}
              onFocus={() => setActive(item.key)}
              onPointerEnter={() => setActive(item.key)}
            >
              <div className="mb-2 flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-medium text-zinc-200">{item.label}</span>
                <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                  <span className="text-zinc-400">{formatShare(share)}</span>
                  <span className="font-semibold text-white">{formatPeso(item.value)}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: CHART_COLORS.track }}>
                <div
                  className="h-full rounded-full transition-opacity duration-150"
                  style={{
                    background: color,
                    opacity: dimmed ? 0.35 : 1,
                    width: `${Math.max(1.5, (item.value / max) * 100)}%`,
                  }}
                />
              </div>
              {isActive ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-full right-2 z-10 mb-1 min-w-44 rounded-xl border border-white/10 bg-zinc-900/95 px-3.5 py-2.5 text-xs shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur"
                >
                  <p className="flex items-center gap-2 font-semibold text-white">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
                    {item.label}
                  </p>
                  <p className="mt-1.5 flex justify-between gap-4 text-zinc-400">
                    Amount
                    <span className="font-semibold tabular-nums text-white">{formatPeso(item.value)}</span>
                  </p>
                  <p className="mt-1 flex justify-between gap-4 text-zinc-400">
                    Share of {valueLabel}
                    <span className="tabular-nums text-zinc-100">{formatShare(share)}</span>
                  </p>
                  {item.detail ? <p className="mt-1.5 border-t border-white/10 pt-1.5 text-zinc-300">{item.detail}</p> : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function formatShare(share: number) {
  if (share > 0 && share < 1) return "<1%";
  return `${Math.round(share)}%`;
}
