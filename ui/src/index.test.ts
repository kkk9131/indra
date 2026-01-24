import { describe, it, expect } from "vitest";

describe("Indra UI", () => {
  it("module exports are defined", async () => {
    const module = await import("./ui/index.js");
    expect(module).toBeDefined();
  });
});
