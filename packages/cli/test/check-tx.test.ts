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

  it("validates attribution nested in an ERC-4337 v0.7 PackedUserOperation", async () => {
    const callData = appendDataSuffix("0xabcd", { codes: ["bc_wallet", "bc_app"] });
    mockTransaction(encodeHandleOpsV07(callData));

    const result = await checkTransactionCommand({
      hash: hash(),
      rpcUrl: "https://rpc.example",
      expect: ["bc_wallet", "bc_app"],
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      codes: ["bc_wallet", "bc_app"],
      attributionPath: "erc4337-user-operation",
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

  it("continues past an earlier wrong UserOperation to find a later match", async () => {
    const wrong = appendDataSuffix("0x1234", { codes: ["bc_wrong"] });
    const expected = appendDataSuffix("0x5678", { codes: ["bc_expected"] });
    mockTransaction(encodeHandleOpsV06Many([wrong, expected]));

    const result = await checkTransactionCommand({
      hash: hash(),
      rpcUrl: "https://rpc.example",
      expect: "bc_expected",
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ userOperationIndex: 1, codes: ["bc_expected"] });
  });

  it("does not accept attribution appended only to the outer handleOps calldata", async () => {
    const input = appendDataSuffix(encodeHandleOpsV06("0x1234"), { codes: ["bc_outer"] });
    mockTransaction(input);

    const result = await checkTransactionCommand({
      hash: hash(),
      rpcUrl: "https://rpc.example",
      expect: "bc_outer",
    });

    expect(result.ok).toBe(false);
  });

  it("fails safely for malformed handleOps calldata", async () => {
    mockTransaction("0x1fad948c00");

    const result = await checkTransactionCommand({
      hash: hash(),
      rpcUrl: "https://rpc.example",
      expect: "bc_expected",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Unable to decode UserOperations");
  });

  it("rejects transaction evidence from a non-Base RPC", async () => {
    mockTransaction(appendDataSuffix("0x1234", { codes: ["bc_direct"] }), {
      chainId: "0x1",
    });

    const result = await checkTransactionCommand({
      hash: hash(),
      rpcUrl: "https://rpc.example",
      expect: "bc_direct",
    });

    expect(result).toMatchObject({ ok: false });
    expect(result.message).toContain("is not Base mainnet or Base Sepolia");
  });

  it("rejects reverted and unmined transaction evidence", async () => {
    const input = appendDataSuffix("0x1234", { codes: ["bc_direct"] });
    mockTransaction(input, { receiptStatus: "0x0" });
    await expect(
      checkTransactionCommand({
        hash: hash(),
        rpcUrl: "https://rpc.example",
        expect: "bc_direct",
      }),
    ).resolves.toMatchObject({ ok: false, message: "Transaction receipt is not successful." });

    mockTransaction(input, { receipt: false });
    await expect(
      checkTransactionCommand({
        hash: hash(),
        rpcUrl: "https://rpc.example",
        expect: "bc_direct",
      }),
    ).resolves.toMatchObject({ ok: false, message: expect.stringContaining("not mined") });
  });
});

function mockTransaction(
  input: Hex,
  options: { chainId?: Hex; receipt?: boolean; receiptStatus?: Hex } = {},
): void {
  const selector = input.slice(0, 10).toLowerCase();
  const to =
    selector === "0x1fad948c"
      ? "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
      : selector === "0x765e827f"
        ? "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
        : "0x0000000000000000000000000000000000000001";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { method: string };
      const result =
        request.method === "eth_getTransactionByHash"
          ? { hash: hash(), input, to }
          : request.method === "eth_chainId"
            ? (options.chainId ?? "0x2105")
            : options.receipt === false
              ? null
              : {
                  transactionHash: hash(),
                  status: options.receiptStatus ?? "0x1",
                };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

function encodeHandleOpsV06(callData: Hex): Hex {
  return encodeHandleOpsV06Many([callData]);
}

function encodeHandleOpsV06Many(callDatas: Hex[]): Hex {
  const operations = callDatas.map(encodeUserOperationV06);
  const offsets: Hex[] = [];
  let offset = callDatas.length * 32;
  for (const operation of operations) {
    offsets.push(word(offset));
    offset += byteLength(operation);
  }

  const encodedOperations = concat([word(callDatas.length), ...offsets, ...operations]);
  return concat([
    "0x1fad948c",
    word(64),
    addressWord("0x0000000000000000000000000000000000000001"),
    encodedOperations,
  ]);
}

function encodeUserOperationV06(callData: Hex): Hex {
  const emptyBytes = encodeBytes("0x");
  const encodedCallData = encodeBytes(callData);
  const staticBytes = 11 * 32;
  const initCodeOffset = staticBytes;
  const callDataOffset = initCodeOffset + byteLength(emptyBytes);
  const paymasterOffset = callDataOffset + byteLength(encodedCallData);
  const signatureOffset = paymasterOffset + byteLength(emptyBytes);

  return concat([
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
}

function encodeHandleOpsV07(callData: Hex): Hex {
  const emptyBytes = encodeBytes("0x");
  const encodedCallData = encodeBytes(callData);
  const staticBytes = 9 * 32;
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
    word(50_000),
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
    "0x765e827f",
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
