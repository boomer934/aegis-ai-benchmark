import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("React Testing Library infrastructure", () => {
  it("renders JSX into the jsdom document", () => {
    render(<p>Testing Library is configured</p>);
    expect(screen.getByText("Testing Library is configured")).toBeInTheDocument();
  });
});
