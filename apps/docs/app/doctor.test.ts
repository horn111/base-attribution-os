import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const doctorPath = new URL("./doctor.tsx", import.meta.url);

describe("Attribution Doctor browser preview", () => {
  it("binds evidence per candidate and fails empty snippets closed", async () => {
    const source = await readFile(doctorPath, "utf8");

    expect(source).toContain("attributionEvidence(source, family, candidate)");
    expect(source).toContain("ok: paths.length > 0");
    expect(source).toContain("This browser preview checks one illustrative snippet.");
  });

  it("generates a least-privilege immutable full-project workflow", async () => {
    const source = await readFile(doctorPath, "utf8");

    expect(source).toContain("permissions:");
    expect(source).toContain("contents: read");
    expect(source).toContain("github-action@v0.3.0");
    expect(source).toContain("profile: strict");
    expect(source).toContain('changed-only: "false"');
    expect(source).not.toContain("github-action@main");
  });
});
