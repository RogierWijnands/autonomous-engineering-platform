import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("simulator API client", () => {
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
});
