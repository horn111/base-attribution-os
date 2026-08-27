import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveActionProfile, resolveFailOnMissing } from "../src/options.js";

describe("@base-attribution-os/github-action", () => {
  it("uses the config profile when the workflow input is omitted", () => {
    expect(resolveActionProfile("", "strict")).toBe("strict");
    expect(resolveActionProfile("local", "strict")).toBe("local");
    expect(resolveActionProfile("", undefined)).toBe("ci");
  });

  it("parses fail-on-missing consistently", () => {
    expect(resolveFailOnMissing("")).toBe(true);
    expect(resolveFailOnMissing("true")).toBe(true);
    expect(resolveFailOnMissing("false")).toBe(false);
    expect(resolveFailOnMissing(" FALSE ")).toBe(false);
  });

  it("does not mask bao.config.json with an action.yml profile default", async () => {
    const actionPath = fileURLToPath(new URL("../action.yml", import.meta.url));
    const action = await readFile(actionPath, "utf8");
    const profileBlock = action.match(/ {2}profile:\r?\n([\s\S]*?)(?= {2}fail-on-missing:)/)?.[1];

    expect(profileBlock).toBeDefined();
    expect(profileBlock).not.toContain("default:");
  });
});
