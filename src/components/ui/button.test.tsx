// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { IconButton } from "./icon-button";

afterEach(cleanup);

describe("Button", () => {
  it("renders a type=button by default and handles clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Speichern</Button>);
    const button = screen.getByRole("button", { name: "Speichern" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and not clickable when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Speichern
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Speichern" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows a busy, disabled state while loading but keeps its label", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Speichern
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Speichern/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Wird geladen");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders its child with asChild", () => {
    render(
      <Button asChild>
        <a href="/today">Zu Heute</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Zu Heute" });
    expect(link).toHaveAttribute("data-slot", "button");
  });

  it("gives icon buttons an accessible name", () => {
    render(
      <IconButton label="Eintrag löschen">
        <svg />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Eintrag löschen" })).toBeInTheDocument();
  });
});
