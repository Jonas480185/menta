// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addWaterAction = vi.hoisted(() => vi.fn());
const deleteWaterAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/activity/actions", () => ({ addWaterAction, deleteWaterAction }));

const toastError = vi.hoisted(() => vi.fn());
const sonnerToast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: Object.assign(sonnerToast, { success: vi.fn(), error: toastError }) }));

import { AddWaterButton } from "./add-water-button";

const DATE = "2026-09-28";

beforeEach(() => {
  addWaterAction.mockReset();
  deleteWaterAction.mockReset();
  deleteWaterAction.mockResolvedValue({ ok: true, data: { id: "w1", date: DATE, amountMl: 250, loggedAt: new Date().toISOString() } });
  sonnerToast.mockReset();
  toastError.mockReset();
});
afterEach(cleanup);

describe("AddWaterButton quick-add", () => {
  it("logs the amount, calls the optimistic callback and offers undo", async () => {
    addWaterAction.mockResolvedValue({ ok: true, data: { id: "w1", date: DATE, amountMl: 250, loggedAt: new Date().toISOString() } });
    const onOptimisticAdd = vi.fn();
    const user = userEvent.setup();

    render(<AddWaterButton date={DATE} amountMl={250} onOptimisticAdd={onOptimisticAdd} />);
    await user.click(screen.getByRole("button", { name: "250 ml Wasser hinzufügen" }));

    expect(onOptimisticAdd).toHaveBeenCalledWith(250);
    expect(addWaterAction).toHaveBeenCalledWith({ date: DATE, amountMl: 250 });
    await vi.waitFor(() => expect(sonnerToast).toHaveBeenCalled());
    const [message, options] = sonnerToast.mock.calls[0];
    expect(message).toContain("250 ml Wasser hinzugefügt.");
    expect(options.action.label).toBe("Rückgängig");

    // Undo calls delete with the returned id.
    options.action.onClick();
    expect(deleteWaterAction).toHaveBeenCalledWith({ id: "w1" });
  });

  it("shows an error toast and does not call onOptimisticAdd's follow-up on failure", async () => {
    addWaterAction.mockResolvedValue({ ok: false, error: { code: "VALIDATION", message: "Menge ungültig." } });
    const user = userEvent.setup();

    render(<AddWaterButton date={DATE} amountMl={330} />);
    await user.click(screen.getByRole("button", { name: "330 ml Wasser hinzufügen" }));

    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith("Menge ungültig."));
    expect(deleteWaterAction).not.toHaveBeenCalled();
  });
});
