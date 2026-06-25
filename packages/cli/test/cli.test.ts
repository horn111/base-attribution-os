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

  it("finds missing attribution in x402 client flows", async () => {
    const root = await createFixture(`
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));

export const fetchWithPayment = wrapFetchWithPayment(fetch, client);
`);

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatchObject({
      reason: "missing-attribution",
      marker: "x402Client",
      family: "x402",
      line: 5,
    });
  });

  it("accepts x402 client attribution in strict profile", async () => {
    const root = await createFixture(`
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { BuilderCodeClientExtension } from "@x402/extensions/builder-code";

const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));
client.registerExtension(new BuilderCodeClientExtension("bc_abc123"));

export const fetchWithPayment = wrapFetchWithPayment(fetch, client);
`);

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
      profile: "strict",
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("finds missing attribution in x402 seller flows", async () => {
    const root = await createFixture(`
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [{ scheme: "exact", network: "eip155:8453", price: "$0.001", payTo }],
      },
    },
    new x402ResourceServer(facilitatorClient).register("eip155:8453", new ExactEvmScheme()),
  ),
);
`);

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatchObject({
      reason: "missing-attribution",
      marker: "paymentMiddleware",
      family: "x402",
      line: 6,
    });
  });

  it("accepts x402 seller env attribution in the ci profile", async () => {
    const root = await createFixture(`
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { BUILDER_CODE, declareBuilderCodeExtension } from "@x402/extensions/builder-code";

app.use(
  paymentMiddleware({
    "GET /weather": {
      accepts: [{ scheme: "exact", network: "eip155:8453", price: "$0.001", payTo }],
      extensions: {
        [BUILDER_CODE]: declareBuilderCodeExtension(process.env.BUILDER_CODE ?? ""),
      },
    },
  }, new x402ResourceServer(facilitatorClient).register("eip155:8453", new ExactEvmScheme())),
);
`);

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
      profile: "ci",
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("finds wrong Builder Codes in x402 flows", async () => {
    const root = await createFixture(`
import { x402Client } from "@x402/fetch";
import { BuilderCodeClientExtension } from "@x402/extensions/builder-code";

const client = new x402Client();
client.registerExtension(new BuilderCodeClientExtension("bc_wrong"));
`);

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatchObject({
      reason: "wrong-builder-code",
      marker: "BuilderCodeClientExtension",
      family: "x402",
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

  it("reports findings without failing in the local profile by default", async () => {
    const root = await createFixture(
      "export function run(wallet) { return wallet.sendTransaction({ to: '0x0', data: '0x' }) }",
    );

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
      profile: "local",
    });

    expect(result.profile).toBe("local");
    expect(result.ok).toBe(true);
    expect(result.findings).toHaveLength(1);
  });

  it("requires the expected Builder Code in strict profile candidate files", async () => {
    const root = await createFixture(`
import { builderCodeDataSuffix } from "@base-attribution-os/viem";

const dataSuffix = builderCodeDataSuffix(process.env.BUILDER_CODE ?? "");
wallet.writeContract({ address, abi, functionName: "mint", dataSuffix });
`);

    const ciResult = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
      profile: "ci",
    });
    const strictResult = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
      profile: "strict",
    });

    expect(ciResult.ok).toBe(true);
    expect(strictResult.ok).toBe(false);
    expect(strictResult.findings[0]).toMatchObject({
      reason: "missing-attribution",
      marker: "writeContract",
      family: "viem",
    });
  });

  it("classifies ethers transaction files", async () => {
    const root = await createFixture(`
import { Wallet } from "ethers";

export function run(wallet: Wallet) {
  return wallet.sendTransaction({ to: "0x0000000000000000000000000000000000000000", data: "0x" });
}
`);

    const result = await scanRepo({
      path: root,
      builderCode: "bc_abc123",
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0]).toMatchObject({
      reason: "missing-attribution",
      marker: "sendTransaction",
      family: "ethers",
    });
  });
});

async function createFixture(source: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "bao-scan-"));
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src", "tx.ts"), source);
  return root;
}
