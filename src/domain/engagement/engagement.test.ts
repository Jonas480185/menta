import { describe, expect, it } from "vitest";
import {
  computeStreak,
  consistencyScore,
  evaluateAchievementRules,
  MASCOT_RULES,
  selectMascotMessage,
  type MascotContext,
} from "./index";

const base: MascotContext = {
  hour: 12,
  isNewUser: false,
  entryCount: 3,
  emptyMeals: [],
  consumedKcal: 1000,
  targetKcal: 2300,
  proteinG: 60,
  proteinTarget: 160,
  waterMl: 2000,
  waterGoalMl: 2500,
  streak: { current: 2, longest: 5, todayLogged: true },
  weightDirection: null,
  daysSinceWeight: 1,
  newAchievement: null,
  dismissedKeys: [],
};

describe("streaks", () => {
  it("counts through yesterday when today is not logged yet", () => {
    expect(computeStreak(["2026-03-01", "2026-03-02", "2026-03-03"], "2026-03-04")).toEqual({ current: 3, longest: 3, todayLogged: false });
  });
  it("breaks on gaps and tracks the longest run", () => {
    const s = computeStreak(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-06"], "2026-01-06");
    expect(s).toEqual({ current: 1, longest: 4, todayLogged: true });
  });
  it("consistency is the share of logged days", () => {
    expect(consistencyScore(["2026-01-10", "2026-01-09"], "2026-01-10", 4)).toBe(50);
  });
  it("unlocks achievements once", () => {
    const facts = { totalEntries: 1, longestStreak: 7, customFoods: 0, recipes: 0, weightEntries: 0, proteinGoalDays: 0, waterGoalDays: 0, consistency: 10 };
    expect(evaluateAchievementRules(facts, new Set(["first_entry"]))).toEqual(["streak_3", "streak_7"]);
  });
});

describe("Milo rules", () => {
  it("nudges breakfast in the morning when nothing is logged", () => {
    const m = selectMascotMessage({ ...base, hour: 8, entryCount: 0, emptyMeals: [{ id: "b", name: "Frühstück" }] });
    expect(m).toMatchObject({ key: "morning_empty", text: "Noch nichts geloggt. Was gab es zum Frühstück?", action: { href: "/log?meal=b" } });
  });
  it("celebrates protein goal and 7-day streak", () => {
    expect(selectMascotMessage({ ...base, proteinG: 170 }).text).toBe("Protein-Ziel erreicht.");
    expect(selectMascotMessage({ ...base, streak: { current: 7, longest: 7, todayLogged: true } }).text).toBe("7 Tage in Folge geloggt.");
  });
  it("respects dismissals", () => {
    expect(selectMascotMessage({ ...base, proteinG: 170, dismissedKeys: ["protein_reached"] }).key).not.toBe("protein_reached");
  });
  it("never uses guilt-tripping language", () => {
    const ctxs = [base, { ...base, consumedKcal: 3000 }, { ...base, hour: 20, streak: { current: 5, longest: 5, todayLogged: false } }];
    for (const c of ctxs)
      for (const r of MASCOT_RULES)
        if (r.applies(c)) expect(r.build(c).text).not.toMatch(/schlecht|sünde|versagt|faul|cheat|zu viel gegessen/i);
  });
});
