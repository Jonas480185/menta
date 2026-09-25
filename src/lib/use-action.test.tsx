// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail, ok, type ActionResult } from "./result";
import { NETWORK_ERROR, useAction } from "./use-action";

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

beforeEach(() => {
  toastMock.error.mockReset();
  toastMock.success.mockReset();
});

describe("useAction", () => {
  it("resolves data, calls onSuccess and clears pending", async () => {
    const action = vi.fn(async (grams: number) => ok({ grams }));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useAction(action, { onSuccess, successMessage: "Gespeichert" }));

    let res: ActionResult<{ grams: number }> | undefined;
    await act(async () => {
      res = await result.current.execute(150);
    });

    expect(res).toEqual({ ok: true, data: { grams: 150 } });
    expect(action).toHaveBeenCalledWith(150);
    expect(onSuccess).toHaveBeenCalledWith({ grams: 150 }, 150);
    expect(toastMock.success).toHaveBeenCalledWith("Gespeichert");
    expect(result.current.data).toEqual({ grams: 150 });
    expect(result.current.error).toBeNull();
    expect(result.current.isPending).toBe(false);
  });

  it("reports isPending while the action runs", async () => {
    let release!: () => void;
    const action = () => new Promise<ActionResult<void>>((r) => (release = () => r(ok(undefined))));
    const { result } = renderHook(() => useAction(action));

    let pending!: Promise<ActionResult<void>>;
    act(() => {
      pending = result.current.execute();
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));
    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.isPending).toBe(false);
  });

  it("toasts error messages and exposes the error", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAction(async () => fail("NOT_FOUND", "Lebensmittel nicht gefunden."), { onError }),
    );
    await act(async () => {
      await result.current.execute();
    });
    expect(toastMock.error).toHaveBeenCalledWith("Lebensmittel nicht gefunden.");
    expect(onError).toHaveBeenCalledWith({ code: "NOT_FOUND", message: "Lebensmittel nicht gefunden." });
    expect(result.current.error?.code).toBe("NOT_FOUND");
    expect(result.current.fieldErrors).toEqual({});
  });

  it("exposes fieldErrors without toasting by default", async () => {
    const { result } = renderHook(() =>
      useAction(async () => fail("VALIDATION", "Bitte Eingaben prüfen.", { grams: ["Zu groß"] })),
    );
    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.fieldErrors).toEqual({ grams: ["Zu groß"] });
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("honours toastOnError=false and true", async () => {
    const failing = async () => fail("CONFLICT", "Existiert bereits.");
    const off = renderHook(() => useAction(failing, { toastOnError: false }));
    await act(async () => {
      await off.result.current.execute();
    });
    expect(toastMock.error).not.toHaveBeenCalled();

    const validation = async () => fail("VALIDATION", "Bitte prüfen.", { a: ["x"] });
    const on = renderHook(() => useAction(validation, { toastOnError: true }));
    await act(async () => {
      await on.result.current.execute();
    });
    expect(toastMock.error).toHaveBeenCalledWith("Bitte prüfen.");
  });

  it("maps thrown errors (network) to a friendly INTERNAL error", async () => {
    const { result } = renderHook(() =>
      useAction(async (): Promise<ActionResult<void>> => {
        throw new TypeError("Failed to fetch");
      }),
    );
    let res: ActionResult<void> | undefined;
    await act(async () => {
      res = await result.current.execute();
    });
    expect(res).toEqual({ ok: false, error: NETWORK_ERROR });
    expect(toastMock.error).toHaveBeenCalledWith(NETWORK_ERROR.message);
  });

  it("keeps execute stable and uses the latest action", async () => {
    const first = vi.fn(async () => ok(1));
    const second = vi.fn(async () => ok(2));
    const { result, rerender } = renderHook(({ fn }) => useAction(fn), { initialProps: { fn: first } });
    const execute = result.current.execute;
    rerender({ fn: second });
    expect(result.current.execute).toBe(execute);
    await act(async () => {
      await result.current.execute();
    });
    expect(second).toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
  });

  it("reset clears error and data", async () => {
    const { result } = renderHook(() => useAction(async () => fail("INTERNAL", "x")));
    await act(async () => {
      await result.current.execute();
    });
    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });
});
