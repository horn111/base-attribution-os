import { afterEach, describe, expect, it, vi } from "vitest";
import { appendDataSuffix, type Hex } from "@base-attribution-os/core";
import { checkTransactionCommand } from "../src/commands/check-tx.js";

describe("checkTransactionCommand", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates attribution in direct transaction calldata", async () => {
    const input = appendDataSuffix("0x1234", { codes: ["bc_direct"] });
    mockTransaction(input);

    const result = await checkTransactionCommand({
      hash: hash(),
      rpcUrl: "https://rpc.example",
      expect: "bc_direct",
    });

    expect(result.ok).toBe(true);
    expect(result.message).toBe("Attribution OK: bc_direct");
  });

  it("validates attribution nested in an ERC-4337 v0.6 UserOperation", async () => {
    const callData = appendDataSuffix("0x1234", { codes: ["bc_smart_wallet"] });
    mockTransaction(encodeHandleOpsV06(callData));

    const result = await checkTransactionCommand({
      hash: hash(),
      rpcUrl: "https://rpc.example",
      expect: "bc_smart_wallet",
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("ERC-4337 UserOperation #0");
    expect(result.data).toMatchObject({
      codes: ["bc_smart_wallet"],
      attributionPath: "erc4337-user-operation",
      userOperationIndex: 0,
    });
  });

  it("reports the nested Builder Code when it does not match the expectation", async () => {
    const callData = appendDataSuffix("0x1234", { codes: ["bc_wrong"] });
    mockTransaction(encodeHandleOpsV06(callData));

    const result = await checkTransactionCommand({
      hash: hash(),
      rpcUrl: "https://rpc.example",
      expect: "bc_expected",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('expected Builder Code "bc_expected" was not found');
    expect(result.data).toMatchObject({
      codes: ["bc_wrong"],
      attributionPath: "erc4337-user-operation",
    });
  });

  it("fails safely for malformed handleOps calldata", async () => {
    mockTransaction("0x1fad948c00");

    const result = await checkTransactionCommand({
      hash: hash(),
      rpcUrl: "https://rpc.example",
      expect: "bc_expected",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("missing ERC-8021 marker");
  });
});

function mockTransaction(input: Hex): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { input } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}

function encodeHandleOpsV06(callData: Hex): Hex {
  const emptyBytes = encodeBytes("0x");
  const encodedCallData = encodeBytes(callData);
  const staticBytes = 11 * 32;
  const initCodeOffset = staticBytes;
  const callDataOffset = initCodeOffset + byteLength(emptyBytes);
  const paymasterOffset = callDataOffset + byteLength(encodedCallData);
  const signatureOffset = paymasterOffset + byteLength(emptyBytes);

  const operation = concat([
    addressWord("0x58638325a657FedfcE35264fe253aBBae56bCDd4"),
    word(1),
    word(initCodeOffset),
    word(callDataOffset),
    word(100_000),
    word(100_000),
    word(50_000),
    word(1_000_000),
    word(1_000_000),
    word(paymasterOffset),
    word(signatureOffset),
    emptyBytes,
    encodedCallData,
    emptyBytes,
    emptyBytes,
  ]);

  const operations = concat([word(1), word(32), operation]);
  return concat([
    "0x1fad948c",
    word(64),
    addressWord("0x0000000000000000000000000000000000000001"),
    operations,
  ]);
}

function encodeBytes(value: Hex): Hex {
  const clean = value.slice(2);
  const padding = (64 - (clean.length % 64)) % 64;
  return concat([word(clean.length / 2), `0x${clean}${"0".repeat(padding)}` as Hex]);
}

function addressWord(value: Hex): Hex {
  return `0x${value.slice(2).padStart(64, "0")}` as Hex;
}

function word(value: number): Hex {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}` as Hex;
}

function concat(values: Hex[]): Hex {
  return `0x${values.map((value) => value.slice(2)).join("")}`;
}

function byteLength(value: Hex): number {
  return value.slice(2).length / 2;
}

function hash(): Hex {
  return `0x${"11".repeat(32)}`;
}
