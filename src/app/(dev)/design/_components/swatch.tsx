"use client";

import { useEffect, useRef } from "react";

/**
 * Color swatch that prints the token's resolved value in its own theme scope
 * (a `.light` / `.dark` island), so both themes can be QA'd side by side.
 */
export function Swatch({ token, label }: { token: string; label?: string }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!boxRef.current || !valueRef.current) return;
    const value = getComputedStyle(boxRef.current).getPropertyValue(`--${token}`).trim();
    valueRef.current.textContent = value;
  }, [token]);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        ref={boxRef}
        className="border-border size-10 shrink-0 rounded-md border shadow-xs"
        style={{ background: `var(--${token})` }}
      />
      <span className="min-w-0">
        <span className="text-foreground block truncate font-mono text-caption">
          {label ?? token}
        </span>
        <span ref={valueRef} className="text-muted-foreground block font-mono text-caption" />
      </span>
    </div>
  );
}
