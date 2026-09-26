"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartColors } from "@/components/theme/tokens";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { thinPoints, type WeightRange, type WeightTrendPoint } from "@/domain/weight";
import type { IsoDate } from "@/lib/dates";
import { formatDateLong, formatWeightKg } from "@/lib/format";
import { cn } from "@/lib/utils";

const WEIGHT = "var(--weight)";
const WEIGHT_STRONG = "var(--weight-strong)";
const MONTHS = [
  "Jan.",
  "Feb.",
  "März",
  "Apr.",
  "Mai",
  "Juni",
  "Juli",
  "Aug.",
  "Sep.",
  "Okt.",
  "Nov.",
  "Dez.",
];

/** "24.9." for short ranges, "Sep." / "Sep. 25" (other year) for long ones. */
function tickLabel(date: IsoDate, range: WeightRange, lastYear: string): string {
  const [y, m, d] = date.split("-");
  if (range === "30d" || range === "3m") return `${Number(d)}.${Number(m)}.`;
  const month = MONTHS[Number(m) - 1];
  return y === lastYear ? month : `${month} ${y.slice(2)}`;
}

export interface WeightTrendChartProps {
  /** Daily points (see getWeightTrend). Days without data have null values. */
  points: readonly WeightTrendPoint[];
  /** Dashed target line. */
  goalKg?: number | null;
  /** Controls axis labels. Default "30d". */
  range?: WeightRange;
  /** Sparkline: trend line only, no axes, grid, tooltip or legend. */
  compact?: boolean;
  /** Show the 7-day average as a thin secondary line. */
  showAverage?: boolean;
  /** Draw the trend line (hide it while there are fewer than 3 entries). Default true. */
  showTrend?: boolean;
  /** Plot height in px. Default 240 (compact 56). */
  height?: number;
  className?: string;
}

interface ChartRow {
  date: IsoDate;
  weightKg: number | null;
  avg7: number | null;
  trend: number | null;
}

function yDomain(
  rows: ChartRow[],
  goalKg: number | null,
  showAverage: boolean,
): {
  domain: [number, number];
  goalVisible: boolean;
} {
  const values: number[] = [];
  for (const r of rows) {
    if (r.weightKg !== null) values.push(r.weightKg);
    if (r.trend !== null) values.push(r.trend);
    if (showAverage && r.avg7 !== null) values.push(r.avg7);
  }
  if (values.length === 0) return { domain: [0, 1], goalVisible: false };
  let min = Math.min(...values);
  let max = Math.max(...values);
  const span = Math.max(max - min, 1);
  // Show the goal only when it doesn't squash the data (within ~one data span).
  const goalVisible = goalKg !== null && goalKg >= min - span - 1 && goalKg <= max + span + 1;
  if (goalVisible && goalKg !== null) {
    min = Math.min(min, goalKg);
    max = Math.max(max, goalKg);
  }
  const pad = Math.max((max - min) * 0.12, 0.5);
  return { domain: [Math.floor((min - pad) * 2) / 2, Math.ceil((max + pad) * 2) / 2], goalVisible };
}

interface TooltipRow {
  payload?: ChartRow;
}

