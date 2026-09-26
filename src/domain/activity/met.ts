import type { ActivityType } from "./types";

/**
 * MET values (metabolic equivalents, 1 MET ≈ resting energy expenditure ≈ 1 kcal · kg⁻¹ · h⁻¹).
 *
 * Source: Compendium of Physical Activities –
 *   Ainsworth BE et al. 2011 Compendium of Physical Activities: a second update of codes and MET values.
 *   Med Sci Sports Exerc. 2011;43(8):1575–1581. doi:10.1249/MSS.0b013e31821ece12
 *   Herrmann SD et al. 2024 Adult Compendium of Physical Activities. J Sport Health Sci. 2024;13(1):6–12.
 *   https://pacompendium.com
 *
 * `compendium` is the Compendium entry (code + English description) the value is taken from.
 * Values are averages for adults; individual expenditure varies by ±20–30 %.
 */
export interface MetActivity {
  /** Stable key, stored in activities.details.metKey. */
  key: string;
  /** German display name. */
  name: string;
  met: number;
  type: Exclude<ActivityType, "steps">;
  /** Extra search terms (German + English). */
  keywords: readonly string[];
  compendium: string;
}

export const MET_ACTIVITIES: readonly MetActivity[] = [
  {
    key: "walking",
    name: "Gehen",
    met: 3.5,
    type: "cardio",
    keywords: ["spazieren", "laufen", "walking", "spaziergang"],
    compendium: "17190 walking, 2.8–3.2 mph, level, moderate pace",
  },
  {
    key: "walking_brisk",
    name: "Zügiges Gehen",
    met: 4.3,
    type: "cardio",
    keywords: ["walking", "schnell gehen", "power walking", "nordic"],
    compendium: "17200 walking, 3.5 mph, level, brisk",
  },
  {
    key: "running_8",
    name: "Laufen (8 km/h)",
    met: 8.3,
    type: "cardio",
    keywords: ["joggen", "jogging", "running", "rennen"],
    compendium: "12030 running, 5 mph (12 min/mile)",
  },
  {
    key: "running_10",
    name: "Laufen (10 km/h)",
    met: 9.8,
    type: "cardio",
    keywords: ["joggen", "jogging", "running", "rennen"],
    compendium: "12050 running, 6 mph (10 min/mile)",
  },
  {
    key: "running_12",
    name: "Laufen (12 km/h)",
    met: 11.8,
    type: "cardio",
    keywords: ["joggen", "running", "rennen", "tempolauf"],
    compendium: "12080 running, 7.5 mph (8 min/mile)",
  },
  {
    key: "cycling_leisure",
    name: "Radfahren (gemütlich)",
    met: 4.0,
    type: "cardio",
    keywords: ["fahrrad", "rad", "cycling", "bike", "pendeln"],
    compendium: "01010 bicycling, < 10 mph, leisure, to work or for pleasure",
  },
  {
    key: "cycling_brisk",
    name: "Radfahren (zügig)",
    met: 8.0,
    type: "cardio",
    keywords: ["fahrrad", "rennrad", "cycling", "bike", "spinning"],
    compendium: "01040 bicycling, 12–13.9 mph, leisure, moderate effort",
  },
  {
    key: "swimming",
    name: "Schwimmen",
    met: 5.8,
    type: "cardio",
    keywords: ["bahnen", "kraulen", "brust", "swimming"],
    compendium: "18310 swimming laps, freestyle, light or moderate effort",
  },
  {
    key: "strength_moderate",
    name: "Krafttraining (moderat)",
    met: 3.5,
    type: "strength",
    keywords: ["gym", "fitnessstudio", "hanteln", "gewichte", "kraft", "weights"],
    compendium: "02054 resistance (weight) training, multiple exercises, 8–15 reps, moderate effort",
  },
  {
    key: "strength_vigorous",
    name: "Krafttraining (intensiv)",
    met: 6.0,
    type: "strength",
    keywords: ["gym", "powerlifting", "bodybuilding", "kraft", "weights"],
    compendium: "02050 resistance training (weight lifting, free weights), vigorous effort",
  },
  {
    key: "hiit",
    name: "HIIT",
    met: 8.0,
    type: "cardio",
    keywords: ["intervall", "zirkeltraining", "circuit", "crossfit", "tabata"],
    compendium: "02040 circuit training, including kettlebells, some aerobic movement, vigorous",
  },
  {
    key: "yoga",
    name: "Yoga",
    met: 2.5,
    type: "other",
    keywords: ["hatha", "dehnen", "stretching"],
    compendium: "02150 yoga, Hatha",
  },
  {
    key: "pilates",
    name: "Pilates",
    met: 3.0,
    type: "other",
    keywords: ["core", "rumpf"],
    compendium: "02105 pilates, general",
  },
  {
    key: "hiking",
    name: "Wandern",
    met: 6.0,
    type: "cardio",
    keywords: ["berg", "hiking", "trekking", "bergwandern"],
    compendium: "17080 hiking, cross country",
  },
  {
    key: "soccer",
    name: "Fußball",
    met: 7.0,
    type: "sport",
    keywords: ["fussball", "kicken", "soccer", "football"],
    compendium: "15610 soccer, casual, general",
  },
  {
    key: "tennis",
    name: "Tennis",
    met: 7.3,
    type: "sport",
    keywords: ["einzel", "doppel"],
    compendium: "15675 tennis, general",
  },
  {
    key: "dancing",
    name: "Tanzen",
    met: 7.8,
    type: "sport",
    keywords: ["disco", "zumba", "line dance", "dance"],
    compendium: "03025 general dancing (e.g. disco, folk, line dancing, polka)",
  },
  {
    key: "rowing",
    name: "Rudern",
    met: 7.0,
    type: "cardio",
    keywords: ["ruderergometer", "rudergerät", "rowing", "ergometer"],
    compendium: "02072 rowing, stationary, 100 watts, moderate effort",
  },
  {
    key: "elliptical",
    name: "Crosstrainer",
    met: 5.0,
    type: "cardio",
    keywords: ["ellipsentrainer", "elliptical", "stepper"],
    compendium: "02048 elliptical trainer, moderate effort",
  },
];

const BY_KEY = new Map(MET_ACTIVITIES.map((a) => [a.key, a]));

export function getMetActivity(key: string | null | undefined): MetActivity | undefined {
  return key ? BY_KEY.get(key) : undefined;
}

/** Lower-case, strip diacritics and ß → ss, so "fussball" finds "Fußball". */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").trim();
}

/**
 * Filters the MET table by a free-text query (name + keywords, accent-insensitive).
 * Name prefix matches rank first, then name substring, then keyword matches. Empty query → full list.
 */
export function searchMetActivities(query: string): MetActivity[] {
  const q = normalize(query);
  if (!q) return [...MET_ACTIVITIES];
  const scored: { a: MetActivity; score: number; i: number }[] = [];
  MET_ACTIVITIES.forEach((a, i) => {
    const name = normalize(a.name);
    let score = 0;
    if (name.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 2;
    else if (a.keywords.some((k) => normalize(k).includes(q))) score = 1;
    if (score > 0) scored.push({ a, score, i });
  });
  return scored.sort((x, y) => y.score - x.score || x.i - y.i).map((s) => s.a);
}
