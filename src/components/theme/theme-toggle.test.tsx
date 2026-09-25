// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

function setup(props?: Parameters<typeof ThemeToggle>[0]) {
  render(
    <ThemeProvider>
      <ThemeToggle {...props} />
    </ThemeProvider>,
  );
  return userEvent.setup();
}

describe("ThemeToggle", () => {
  it("renders an accessible radiogroup with System selected by default", () => {
    setup();
    expect(screen.getByRole("radiogroup", { name: "Farbschema" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
  });

  it("switches to dark on click and applies the class to <html>", async () => {
    const user = setup();
    await user.click(screen.getByRole("radio", { name: "Dunkel" }));
    expect(screen.getByRole("radio", { name: "Dunkel" })).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("supports arrow-key navigation with roving tabindex", async () => {
    const user = setup();
    await user.tab();
    expect(screen.getByRole("radio", { name: "System" })).toHaveFocus();
    await user.keyboard("{ArrowRight}"); // wraps to first option
    const light = screen.getByRole("radio", { name: "Hell" });
    expect(light).toHaveFocus();
    expect(light).toHaveAttribute("aria-checked", "true");
    expect(light).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute("tabindex", "-1");
  });

  it("keeps accessible names in icon-only mode", () => {
    setup({ iconOnly: true });
    for (const name of ["Hell", "Dunkel", "System"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
  });
});
