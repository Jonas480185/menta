// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SegmentedControl, type SegmentedControlOption } from "./segmented-control";

afterEach(cleanup);

type Range = "7d" | "30d" | "3m" | "1y";
const options: SegmentedControlOption<Range>[] = [
  { value: "7d", label: "7T", ariaLabel: "7 Tage" },
  { value: "30d", label: "30T", ariaLabel: "30 Tage" },
  { value: "3m", label: "3M", ariaLabel: "3 Monate", disabled: true },
  { value: "1y", label: "1J", ariaLabel: "1 Jahr" },
];

function Controlled({ onChange }: { onChange: (v: Range) => void }) {
  const [value, setValue] = useState<Range>("7d");
  return (
    <SegmentedControl
      aria-label="Zeitraum"
      options={options}
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe("SegmentedControl", () => {
  it("exposes radiogroup semantics with a single tab stop", () => {
    render(<SegmentedControl aria-label="Zeitraum" options={options} defaultValue="30d" />);
    expect(screen.getByRole("radiogroup", { name: "Zeitraum" })).toBeInTheDocument();
    const selected = screen.getByRole("radio", { name: "30 Tage" });
    expect(selected).toHaveAttribute("aria-checked", "true");
    expect(selected).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "7 Tage" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus and selection with arrow keys, skipping disabled options and wrapping", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await user.tab();
    expect(screen.getByRole("radio", { name: "7 Tage" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "30 Tage" })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("30d");

    await user.keyboard("{ArrowRight}");
    // "3M" is disabled → skipped
    expect(screen.getByRole("radio", { name: "1 Jahr" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "1 Jahr" })).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "7 Tage" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "1 Jahr" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("7d");
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("1y");
  });

  it("selects on click and does not re-fire for the current value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "7 Tage" }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "30 Tage" }));
    expect(onChange).toHaveBeenCalledWith("30d");
  });
});
