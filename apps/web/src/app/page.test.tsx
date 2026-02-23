import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("renders the heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Harness" })
    ).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<Home />);

    expect(screen.getByText(/Claude Orchestrator/)).toBeInTheDocument();
  });

  it("renders action buttons", () => {
    render(<Home />);

    expect(
      screen.getByRole("button", { name: "Get Started" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Learn More" })
    ).toBeInTheDocument();
  });
});
