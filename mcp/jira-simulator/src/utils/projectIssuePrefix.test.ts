import { describe, expect, it } from "vitest";
import { projectIssuePrefix } from "./projectIssuePrefix";

describe("projectIssuePrefix", () => {
  it("uses the first word and normalizes it for issue IDs", () => {
    expect(projectIssuePrefix("café tools")).toBe("CAFE");
    expect(projectIssuePrefix("alpha-beta project")).toBe("ALPHABETA");
  });

  it("uses the next word when the first word has one character", () => {
    expect(projectIssuePrefix("A Project")).toBe("AP");
  });

  it("limits prefixes to ten characters and handles empty names", () => {
    expect(projectIssuePrefix("Extraordinary project")).toBe("EXTRAORDIN");
    expect(projectIssuePrefix("   ")).toBe("");
  });
});
