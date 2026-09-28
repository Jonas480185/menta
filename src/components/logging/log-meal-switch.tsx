"use client";

import { useRouter } from "next/navigation";
import { MealPicker, type MealOption } from "./meal-picker";

export function LogMealSwitch({ meals, value, date }: { meals: MealOption[]; value: string; date: string }) {
  const router = useRouter();
  return <MealPicker meals={meals} value={value} onChange={(id) => router.replace(`/log?date=${date}&meal=${id}`)} />;
}
