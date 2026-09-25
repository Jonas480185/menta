// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuantityStepper } from "./quantity-stepper";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("QuantityStepper", () => {
  it("steps by fractional servings and renders fraction glyphs", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<QuantityStepper label="Portionen" defaultValue={1} step={0.5} min={0.5} onValueChange={onValueChange} />);
    const spin = screen.getByRole("spinbutton", { name: "Portionen" });
    await user.click(screen.getByRole("button", { name: "Portionen erhöhen" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(1.5);
    expect(spin).toHaveTextContent("1½");
    expect(spin).toHaveAttribute("aria-valuenow", "1.5");
  });

  it("disables the minus button at min", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<QuantityStepper label="Portionen" defaultValue={0.5} step={0.25} min={0.25} onValueChange={onValueChange} />);
    const minus = screen.getByRole("button", { name: "Portionen verringern" });
    await user.click(minus);
    expect(onValueChange).toHaveBeenLastCalledWith(0.25);
    expect(minus).toBeDisabled();
    expect(screen.getByRole("spinbutton")).toHaveTextContent("¼");
  });

  it("repeats while the button is held", () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    render(<QuantityStepper label="Stück" defaultValue={0} max={100} onValueChange={onValueChange} />);
    const plus = screen.getByRole("button", { name: "Stück erhöhen" });
    fireEvent.pointerDown(plus, { pointerType: "touch" });
    expect(onValueChange).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(400 + 90 * 3);
    });
    fireEvent.pointerUp(plus, { pointerType: "touch" });
    expect(onValueChange).toHaveBeenCalledTimes(5);
    expect(onValueChange).toHaveBeenLastCalledWith(5);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onValueChange).toHaveBeenCalledTimes(5);
  });

  it("stops repeating at max", () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    render(<QuantityStepper label="Stück" defaultValue={0} max={3} onValueChange={onValueChange} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Stück erhöhen" }), { pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onValueChange).toHaveBeenLastCalledWith(3);
    expect(onValueChange).toHaveBeenCalledTimes(3);
  });

  it("supports keyboard on the spinbutton and the buttons", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<QuantityStepper label="Stück" defaultValue={2} max={10} onValueChange={onValueChange} />);
    const spin = screen.getByRole("spinbutton", { name: "Stück" });
    spin.focus();
    await user.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith(3);
    await user.keyboard("{End}");
    expect(onValueChange).toHaveBeenLastCalledWith(10);
    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith(0);

    const plus = screen.getByRole("button", { name: "Stück erhöhen" });
    plus.focus();
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith(1);
  });
});
