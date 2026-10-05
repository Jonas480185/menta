import { describe, expect, it } from "vitest";
import {
  addPetting,
  DIZZY_TAPS,
  gazeTowards,
  nextDelay,
  pickIdle,
  pickLine,
  pickTapReaction,
  REACTIONS,
  registerTap,
  TAP_WINDOW_MS,
} from "./reactions";

const fixed = (v: number) => () => v;

describe("registerTap", () => {
  it("drops taps outside the combo window and appends now", () => {
    expect(registerTap([0, 500, 1500], 2000)).toEqual([500, 1500, 2000]);
    expect(registerTap([], 10)).toEqual([10]);
    expect(registerTap([0], TAP_WINDOW_MS)).toEqual([TAP_WINDOW_MS]);
  });
});

describe("pickTapReaction", () => {
  it("gets dizzy after a long tap combo", () => {
    const history = Array.from({ length: DIZZY_TAPS }, (_, i) => i * 400);
    expect(pickTapReaction(history, null, fixed(0))).toBe("dizzy");
  });

  it("flips on a fast double tap", () => {
    expect(pickTapReaction([1000, 1200], null, fixed(0))).toBe("flip");
  });

  it("does not flip on slow taps", () => {
    expect(pickTapReaction([1000, 1600], null, fixed(0))).not.toBe("flip");
  });

  it("never repeats the previous reaction", () => {
    for (let r = 0; r < 1; r += 0.05) {
      expect(pickTapReaction([0], "hop", fixed(r))).not.toBe("hop");
      expect(pickTapReaction([0], "love", fixed(r))).not.toBe("love");
    }
  });

  it("stays in range for rand → 1", () => {
    expect(REACTIONS[pickTapReaction([0], null, fixed(0.999999))]).toBeDefined();
  });
});

describe("pickLine", () => {
  it("returns one of the reaction's German lines", () => {
    expect(REACTIONS.love.lines).toContain(pickLine("love", fixed(0.5)));
    expect(REACTIONS.flip.lines).toContain(pickLine("flip", fixed(0.9999)));
  });
});

describe("pickIdle", () => {
  it("only yawns or looks around when sleepy", () => {
    for (let r = 0; r < 1; r += 0.1) expect(["yawn", "lookAround"]).toContain(pickIdle("sleepy", fixed(r)));
  });

  it("is lively when celebrating", () => {
    for (let r = 0; r < 1; r += 0.1) expect(pickIdle("celebrating", fixed(r))).not.toBe("yawn");
  });
});

describe("nextDelay", () => {
  it("interpolates between bounds", () => {
    expect(nextDelay(1000, 3000, fixed(0))).toBe(1000);
    expect(nextDelay(1000, 3000, fixed(0.5))).toBe(2000);
  });
});

describe("gazeTowards", () => {
  it("is zero at the centre", () => {
    expect(gazeTowards({ x: 10, y: 10 }, { x: 10, y: 10 })).toEqual({ x: 0, y: 0 });
  });

  it("saturates at unit length beyond reach", () => {
    const g = gazeTowards({ x: 0, y: 0 }, { x: 1000, y: 0 }, 200);
    expect(g.x).toBeCloseTo(1);
    expect(g.y).toBeCloseTo(0);
  });

  it("scales linearly inside reach", () => {
    const g = gazeTowards({ x: 0, y: 0 }, { x: 0, y: -100 }, 200);
    expect(g.y).toBeCloseTo(-0.5);
  });
});

describe("addPetting", () => {
  it("accumulates and resets once the threshold is crossed", () => {
    const a = addPetting(0, 200, 400);
    expect(a).toEqual({ total: 200, triggered: false });
    const b = addPetting(a.total, -250, 400);
    expect(b).toEqual({ total: 0, triggered: true });
  });
});
