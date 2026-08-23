import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  appendDataSuffix,
  type AttributionReplayReport,
  type Hex,
} from "@base-attribution-os/core";
import { proofTransactionCommand } from "../src/commands/proof.js";
import { readReplayInput, replayCommand } from "../src/commands/replay.js";

const HASH_ONE = `0x${"11".repeat(32)}` as Hex;
const HASH_TWO = `0x${"22".repeat(32)}` as Hex;

describe("attribution replay CLI", () => {
  it("reads Dune-compatible JSON and creates a replay report", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bao-replay-"));
    const input = path.join(root, "dune.json");
    const calldata = appendDataSuffix("0x1234", { codes: ["bc_abc123"] });
    await writeFile(
      input,
      JSON.stringify([
        { tx_hash: HASH_ONE, calldata, block_time: "2026-08-23T10:00:00Z" },
        { tx_hash: HASH_TWO, calldata: "0x1234", block_time: "2026-08-23T10:01:00Z" },
      ]),
    );

    const result = await replayCommand({
      builderCode: "bc_abc123",
      input,
      generatedAt: "2026-08-23T11:00:00Z",
      format: "human",
    });
    const report = result.data as AttributionReplayReport;

    expect(result.ok).toBe(false);
    expect(result.message).toContain("1/2 transactions attributed");
    expect(report).toMatchObject({
      attributed: 1,
      missing: 1,
      coverage: 50,
    });
    expect(report.transactions[0].timestamp).toBe("2026-08-23T10:00:00Z");
  });

  it("reads quoted CSV exports", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bao-replay-csv-"));
    const input = path.join(root, "dune.csv");
    const calldata = appendDataSuffix("0x", { codes: ["bc_abc123", "wallet"] });
    await writeFile(
      input,
      `tx_hash,calldata,block_time\n"${HASH_ONE}","${calldata}","2026-08-23 10:00:00"\n`,
    );

    const candidates = await readReplayInput(input);

    expect(candidates).toEqual([
      expect.objectContaining({
        hash: HASH_ONE,
        calldata,
        timestamp: "2026-08-23 10:00:00",
      }),
    ]);
  });

  it("fetches missing calldata with one JSON-RPC batch", async () => {
    const calldata = appendDataSuffix("0x", { codes: ["bc_abc123"] });
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const requests = JSON.parse(String(init?.body)) as Array<{ id: number }>;
      return new Response(
        JSON.stringify(
          requests.map((request) => ({
            jsonrpc: "2.0",
            id: request.id,
            result: { input: calldata, blockNumber: "0x1" },
          })),
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await replayCommand({
      builderCode: "bc_abc123",
      hashes: [HASH_ONE, HASH_TWO],
      rpcUrl: "https://mainnet.base.org",
      fetcher,
    });
    const report = result.data as AttributionReplayReport;

    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(report).toMatchObject({ attributed: 2, total: 2, coverage: 100 });
  });

  it("writes a single-transaction Markdown proof", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bao-proof-"));
    const output = path.join(root, "proof.md");
    const calldata = appendDataSuffix("0x", { codes: ["bc_abc123"] });
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify([{ jsonrpc: "2.0", id: 1, result: { input: calldata } }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as typeof fetch;

    const result = await proofTransactionCommand({
      hash: HASH_ONE,
      rpcUrl: "https://mainnet.base.org",
      expect: "bc_abc123",
      output,
      fetcher,
    });

    expect(result.ok).toBe(true);
    expect(await readFile(output, "utf8")).toContain("# Attribution Proof: bc_abc123");
    expect(await readFile(output, "utf8")).toContain("100% coverage");
  });
});
