import { describe, expect, it } from "vitest";
import {
  describeWeekdayConflicts,
  findWeekdayConflicts,
  normalizeWeekdays,
  pickDayProfile,
  validateWeekdaySchedule,
} from "./schedule";
import { MacroInputError } from "./types";

describe("normalizeWeekdays", () => {
  it("dedupes and sorts", () => {
    expect(normalizeWeekdays([5, 1, 3, 1])).toEqual([1, 3, 5]);
    expect(normalizeWeekdays([])).toEqual([]);
  });

  it("rejects values outside 1-7", () => {
    expect(() => normalizeWeekdays([0])).toThrow(MacroInputError);
    expect(() => normalizeWeekdays([8])).toThrow(MacroInputError);
    expect(() => normalizeWeekdays([1.5])).toThrow(MacroInputError);
  });
});

const profiles = [
  { id: "a", name: "Trainingstag", weekdays: [1, 3, 5] },
  { id: "b", name: "Ruhetag", weekdays: [7] },
  { id: "c", name: "Alt", weekdays: [2], archived: true },
];

describe("findWeekdayConflicts / validateWeekdaySchedule", () => {
  it("finds weekdays already used by other active profiles", () => {
    expect(findWeekdayConflicts(profiles, null, [1, 2, 7])).toEqual([
      { weekday: 1, profileId: "a", profileName: "Trainingstag" },
      { weekday: 7, profileId: "b", profileName: "Ruhetag" },
    ]);
  });

  it("ignores the candidate itself and archived profiles", () => {
    expect(findWeekdayConflicts(profiles, "a", [1, 3, 2])).toEqual([]);
  });

  it("validates a full schedule", () => {
    expect(validateWeekdaySchedule(profiles).ok).toBe(true);
    const bad = validateWeekdaySchedule([...profiles, { id: "d", name: "X", weekdays: [3, 7] }]);
    expect(bad.ok).toBe(false);
    expect(bad.conflicts).toEqual([
      { weekday: 3, profileIds: ["a", "d"] },
      { weekday: 7, profileIds: ["b", "d"] },
    ]);
  });

  it("describes conflicts in German", () => {
    expect(describeWeekdayConflicts([{ weekday: 1, profileId: "a", profileName: "Ruhetag" }])).toBe(
      "Montag ist bereits dem Profil „Ruhetag“ zugeordnet. Entferne den Tag dort zuerst.",
    );
    expect(
      describeWeekdayConflicts([
        { weekday: 1, profileId: "a", profileName: "Ruhetag" },
        { weekday: 3, profileId: "a", profileName: "Ruhetag" },
      ]),
    ).toBe(
      "Montag und Mittwoch sind bereits dem Profil „Ruhetag“ zugeordnet. Entferne die Tage dort zuerst.",
    );
    expect(describeWeekdayConflicts([])).toBe("");
  });
});

describe("pickDayProfile: precedence", () => {
  const all = [
    { id: "def", isDefault: true, weekdays: [], archived: false },
    { id: "train", isDefault: false, weekdays: [1, 3], archived: false },
    { id: "refeed", isDefault: false, weekdays: [], archived: false },
    { id: "old", isDefault: false, weekdays: [5], archived: true },
  ];

  it("1. override wins", () => {
    expect(pickDayProfile(all, { weekday: 1, overrideProfileId: "refeed" })?.id).toBe("refeed");
  });

  it("override to an archived/unknown profile falls back", () => {
    expect(pickDayProfile(all, { weekday: 1, overrideProfileId: "old" })?.id).toBe("train");
    expect(pickDayProfile(all, { weekday: 2, overrideProfileId: "missing" })?.id).toBe("def");
  });

  it("2. weekday schedule beats the default", () => {
    expect(pickDayProfile(all, { weekday: 3 })?.id).toBe("train");
  });

  it("archived schedules are ignored", () => {
    expect(pickDayProfile(all, { weekday: 5 })?.id).toBe("def");
  });

  it("3. default, else null", () => {
    expect(pickDayProfile(all, { weekday: 6 })?.id).toBe("def");
    expect(pickDayProfile([], { weekday: 6 })).toBeNull();
  });

  it("oldest profile wins on (invalid) overlapping schedules", () => {
    const overlapping = [
      { id: "new", isDefault: false, weekdays: [1], archived: false, createdAt: new Date("2026-02-01") },
      { id: "old", isDefault: false, weekdays: [1], archived: false, createdAt: new Date("2026-01-01") },
    ];
    expect(pickDayProfile(overlapping, { weekday: 1 })?.id).toBe("old");
  });
});
