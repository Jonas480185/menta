"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateShort, formatNumber } from "@/lib/format";

export interface DayPoint {
  date: string;
  kcal: number | null;
  proteinG: number | null;
  targetKcal: number | null;
  targetProtein: number | null;
}

const axis = { stroke: "var(--color-chart-axis, var(--muted-foreground))", fontSize: 12, tickLine: false, axisLine: false } as const;

function tip(unit: string) {
  return {
    contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--popover-foreground)" },
    labelFormatter: (d: unknown) => formatDateShort(String(d)),
    formatter: (v: unknown) => [`${formatNumber(Number(v))} ${unit}`, ""],
  };
}

/**
 * Dashed goal line. `extendDomain` stretches the y-axis up to the goal – without it Recharts silently
 * drops the line whenever every logged day stays below the goal.
 */
function TargetLine({ y }: { y: number }) {
  return (
    <ReferenceLine
      y={y}
      ifOverflow="extendDomain"
      stroke="var(--color-chart-target, var(--foreground))"
      strokeDasharray="4 4"
      label={{ value: "Ziel", position: "insideTopRight", fill: "var(--color-chart-axis, var(--muted-foreground))", fontSize: 12 }}
    />
  );
}

/** Calories per day as bars with the (latest) target as reference line. */
export function CaloriesChart({ data, target }: { data: DayPoint[]; target: number | null }) {
  return (
    <div className="h-56" role="img" aria-label="Kalorien pro Tag">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-chart-grid, var(--border))" />
          <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => formatDateShort(d)} minTickGap={24} />
          <YAxis {...axis} width={44} tickFormatter={(v: number) => formatNumber(v)} />
          <Tooltip {...tip("kcal")} cursor={{ fill: "var(--accent)" }} />
          {target && <TargetLine y={target} />}
          <Bar dataKey="kcal" fill="var(--kcal)" radius={[6, 6, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProteinChart({ data, target }: { data: DayPoint[]; target: number | null }) {
  return (
    <div className="h-48" role="img" aria-label="Protein pro Tag">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-chart-grid, var(--border))" />
          <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => formatDateShort(d)} minTickGap={24} />
          <YAxis {...axis} width={44} tickFormatter={(v: number) => formatNumber(v)} />
          <Tooltip {...tip("g")} />
          {target && <TargetLine y={target} />}
          <Line dataKey="proteinG" stroke="var(--protein)" strokeWidth={2.5} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
