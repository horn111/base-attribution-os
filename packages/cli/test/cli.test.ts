import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendDataSuffix } from "@base-attribution-os/core";
import { checkCalldataCommand } from "../src/commands/check-calldata.js";
import { encodeCommand } from "../src/commands/encode.js";
import { scanRepo } from "../src/commands/scan-repo.js";

describe("@base-attribution-os/cli", () => {
  it("encodes suffixes", () => {
    const result = encodeCommand({ code: "baseapp" });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("80218021802180218021802180218021");
  });

  it("checks calldata against an expected Builder Code", () => {
    const calldata = appendDataSuffix("0x", { codes: ["baseapp"] });
    const result = checkCalldataCommand({ calldata, expect: "baseapp" });

    expect(result.ok).toBe(true);
  });

  it("finds missing attribution in transaction files", async () => {
    const root = await createFixture(
      "export function run(wallet) { return wallet.sendTransaction({ to: '0x0', data: '0x' }) }",
    );

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatchObject({
      reason: "missing-attribution",
      marker: "sendTransaction",
      family: "viem",
      line: 1,
    });
  });

  it("finds wrong Builder Codes in transaction files", async () => {
    const root = await createFixture(
      "export const BUILDER_CODE = 'bc_wrong'; wallet.sendTransaction({ dataSuffix: BUILDER_CODE })",
    );

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatchObject({
      reason: "wrong-builder-code",
      marker: "sendTransaction",
      family: "viem",
    });
  });

  it("finds missing attribution in wagmi hook flows", async () => {
    const root = await createFixture(`
import { useSendTransaction } from "wagmi";

export function Button() {
  const { sendTransaction } = useSendTransaction();
  return sendTransaction({ to: "0x0000000000000000000000000000000000000000", data: "0x" });
}
`);

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatchObject({
      reason: "missing-attribution",
      marker: "useSendTransaction",
      family: "wagmi",
      line: 5,
    });
  });

  it("finds missing attribution in wallet_sendCalls flows", async () => {
    const root = await createFixture(`
export async function batch(provider) {
  return provider.request({ method: "wallet_sendCalls", params: [{ calls: [] }] });
}
`);

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatchObject({
      reason: "missing-attribution",
      marker: "sendCalls",
      family: "wallet",
      line: 3,
    });
  });

  it("finds missing attribution in agent transaction tools", async () => {
    const root = await createFixture(`
export const transactionTool = {
  name: "send-base-transaction",
  execute: async ({ wallet, tx }) => wallet.sendTransaction(tx),
};
`);

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatchObject({
      reason: "missing-attribution",
      marker: "agentTransactionTool",
      family: "agent",
      line: 2,
    });
  });

  it("accepts attributed transaction helpers", async () => {
    const root = await createFixture(`
import { builderCodeDataSuffix } from "@base-attribution-os/viem";

const dataSuffix = builderCodeDataSuffix("bc_abc123");
wallet.writeContract({ address, abi, functionName: "mint", dataSuffix });
`);

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });
});

async function createFixture(source: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "bao-scan-"));
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src", "tx.ts"), source);
  return root;
}