function ChartTooltip({
  active,
  payload,
  showAverage,
}: {
  active?: boolean;
  payload?: readonly TooltipRow[];
  showAverage: boolean;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lg">
      <p className="text-caption text-muted-foreground">{formatDateLong(row.date)}</p>
      <dl className="mt-1 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-0.5 text-body-sm">
        {row.trend !== null && (
          <>
            <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-weight" />
            <dt className="text-muted-foreground">Trend</dt>
            <dd className="text-right font-medium tabular">{formatWeightKg(row.trend)}</dd>
          </>
        )}
        {row.weightKg !== null && (
          <>
            <span aria-hidden="true" className="mx-auto size-2 rounded-full bg-weight/50" />
            <dt className="text-muted-foreground">Messung</dt>
            <dd className="text-right tabular">{formatWeightKg(row.weightKg)}</dd>
          </>
        )}
        {showAverage && row.avg7 !== null && (
          <>
            <span aria-hidden="true" className="h-px w-3 bg-weight-strong/60" />
            <dt className="text-muted-foreground">Ø 7 Tage</dt>
            <dd className="text-right tabular">{formatWeightKg(row.avg7)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

/** Text summary for screen readers (and the chart's aria-label). */
export function describeWeightChart(points: readonly WeightTrendPoint[], goalKg?: number | null): string {
  const measured = points.filter((p) => p.weightKg !== null);
  const trend = points.filter((p) => p.trend !== null);
  if (points.length === 0 || (measured.length === 0 && trend.length === 0)) {
    return "Gewichtsverlauf: noch keine Messungen in diesem Zeitraum.";
  }
  const from = formatDateLong(points[0].date, { weekday: false });
  const to = formatDateLong(points[points.length - 1].date, { weekday: false });
  const parts = [
    `Gewichtsverlauf vom ${from} bis ${to}`,
    `${measured.length} ${measured.length === 1 ? "Messung" : "Messungen"}`,
  ];
  if (trend.length > 1) {
    parts.push(
      `Trend von ${formatWeightKg(trend[0].trend)} auf ${formatWeightKg(trend[trend.length - 1].trend)}`,
    );
  }
  if (goalKg != null) parts.push(`Zielgewicht ${formatWeightKg(goalKg)}`);
  return `${parts.join(", ")}.`;
}

/**
 * Weight chart: the smoothed trend is the hero (2.5 px line + soft area), daily readings are
 * faint dots, the 7-day average is optional, the goal a dashed line. Colours come from the
 * weight / chart tokens, so light and dark mode work without extra code.
 */
export function WeightTrendChart({
  points,
  goalKg = null,
  range = "30d",
  compact = false,
  showAverage = false,
  showTrend = true,
  height,
  className,
}: WeightTrendChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Draw-in on first render only; later updates (range switch) don't re-animate.
  const [firstRender, setFirstRender] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setFirstRender(false), 600);
    return () => window.clearTimeout(t);
  }, []);
  const animate = firstRender && !reduceMotion;

  const rows = useMemo<ChartRow[]>(() => thinPoints(points, compact ? 120 : 400), [points, compact]);
  const { domain, goalVisible } = useMemo(
    () => yDomain(rows, compact ? null : goalKg, showAverage && !compact),
    [rows, goalKg, showAverage, compact],
  );
  const lastYear = rows.at(-1)?.date.slice(0, 4) ?? "";
  const summary = describeWeightChart(points, goalKg);
  const plotHeight = height ?? (compact ? 56 : 240);

  if (compact) {
    return (
      <div className={cn("w-full", className)} role="img" aria-label={summary} style={{ height: plotHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <YAxis hide domain={domain} />
            <XAxis hide dataKey="date" />
            {showTrend ? (
              <Line
                type="monotone"
                dataKey="trend"
                stroke={WEIGHT}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={animate}
              />
            ) : (
              <Line
                dataKey="weightKg"
                stroke="transparent"
                dot={{ r: 2, fill: WEIGHT, fillOpacity: 0.6, strokeWidth: 0 }}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const measured = points.filter((p) => p.weightKg !== null);

  return (
    <figure className={cn("flex flex-col gap-3 [--weight-area:0.12] dark:[--weight-area:0.2]", className)}>
      <div role="img" aria-label={summary} style={{ height: plotHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={WEIGHT} style={{ stopOpacity: "var(--weight-area)" }} />
                <stop offset="100%" stopColor={WEIGHT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={chartColors.chrome.grid} strokeWidth={1} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => tickLabel(d, range, lastYear)}
              tick={{ fill: chartColors.chrome.axis, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              interval="preserveStartEnd"
              tickMargin={8}
            />
            <YAxis
              domain={domain}
              tickCount={4}
              allowDecimals
              tickFormatter={(v: number) => formatWeightKg(v).replace(/\s?kg$/, "")}
              tick={{ fill: chartColors.chrome.axis, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: chartColors.chrome.axis, strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload }) => (
                <ChartTooltip
                  active={active}
                  payload={payload as readonly TooltipRow[] | undefined}
                  showAverage={showAverage}
                />
              )}
              isAnimationActive={false}
            />
            {goalVisible && goalKg !== null && (
              <ReferenceLine
                y={goalKg}
                stroke={chartColors.chrome.target}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Ziel ${formatWeightKg(goalKg)}`,
                  position: "insideTopRight",
                  fill: chartColors.chrome.axis,
                  fontSize: 12,
                }}
              />
            )}
            {showTrend && (
              <Area
                type="monotone"
                dataKey="trend"
                stroke={WEIGHT}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                connectNulls
                dot={false}
                activeDot={{ r: 5, fill: WEIGHT, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={animate}
                animationDuration={500}
                animationEasing="ease-out"
              />
            )}
            {showAverage && (
              <Line
                type="monotone"
                dataKey="avg7"
                stroke={WEIGHT_STRONG}
                strokeOpacity={0.6}
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={animate}
                animationDuration={500}
              />
            )}
            <Line
              dataKey="weightKg"
              stroke="transparent"
              strokeWidth={0}
              dot={{ r: 2, fill: WEIGHT, fillOpacity: 0.4, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: WEIGHT, fillOpacity: 0.8, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
        {showTrend && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-[3px] w-4 rounded-full bg-weight" />
            Trend
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-weight/50" />
          Messung
        </span>
        {showAverage && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-weight-strong/60" />Ø 7 Tage
          </span>
        )}
        {goalKg !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="w-4 border-t-[1.5px] border-dashed border-chart-target" />
            Ziel {formatWeightKg(goalKg)}
            {!goalVisible && " (außerhalb des Ausschnitts)"}
          </span>
        )}
      </figcaption>

      <table className="sr-only">
        <caption>Messwerte</caption>
        <thead>
          <tr>
            <th scope="col">Datum</th>
            <th scope="col">Gewicht</th>
            <th scope="col">Trend</th>
          </tr>
        </thead>
        <tbody>
          {measured.map((p) => (
            <tr key={p.date}>
              <td>{formatDateLong(p.date, { weekday: false })}</td>
              <td>{formatWeightKg(p.weightKg)}</td>
              <td>{formatWeightKg(p.trend)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
