// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logWeightAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/progress/weight/actions", () => ({
  logWeightAction,
  deleteWeightAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { LogWeightForm } from "./log-weight-sheet";

const TODAY = "2026-09-26";

beforeEach(() => {
  logWeightAction.mockReset();
  logWeightAction.mockImplementation(async (input: { date: string; weightKg: number }) => ({
    ok: true,
    data: { entry: { ...input, bodyFatPct: null, note: null }, replaced: false },
  }));
});
afterEach(cleanup);

describe("LogWeightForm validation", () => {
  it("requires a weight and does not call the action", async () => {
    const user = userEvent.setup();
    render(<LogWeightForm today={TODAY} />);
    await user.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Bitte ein Gewicht eingeben.");
    expect(screen.getByLabelText("Gewicht")).toHaveAttribute("aria-invalid", "true");
    expect(logWeightAction).not.toHaveBeenCalled();
  });

  it("rejects implausible weights", async () => {
    const user = userEvent.setup();
    render(<LogWeightForm today={TODAY} />);
    await user.type(screen.getByLabelText("Gewicht"), "8,3");
    await user.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("zwischen 30 und 300 kg");
    expect(logWeightAction).not.toHaveBeenCalled();
  });

  it("rejects body fat outside the plausible range", async () => {
    const user = userEvent.setup();
    render(<LogWeightForm today={TODAY} lastWeightKg={80} />);
    await user.type(screen.getByLabelText(/Körperfett/), "90");
    await user.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Körperfett bitte zwischen 2 und 70 %");
    expect(logWeightAction).not.toHaveBeenCalled();
  });

  it("shows a non-blocking hint for large jumps and a replace hint for logged days", async () => {
    const user = userEvent.setup();
    render(<LogWeightForm today={TODAY} lastWeightKg={80} existing={{ [TODAY]: 80 }} />);
    const weight = screen.getByLabelText("Gewicht");
    await user.clear(weight);
    await user.type(weight, "70");
    expect(screen.getByText(/Großer Sprung/)).toBeInTheDocument();
    expect(screen.getByText(/Speichern ersetzt den Wert/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ersetzen" }));
    expect(logWeightAction).toHaveBeenCalledWith(
      expect.objectContaining({ date: TODAY, weightKg: 70, bodyFatPct: null, note: null }),
    );
  });

  it("submits a valid entry prefilled with the last weight", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<LogWeightForm today={TODAY} lastWeightKg={72.5} onSaved={onSaved} />);
    await user.click(screen.getByRole("button", { name: "0,1 kg weniger" }));
    await user.click(screen.getByRole("button", { name: "Speichern" }));
    expect(logWeightAction).toHaveBeenCalledWith(expect.objectContaining({ date: TODAY, weightKg: 72.4 }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
