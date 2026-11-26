"use client";

import { useEffect, useRef, useState } from "react";
import type { Granularity } from "@/utils/admin/profitPeriods";
import { formatCompactPeso, formatPeso } from "@/utils/admin/formatProfitPeso";
import { CHART_COLORS } from "@/data/admin/chartColors";

export type ProfitTrendPoint = {
  key: string;
  label: string;
  start: string;
  end: string;
  revenue: number;
  expenses: number;
  profit: number;
  inPeriod: boolean;
};

const GRANULARITY_OPTIONS: Array<[Granularity, string]> = [
  ["day", "Daily"],
  ["week", "Weekly"],
  ["month", "Monthly"],
  ["year", "Yearly"],
];

const HEIGHT = 300;
const LEFT = 60;
const RIGHT = 12;
const TOP = 20;
const BOTTOM = 32;
const TOOLTIP_WIDTH = 184;
const TOOLTIP_GAP = 10;

export function ProfitTrendChart({
  granularity,
  onGranularityChange,
  points,
  tooMany,
}: {
  granularity: Granularity;
  onGranularityChange: (value: Granularity) => void;
  points: ProfitTrendPoint[];
  tooMany: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.max(320, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [tooMany, points.length]);

  const minSlot = granularity === "day" ? 26 : granularity === "week" ? 44 : 64;
  const width = Math.max(containerWidth, LEFT + RIGHT + points.length * minSlot);
  const plotWidth = width - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.revenue, point.expenses, point.profit]));
  const minValue = Math.min(0, ...points.map((point) => point.profit));
  const roundedMax = niceCeil(maxValue);
  const roundedMin = minValue < 0 ? -niceCeil(-minValue) : 0;
  const span = roundedMax - roundedMin || 1;
  const yFor = (value: number) => TOP + ((roundedMax - value) / span) * plotHeight;
  const slot = plotWidth / Math.max(1, points.length);
  const barWidth = Math.max(3, Math.min(16, (slot - 12) / 2));
  const zeroY = yFor(0);
  const gridValues = Array.from({ length: 5 }, (_, index) => roundedMax - (span * index) / 4);
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotWidth / 60))));
  const centerFor = (index: number) => LEFT + slot * (index + 0.5);
  const profitPath = points
    .map((point, index) => `${index ? "L" : "M"} ${centerFor(index)} ${yFor(point.profit)}`)
    .join(" ");
  const hasData = points.some((point) => point.revenue || point.expenses);
  const activePoint = active === null ? null : points[active];
  const showMarkers = points.length <= 24;
  const periodPoints = points.filter((point) => point.inPeriod);
  const totals = {
    revenue: periodPoints.reduce((sum, point) => sum + point.revenue, 0),
    expenses: periodPoints.reduce((sum, point) => sum + point.expenses, 0),
    profit: periodPoints.reduce((sum, point) => sum + point.profit, 0),
  };

  return (
    <figure className="min-w-0 rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Revenue, expenses and profit</h3>
          <p className="mt-1 text-xs text-zinc-400">Hover or tap a period to see its numbers.</p>
        </div>
        <div className="flex w-fit rounded-lg border border-white/10 bg-black/30 p-1" role="group" aria-label="Chart grouping">
          {GRANULARITY_OPTIONS.map(([value, label]) => (
            <button
              aria-pressed={granularity === value}
              className={[
                "h-8 cursor-pointer rounded-md px-3 text-xs font-medium transition",
                granularity === value ? "bg-white text-black" : "text-zinc-400 hover:bg-white/[0.08] hover:text-white",
              ].join(" ")}
              key={value}
              type="button"
              onClick={() => onGranularityChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-white/[0.06] py-3">
        <LegendStat color={CHART_COLORS.revenue} label="Revenue" shape="bar" value={totals.revenue} />
        <LegendStat color={CHART_COLORS.expenses} label="Expenses" shape="bar" value={totals.expenses} />
        <LegendStat color={CHART_COLORS.profit} label="Profit" shape="line" value={totals.profit} />
      </dl>

      {tooMany ? (
        <p className="mt-5 rounded-xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-400">
          Too many periods to show. Pick a shorter range or a wider grouping.
        </p>
      ) : points.length && hasData ? (
        <div className="relative mt-3" ref={containerRef}>
          <div
            className="overflow-x-auto"
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setActive(null);
            }}
            onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          >
            <svg
              aria-label="Revenue and expenses by period, with profit as a line"
              className="block h-auto select-none"
              role="img"
              style={{ width: `${width}px` }}
              viewBox={`0 0 ${width} ${HEIGHT}`}
            >
              {gridValues.map((value) => (
                <g key={value}>
                  {value !== 0 ? (
                    <line
                      stroke={CHART_COLORS.grid}
                      strokeDasharray="3 4"
                      x1={LEFT}
                      x2={width - RIGHT}
                      y1={yFor(value)}
                      y2={yFor(value)}
                    />
                  ) : null}
                  <text fill={CHART_COLORS.axisText} fontSize="11" textAnchor="end" x={LEFT - 10} y={yFor(value) + 4}>
                    {formatCompactPeso(value)}
                  </text>
                </g>
              ))}

              {activePoint && active !== null ? (
                <rect
                  fill="rgba(255,255,255,0.04)"
                  height={plotHeight}
                  rx="6"
                  width={slot}
                  x={LEFT + slot * active}
                  y={TOP}
                />
              ) : null}

              {points.map((point, index) => {
                const center = centerFor(index);
                const dim = active !== null && active !== index ? 0.35 : point.inPeriod ? 1 : 0.4;
                return (
                  <g key={point.key}>
                    <g opacity={dim} style={{ transition: "opacity 120ms" }}>
                      <path
                        d={barPath(center - barWidth - 1, yFor(point.revenue), barWidth, zeroY - yFor(point.revenue))}
                        fill={CHART_COLORS.revenue}
                      />
                      <path
                        d={barPath(center + 1, yFor(point.expenses), barWidth, zeroY - yFor(point.expenses))}
                        fill={CHART_COLORS.expenses}
                      />
                    </g>
                    {index % labelEvery === 0 || active === index ? (
                      <text
                        fill={active === index ? "#ffffff" : point.inPeriod ? "#a1a1aa" : "#71717a"}
                        fontSize="11"
                        fontWeight={active === index ? 600 : 400}
                        textAnchor="middle"
                        x={center}
                        y={HEIGHT - 10}
                      >
                        {point.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              <line stroke={CHART_COLORS.axis} x1={LEFT} x2={width - RIGHT} y1={zeroY} y2={zeroY} />

              <path
                d={profitPath}
                fill="none"
                stroke={CHART_COLORS.profit}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
              {points.map((point, index) =>
                showMarkers || active === index ? (
                  <circle
                    cx={centerFor(index)}
                    cy={yFor(point.profit)}
                    fill={CHART_COLORS.profit}
                    key={point.key}
                    opacity={point.inPeriod ? 1 : 0.5}
                    r={active === index ? 5.5 : 4}
                    stroke={CHART_COLORS.surface}
                    strokeWidth="2"
                  />
                ) : null,
              )}

              {points.map((point, index) => (
                <rect
                  aria-label={`${point.label}: revenue ${formatPeso(point.revenue)}, expenses ${formatPeso(point.expenses)}, profit ${formatPeso(point.profit)}`}
                  className="cursor-pointer outline-none"
                  fill="transparent"
                  height={plotHeight + BOTTOM}
                  key={point.key}
                  role="button"
                  tabIndex={0}
                  width={slot}
                  x={LEFT + slot * index}
                  y={TOP}
                  onBlur={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onPointerDown={() => setActive(index)}
                  onPointerEnter={() => setActive(index)}
                  onPointerMove={() => setActive(index)}
                />
              ))}
            </svg>
          </div>

          {activePoint && active !== null ? (
            <ChartTooltip
              left={tooltipLeft(centerFor(active) - scrollLeft, slot, containerWidth)}
              point={activePoint}
            />
          ) : null}

          <table className="sr-only">
            <caption>Revenue, expenses and profit</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Revenue</th>
                <th scope="col">Expenses</th>
                <th scope="col">Profit</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.key}>
                  <th scope="row">{point.label}</th>
                  <td>{formatPeso(point.revenue)}</td>
                  <td>{formatPeso(point.expenses)}</td>
                  <td>{formatPeso(point.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-white/10 py-16 text-center text-sm text-zinc-400">
          No revenue or expenses in this period.
        </p>
      )}
    </figure>
  );
}

function ChartTooltip({ left, point }: { left: number; point: ProfitTrendPoint }) {
  const rows = [
    { color: CHART_COLORS.revenue, label: "Revenue", shape: "bar" as const, value: point.revenue },
    { color: CHART_COLORS.expenses, label: "Expenses", shape: "bar" as const, value: point.expenses },
  ];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-2 z-10 w-[184px] rounded-xl border border-white/10 bg-zinc-900/95 px-3.5 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur"
      style={{ left }}
    >
      <p className="text-xs font-semibold text-white">{point.label}</p>
      <div className="mt-2 grid gap-1.5">
        {rows.map((row) => (
          <p className="flex items-center justify-between gap-4 text-xs" key={row.label}>
            <span className="inline-flex items-center gap-2 text-zinc-400">
              <Swatch color={row.color} shape={row.shape} />
              {row.label}
            </span>
            <span className="font-medium tabular-nums text-zinc-100">{formatPeso(row.value)}</span>
          </p>
        ))}
        <p className="mt-0.5 flex items-center justify-between gap-4 border-t border-white/10 pt-1.5 text-xs">
          <span className="inline-flex items-center gap-2 text-zinc-400">
            <Swatch color={CHART_COLORS.profit} shape="line" />
            Profit
          </span>
          <span className="font-semibold tabular-nums text-white">{formatPeso(point.profit)}</span>
        </p>
      </div>
    </div>
  );
}

function LegendStat({
  color,
  label,
  shape,
  value,
}: {
  color: string;
  label: string;
  shape: "bar" | "line";
  value: number;
}) {
  return (
    <div className="min-w-0">
      <dt className="inline-flex items-center gap-2 text-xs text-zinc-400">
        <Swatch color={color} shape={shape} />
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold tabular-nums text-white sm:text-base">{formatPeso(value)}</dd>
    </div>
  );
}

function Swatch({ color, shape }: { color: string; shape: "bar" | "line" }) {
  return (
    <span
      aria-hidden="true"
      className={shape === "bar" ? "h-2.5 w-2.5 shrink-0 rounded-[3px]" : "h-0.5 w-3.5 shrink-0 rounded-full"}
      style={{ background: color }}
    />
  );
}

// Place the tooltip beside the hovered period so it never covers its bars.
function tooltipLeft(center: number, slot: number, containerWidth: number) {
  const right = center + slot / 2 + TOOLTIP_GAP;
  if (right + TOOLTIP_WIDTH <= containerWidth) return right;
  const left = center - slot / 2 - TOOLTIP_GAP - TOOLTIP_WIDTH;
  if (left >= 0) return left;
  return Math.max(0, Math.min(center - TOOLTIP_WIDTH / 2, containerWidth - TOOLTIP_WIDTH));
}

// Bar with rounded data-end (top for positive values), square at the baseline.
function barPath(x: number, y: number, width: number, height: number) {
  if (height <= 0) return "";
  const radius = Math.min(4, width / 2, height);
  return [
    `M ${x} ${y + height}`,
    `V ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `H ${x + width - radius}`,
    `Q ${x + width} ${y} ${x + width} ${y + radius}`,
    `V ${y + height}`,
    "Z",
  ].join(" ");
}

function niceCeil(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = [1, 2, 2.5, 5, 10].find((candidate) => normalized <= candidate) || 10;
  return step * magnitude;
}
