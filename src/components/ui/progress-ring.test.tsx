// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CalorieBudget } from "./calorie-budget";
import { MacroBar } from "./macro-bar";
import { MacroChips } from "./macro-chips";
import { MacroRings } from "./macro-rings";
import { ProgressRing } from "./progress-ring";

afterEach(cleanup);

describe("ProgressRing", () => {
  it("exposes progressbar semantics with a German value text", () => {
    render(
      <ProgressRing value={1450} max={2000} label="Kalorien" unit="kcal" animate={false}>
        <span>550</span>
      </ProgressRing>,
    );
    const ring = screen.getByRole("progressbar", { name: "Kalorien" });
    expect(ring).toHaveAttribute("aria-valuenow", "1450");
    expect(ring).toHaveAttribute("aria-valuemin", "0");
    expect(ring).toHaveAttribute("aria-valuemax", "2000");
    expect(ring).toHaveAttribute("aria-valuetext", "1.450 von 2.000 kcal, 550 kcal übrig");
    expect(ring).not.toHaveAttribute("data-over");
    expect(ring).toHaveTextContent("550");
    // track + progress arc, no overflow lap
    expect(ring.querySelectorAll("circle")).toHaveLength(2);
  });

  it("clamps aria-valuenow and draws a second lap when over target", () => {
    render(<ProgressRing value={2500} max={2000} label="Kalorien" unit="kcal" animate={false} />);
    const ring = screen.getByRole("progressbar", { name: "Kalorien" });
    expect(ring).toHaveAttribute("aria-valuenow", "2000");
    expect(ring).toHaveAttribute("data-over", "true");
    expect(ring).toHaveAttribute("aria-valuetext", "2.500 von 2.000 kcal, 500 kcal über Ziel");
    const circles = ring.querySelectorAll("circle");
    expect(circles).toHaveLength(3);
    const circumference = Number(circles[1].getAttribute("stroke-dasharray"));
    // first lap full (offset 0), second lap 25 % (offset 75 % of circumference), thinner + 2° gap
    expect(Number(circles[1].getAttribute("stroke-dashoffset"))).toBeCloseTo(0);
    expect(Number(circles[2].getAttribute("stroke-dashoffset"))).toBeCloseTo(circumference * 0.75, 1);
    expect(Number(circles[2].getAttribute("stroke-width"))).toBeLessThan(
      Number(circles[1].getAttribute("stroke-width")),
    );
    expect(circles[2].getAttribute("transform")).toMatch(/^rotate\(2 /);
  });

  it("uses the requested geometry", () => {
    render(<ProgressRing value={50} max={100} label="Wasser" size={80} strokeWidth={8} animate={false} />);
    const ring = screen.getByRole("progressbar", { name: "Wasser" });
    expect(ring.style.getPropertyValue("--ring-size")).toBe("80px");
    const arc = ring.querySelectorAll("circle")[1];
    expect(arc).toHaveAttribute("r", "36");
    expect(Number(arc.getAttribute("stroke-dashoffset"))).toBeCloseTo(Math.PI * 36, 1);
  });
});

describe("MacroBar", () => {
  it("shows consumed / target and remaining", () => {
    render(<MacroBar label="Protein" consumed={82} target={140} tone="protein" animate={false} />);
    const bar = screen.getByRole("progressbar", { name: "Protein" });
    expect(bar).toHaveAttribute("aria-valuenow", "82");
    expect(bar).toHaveAttribute("aria-valuemax", "140");
    expect(bar).toHaveAttribute("aria-valuetext", "82 von 140 g, 58 g übrig");
    expect(screen.getByText(/übrig/).textContent?.replace(/\s/g, " ")).toBe("58 g übrig");
  });

  it("renders an over-target segment and text", () => {
    const { container } = render(
      <MacroBar label="Fett" consumed={80} target={70} tone="fat" animate={false} />,
    );
    const bar = screen.getByRole("progressbar", { name: "Fett" });
    expect(bar).toHaveAttribute("aria-valuenow", "70");
    expect(bar).toHaveAttribute("aria-valuetext", "80 von 70 g, 10 g über Ziel");
    expect(container.querySelector("[data-over]")).not.toBeNull();
    expect(bar.querySelector("[data-slot=macro-bar-over]")).toHaveClass("bg-over");
    expect(screen.getByText(/über Ziel/).textContent?.replace(/\s/g, " ")).toBe("10 g über Ziel");
  });
});

describe("nutrition composites", () => {
  it("MacroRings renders three labelled rings", () => {
    render(
      <MacroRings
        animate={false}
        protein={{ consumed: 82, target: 140 }}
        carbs={{ consumed: 150, target: 220 }}
        fat={{ consumed: 40, target: 70 }}
      />,
    );
    expect(screen.getAllByRole("progressbar")).toHaveLength(3);
    expect(screen.getByRole("progressbar", { name: "Kohlenhydrate" })).toHaveAttribute(
      "aria-valuenow",
      "150",
    );
  });

  it("MacroChips exposes full nutrient names to screen readers", () => {
    const { container } = render(<MacroChips protein={12.4} carbs={30} fat={5} kcal={230} />);
    expect(container).toHaveTextContent("230kcal");
    expect(screen.getByText("Protein")).toHaveClass("sr-only");
    expect(screen.getByText("Kohlenhydrate")).toHaveClass("sr-only");
  });

  it("CalorieBudget shows goal, remaining or surplus as the one hero number", () => {
    const { rerender } = render(<CalorieBudget consumed={0} target={2300} animate={false} />);
    expect(screen.getByText("kcal Ziel")).toBeInTheDocument();
    expect(screen.getByText("2.300", { selector: ".text-display" })).toBeInTheDocument();

    rerender(<CalorieBudget consumed={1620} target={2300} activity={240} animate={false} />);
    expect(screen.getByText("kcal übrig")).toBeInTheDocument();
    expect(screen.getByText("920", { selector: ".text-display" })).toBeInTheDocument();
    expect(screen.getByText("+240")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Kalorien" })).toHaveAttribute(
      "aria-valuetext",
      "1.620 von 2.540 kcal, 920 kcal übrig",
    );

    rerender(<CalorieBudget consumed={2420} target={2300} animate={false} />);
    expect(screen.getByText("kcal drüber")).toBeInTheDocument();
    expect(screen.getByText("120", { selector: ".text-display" })).toBeInTheDocument();
  });
});
