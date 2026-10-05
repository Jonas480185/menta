"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { formatNumber, formatWeekdayShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dayTone, type DayTone, type WeekDay } from "./week";

const TONE_STROKE: Record<DayTone, string> = {
  empty: "text-transparent",
  under: "text-kcal",
  good: "text-success",
  over: "text-over",
};

const TONE_TEXT: Record<DayTone, string> = {
  empty: "nicht geloggt",
  under: "unter Ziel",
  good: "im Zielbereich",
  over: "über Ziel",
};

const R = 16;
const C = 2 * Math.PI * R;

export interface WeekStripProps {
  days: WeekDay[];
  /** Highlighted day. */
  selected: string;
  today: string;
  /** Link for today's tile (default `/diary/{today}`). */
  todayHref?: string;
  className?: string;
}

/**
 * Week at a glance (Yazio / MyFitnessPal pattern): Mon–Sun with a mini kcal ring per day.
 * Tapping a past day opens it in the diary; future days are shown but not linked.
 */
export function WeekStrip({ days, selected, today, todayHref, className }: WeekStripProps) {
  return (
    <nav aria-label="Woche" className={cn("rounded-card bg-card px-1.5 py-2 shadow-xs", className)}>
      <ol className="grid grid-cols-7">
        {days.map((day) => {
          const tone = dayTone(day);
          const isSelected = day.date === selected;
          const isToday = day.date === today;
          const future = day.date > today;
          const ratio = day.target ? Math.min(1, day.kcal / day.target) : day.logged ? 1 : 0;
          const label = `${formatWeekdayShort(day.date)} ${Number(day.date.slice(8))}.: ${
            day.logged ? `${formatNumber(day.kcal)} kcal, ${TONE_TEXT[tone]}` : future ? "noch nicht" : TONE_TEXT.empty
          }`;
          const inner = (
            <>
              {isSelected && (
                <motion.span
                  layoutId="week-strip-selected"
                  aria-hidden
                  className="absolute inset-0 rounded-2xl bg-primary-soft"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}
              <span
                className={cn(
                  "relative text-caption",
                  isSelected ? "text-primary-strong" : "text-muted-foreground",
                )}
              >
                {formatWeekdayShort(day.date).replace(".", "")}
              </span>
              <span className="relative grid size-10 place-items-center">
                <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle cx="20" cy="20" r={R} fill="none" strokeWidth="3" className="stroke-track" />
                  {day.logged && (
                    <motion.circle
                      cx="20"
                      cy="20"
                      r={R}
                      fill="none"
                      strokeWidth="3"
                      strokeLinecap="round"
                      stroke="currentColor"
                      className={TONE_STROKE[tone]}
                      strokeDasharray={C}
                      initial={{ strokeDashoffset: C }}
                      animate={{ strokeDashoffset: C * (1 - ratio) }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  )}
                </svg>
                <span
                  className={cn(
                    "relative tabular text-body-sm",
                    isToday ? "font-bold text-primary-strong" : future ? "text-muted-foreground" : "font-medium",
                  )}
                >
                  {Number(day.date.slice(8))}
                </span>
              </span>
            </>
          );
          const cls = "relative flex min-h-11 flex-col items-center gap-1 rounded-2xl py-1.5";
          return (
            <li key={day.date}>
              {future ? (
                <span aria-label={label} className={cn(cls, "opacity-60")}>
                  {inner}
                </span>
              ) : (
                <Link
                  href={isToday && todayHref ? todayHref : `/diary/${day.date}`}
                  aria-label={label}
                  aria-current={isSelected ? "date" : undefined}
                  className={cn(cls, "focus-ring transition-transform active:scale-95")}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
