"use client";

import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import { focusRing } from "./tokens";

export interface SliderProps extends React.ComponentProps<typeof SliderPrimitive.Root> {
  /** Accessible names for the thumbs (one per value). */
  thumbLabels?: string[];
}

function Slider({ className, defaultValue, value, min = 0, max = 100, thumbLabels, ...props }: SliderProps) {
  const values = value ?? defaultValue ?? [min];
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50",
        "data-[orientation=horizontal]:h-11 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-11 data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-track data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
        />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          data-slot="slider-thumb"
          aria-label={thumbLabels?.[index]}
          className={cn(
            "relative block size-6 shrink-0 cursor-grab rounded-full border-2 border-primary bg-card shadow-md active:cursor-grabbing",
            "transition-[scale] duration-150 hover:scale-110 active:scale-110",
            "after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 after:content-['']",
            "data-disabled:pointer-events-none",
            focusRing,
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
