/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StructuredAssistantMessage } from "@/components/chat/StructuredAssistantMessage";

describe("StructuredAssistantMessage", () => {
  it("renders rhyme options in a grid instead of a numbered list", () => {
    render(
      <StructuredAssistantMessage
        structured={{
          mode: "find_rhymes",
          scope: "section",
          summary: "Rhymes for flat",
          options: ["cat", "hat", "spat", "format"],
        }}
      />,
    );

    const rhymeList = screen.getByLabelText(/rhyme suggestions/i);
    expect(rhymeList).toBeInTheDocument();
    expect(rhymeList.className).toContain("grid");
    expect(screen.getByRole("button", { name: /rhyme: cat/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rhyme: hat/i })).toBeInTheDocument();
  });

  it("renders thesaurus options in a word grid", () => {
    render(
      <StructuredAssistantMessage
        structured={{
          mode: "diagnose",
          scope: "selection",
          summary: "Near “bright”",
          options: ["vivid", "lucid"],
        }}
      />,
    );

    const list = screen.getByLabelText(/thesaurus options/i);
    expect(list.className).toContain("grid");
    expect(
      screen.getByRole("button", { name: /synonym: vivid/i }),
    ).toBeInTheDocument();
  });

  it("keeps numbered list for suggestion rewrites", () => {
    const { container } = render(
      <StructuredAssistantMessage
        structured={{
          mode: "suggest_rewrites",
          scope: "selection",
          summary: "Try these",
          options: ["First rewrite", "Second rewrite"],
          recommendedOption: 0,
        }}
      />,
    );

    expect(container.querySelector("ol")).toBeTruthy();
    expect(screen.queryByLabelText(/rhyme suggestions/i)).not.toBeInTheDocument();
  });
});
