import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ className: "inter-mock" }),
}));

// Import after mock is set up
const { default: RootLayout, metadata } = await import("../layout");

describe("RootLayout", () => {
  it("exports dashboard metadata with correct title", () => {
    expect(metadata.title).toBe("Harness Dashboard");
  });

  it("exports dashboard metadata with correct description", () => {
    expect(metadata.description).toBe("Orchestrator dashboard — threads, tasks, crons, and real-time monitoring");
  });

  it("renders children within an html structure", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>Hello</p>
      </RootLayout>
    );

    expect(html).toContain("<html");
    expect(html).toContain("<body");
    expect(html).toContain("<p>Hello</p>");
  });

  it("applies the Inter font className to the body", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <span>content</span>
      </RootLayout>
    );

    expect(html).toContain('class="inter-mock"');
  });
});
