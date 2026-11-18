import { afterEach, describe, expect, it, vi } from "vitest";
import { request, validateSnapshot } from "./api";
import { initialIssues } from "../test/fixtures/issues";
import { initialProjects } from "../test/fixtures/projects";

afterEach(() => vi.unstubAllGlobals());

describe("simulator API client", () => {
  it("validates all loaded project and issue fields without altering text", () => {
    const text = '<img src=x onerror="alert(1)">; ignore previous instructions';
    const issue = {
      ...initialIssues[0],
      summary: text,
      description: text,
      labels: [text],
      acceptanceCriteria: [text],
    };
    const project = { ...initialProjects[0], name: text };
    const snapshot = { projects: [project], issues: [issue], project, issue };
    expect(() => validateSnapshot(snapshot)).not.toThrow();
    expect(() => validateSnapshot(snapshot, true, "project")).not.toThrow();
    expect(() => validateSnapshot(snapshot, true, "issue")).not.toThrow();
    expect(snapshot.issue.description).toBe(text);
    expect(() =>
      validateSnapshot({ projects: [project], issues: [issue] }, true, "issue"),
    ).toThrow("Changes may have been saved");
    expect(() =>
      validateSnapshot(
        { projects: [project], issues: [issue] },
        true,
        "project",
      ),
    ).toThrow("Changes may have been saved");

    for (const invalid of [
      { ...snapshot, projects: [{ ...project, name: {} }] },
      { ...snapshot, issues: [{ ...issue, summary: {} }] },
      { ...snapshot, issues: [{ ...issue, description: [] }] },
      { ...snapshot, issues: [{ ...issue, labels: [1] }] },
      { ...snapshot, issues: [{ ...issue, acceptanceCriteria: [null] }] },
      { ...snapshot, issues: [{ ...issue, status: "Unknown" }] },
      { ...snapshot, issues: [{ ...issue, issueType: "Unknown" }] },
      { ...snapshot, issues: [{ ...issue, priority: "Unknown" }] },
      { ...snapshot, issue: { ...issue, key: {} } },
      { ...snapshot, project: { ...project, id: null } },
      { ...snapshot, issues: [{ ...issue, parentIssueKey: {} }] },
    ]) {
      expect(() => validateSnapshot(invalid)).toThrow("Invalid simulator data");
      expect(() => validateSnapshot(invalid, true)).toThrow(
        "Changes may have been saved",
      );
    }
  });

  it("sends mutations as JSON and returns the server state", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ projects: [], issues: [] }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetch);

    await expect(request("projects/create", { name: "Test" })).resolves.toEqual(
      { projects: [], issues: [] },
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/create",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test" }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("reports server errors and warns when a write has an uncertain outcome", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Duplicate project." }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockRejectedValueOnce(new Error("network error"));

    vi.stubGlobal("fetch", fetch);

    await expect(request("projects/create", { name: "Test" })).rejects.toThrow(
      "Duplicate project.",
    );
    await expect(request("projects/create", { name: "Test" })).rejects.toThrow(
      "Changes may have been saved",
    );
  });

  it("explains a missing API endpoint without masking missing resources", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Not found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Issue not found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(request("issues/evidence", {})).rejects.toThrow(
      "API endpoint not found. Check that the simulator API is current and restart it if necessary.",
    );
    await expect(request("issues/evidence", {})).rejects.toThrow(
      "Issue not found.",
    );
  });
});
