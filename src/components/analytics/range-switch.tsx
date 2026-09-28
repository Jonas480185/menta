"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/segmented-control";

type R = "7d" | "30d" | "3m" | "6m" | "1y";

export function RangeSwitch({ value }: { value: R }) {
  const router = useRouter();
  return (
    <SegmentedControl<R>
      block
      value={value}
      onValueChange={(v) => router.replace(`/progress?range=${v}`, { scroll: false })}
      aria-label="Zeitraum"
      options={[
        { value: "7d", label: "7T" },
        { value: "30d", label: "30T" },
        { value: "3m", label: "3M" },
        { value: "6m", label: "6M" },
        { value: "1y", label: "1J" },
      ]}
    />
  );
}
