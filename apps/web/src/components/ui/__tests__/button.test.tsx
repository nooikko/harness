import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../button";

describe("Button", () => {
  it("renders as a button element by default", () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe("BUTTON");
  });

  it("renders as child element when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );

    const link = screen.getByRole("link", { name: "Link Button" });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe("A");
  });

  it("applies variant classes", () => {
    render(<Button variant="outline">Outline</Button>);

    const button = screen.getByRole("button", { name: "Outline" });
    expect(button.className).toContain("border");
  });

  it("applies size classes", () => {
    render(<Button size="lg">Large</Button>);

    const button = screen.getByRole("button", { name: "Large" });
    expect(button.className).toContain("h-11");
  });

  it("merges custom className", () => {
    render(<Button className="custom-class">Custom</Button>);

    const button = screen.getByRole("button", { name: "Custom" });
    expect(button.className).toContain("custom-class");
  });

  it("forwards ref to the button element", () => {
    let buttonRef: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(el) => {
          buttonRef = el;
        }}
      >
        Ref
      </Button>
    );

    expect(buttonRef).toBeInstanceOf(HTMLButtonElement);
  });
});
