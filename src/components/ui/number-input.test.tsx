// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NumberInput } from "./number-input";

afterEach(cleanup);

describe("NumberInput", () => {
  it("parses German decimals while typing", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Menge" unit="g" step={0.1} onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Menge" });
    expect(input).toHaveAttribute("inputmode", "decimal");
    await user.type(input, "1,5");
    expect(input).toHaveValue("1,5");
    expect(onValueChange).toHaveBeenLastCalledWith(1.5);
  });

  it("also accepts a dot as decimal mark and filters letters", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Menge" decimals={2} onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Menge" });
    await user.type(input, "2a.25");
    expect(input).toHaveValue("2.25");
    expect(onValueChange).toHaveBeenLastCalledWith(2.25);
    await user.tab();
    expect(input).toHaveValue("2,25");
  });

  it("clamps and rounds on blur", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Gewicht" min={20} max={300} decimals={1} onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Gewicht" });
    await user.type(input, "412,345");
    await user.tab();
    expect(input).toHaveValue("300");
    expect(onValueChange).toHaveBeenLastCalledWith(300);
  });

  it("emits null when cleared", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Menge" defaultValue={5} onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Menge" });
    expect(input).toHaveValue("5");
    await user.clear(input);
    expect(onValueChange).toHaveBeenLastCalledWith(null);
  });

  it("steps with arrow keys", () => {
    const onValueChange = vi.fn();
    render(<NumberInput aria-label="Portionen" defaultValue={1} step={0.5} max={2} onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Portionen" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("1,5");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("2");
    expect(onValueChange).toHaveBeenLastCalledWith(2);
  });

  it("follows external value changes when controlled", async () => {
    function Controlled() {
      const [value, setValue] = useState<number | null>(72.4);
      return (
        <>
          <NumberInput aria-label="Gewicht" unit="kg" decimals={1} value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue(70)}>
            Zurücksetzen
          </button>
        </>
      );
    }
    render(<Controlled />);
    const input = screen.getByRole("textbox", { name: "Gewicht" });
    expect(input).toHaveValue("72,4");
    await userEvent.click(screen.getByRole("button", { name: "Zurücksetzen" }));
    expect(input).toHaveValue("70");
  });

  it("describes the unit for assistive tech", () => {
    render(<NumberInput aria-label="Menge" unit="g" />);
    const input = screen.getByRole("textbox", { name: "Menge" });
    expect(input).toHaveAccessibleDescription("g");
  });
});
