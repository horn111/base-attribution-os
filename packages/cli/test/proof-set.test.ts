import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAttributionReplayReport,
  createDataSuffix,
  type AttributionReplayReport,
  type Hex,
} from "@base-attribution-os/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_PROOF_SET_INPUT_BYTES,
  proofSetCommand,
  readReplayReport,
} from "../src/commands/proof-set.js";

const roots: string[] = [];
const BUILDER_CODE = "bc_abc123";
const HASH_A = `0x${"11".repeat(32)}` as Hex;
const HASH_B = `0x${"22".repeat(32)}` as Hex;

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function tempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bao-proof-set-"));
  roots.push(root);
  return root;
}

function report(hash: Hex, calldata: Hex, verified = true): AttributionReplayReport {
  return createAttributionReplayReport([{ hash, calldata, verified }], {
    builderCode: BUILDER_CODE,
    generatedAt: hash === HASH_A ? "2026-09-01T00:00:00Z" : "2026-09-02T00:00:00Z",
  });
}

async function writeReport(root: string, name: string, value: unknown): Promise<string> {
  const file = path.join(root, name);
  await fs.writeFile(file, JSON.stringify(value), "utf8");
  return file;
}

describe("proof-set command", () => {
  it("combines replay JSON files into a canonical manifest", async () => {
    const root = await tempRoot();
    const attributed = createDataSuffix({ codes: [BUILDER_CODE] });
    const first = await writeReport(root, "first.json", report(HASH_A, attributed));
    const second = await writeReport(root, "second.json", report(HASH_B, attributed));

    const result = await proofSetCommand({
      title: "Example project",
      builderCode: BUILDER_CODE,
      inputs: [second.replaceAll("\\", "/"), first],
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      title: "Example project",
      summary: { reports: 2, total: 2, attributed: 2, verified: 2, coverage: 100 },
    });
    expect((result.data as { reports: AttributionReplayReport[] }).reports[0].generatedAt).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("writes JSON and Markdown without exposing calldata in Markdown", async () => {
    const root = await tempRoot();
    const attributed = createDataSuffix({ codes: [BUILDER_CODE] });
    const input = await writeReport(root, "proof.json", report(HASH_A, attributed));
    const jsonOutput = path.join(root, "out", "proof-set.json");
    const markdownOutput = path.join(root, "out", "proof-set.md");

    await proofSetCommand({
      title: "Example project",
      builderCode: BUILDER_CODE,
      inputs: [input],
      output: jsonOutput,
    });
    await proofSetCommand({
      title: "Example project",
      builderCode: BUILDER_CODE,
      inputs: [input],
      format: "markdown",
      output: markdownOutput,
    });

    expect(JSON.parse(await fs.readFile(jsonOutput, "utf8"))).toMatchObject({
      schemaVersion: 1,
      ok: true,
    });
    const markdown = await fs.readFile(markdownOutput, "utf8");
    expect(markdown).toContain("# Attribution Proof Set: Example project");
    expect(markdown).toContain("basescan.org/tx/");
    expect(markdown).not.toContain(attributed);
  });

  it("supports observational output while preserving manifest ok=false", async () => {
    const root = await tempRoot();
    const input = await writeReport(root, "missing.json", report(HASH_A, "0x1234"));
    const result = await proofSetCommand({
      title: "Incomplete evidence",
      builderCode: BUILDER_CODE,
      inputs: [input],
      failOnMissing: false,
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ ok: false, summary: { missing: 1, coverage: 0 } });
  });

  it("rejects mismatched Builder Codes and unsupported formats", async () => {
    const root = await tempRoot();
    const other = createAttributionReplayReport(
      [{ hash: HASH_A, calldata: createDataSuffix({ codes: ["bc_other"] }), verified: true }],
      { builderCode: "bc_other" },
    );
    const input = await writeReport(root, "other.json", other);

    await expect(
      proofSetCommand({
        title: "Mismatch",
        builderCode: BUILDER_CODE,
        inputs: [input],
      }),
    ).rejects.toThrow(/instead of/i);
    await expect(
      proofSetCommand({
        title: "Mismatch",
        builderCode: BUILDER_CODE,
        inputs: [input],
        format: "yaml",
      }),
    ).rejects.toThrow(/unsupported proof-set format/i);
  });

  it("rejects missing, malformed, non-file, and oversized input", async () => {
    const root = await tempRoot();
    const malformed = path.join(root, "malformed.json");
    const oversized = path.join(root, "oversized.json");
    await fs.writeFile(malformed, "{", "utf8");
    await fs.writeFile(oversized, "x".repeat(MAX_PROOF_SET_INPUT_BYTES + 1), "utf8");

    await expect(readReplayReport(path.join(root, "missing.json"))).rejects.toThrow(
      /unable to read/i,
    );
    await expect(readReplayReport(root)).rejects.toThrow(/not a file/i);
    await expect(readReplayReport(malformed)).rejects.toThrow(/unable to parse/i);
    await expect(readReplayReport(oversized)).rejects.toThrow(/2 MiB/i);
    await expect(
      proofSetCommand({ title: "Empty", builderCode: BUILDER_CODE, inputs: [] }),
    ).rejects.toThrow(/at least one/i);
  });
});
