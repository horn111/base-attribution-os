import { describe, expect, it, vi } from "vitest";
import {
  appendDataSuffix,
  createDataSuffix,
  decodeAttributionFromCalldata,
  type Hex,
} from "@base-attribution-os/core";
import {
  attributeUserOperation,
  createAttributionProvider,
  getDataSuffixSupport,
  sendAttributedCalls,
  validateUserOperationAttribution,
  withUserOperationAttribution,
  type Eip1193Provider,
  type Eip1193Request,
  type SendCallsRequest,
} from "../src/index.js";

const account = `0x${"11".repeat(20)}` as Hex;
const to = `0x${"22".repeat(20)}` as Hex;

describe("@base-attribution-os/wallet capabilities", () => {
  it("finds chain-specific and global dataSuffix support", async () => {
    const chainProvider = providerReturning({
      "0x2105": { dataSuffix: { supported: true } },
    });
    const globalProvider = providerReturning({
      "0x0": { dataSuffix: { supported: true } },
    });

    await expect(
      getDataSuffixSupport(chainProvider, { account, chainId: 8453 }),
    ).resolves.toMatchObject({ status: "supported", chainId: "0x2105", source: "chain" });
    await expect(
      getDataSuffixSupport(globalProvider, { account, chainId: "0x2105" }),
    ).resolves.toMatchObject({ status: "supported", source: "global" });
  });

  it("retries Base Account capability discovery without a chain list", async () => {
    const request = vi
      .fn<(request: Eip1193Request) => Promise<unknown>>()
      .mockRejectedValueOnce(Object.assign(new Error("invalid params"), { code: -32602 }))
      .mockResolvedValueOnce({ "0x2105": { dataSuffix: { supported: true } } });

    const support = await getDataSuffixSupport({ request }, { account, chainId: 8453 });

    expect(support.status).toBe("supported");
    expect(request).toHaveBeenNthCalledWith(1, {
      method: "wallet_getCapabilities",
      params: [account, ["0x2105"]],
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      method: "wallet_getCapabilities",
      params: [account],
    });
  });

  it("distinguishes unsupported, unavailable, and malformed responses", async () => {
    await expect(
      getDataSuffixSupport(providerReturning({ "0x2105": {} }), { account, chainId: 8453 }),
    ).resolves.toMatchObject({ status: "unsupported", reason: "not-advertised" });
    await expect(
      getDataSuffixSupport(providerReturning({ "0x2105": { dataSuffix: {} } }), {
        account,
        chainId: 8453,
      }),
    ).resolves.toMatchObject({ status: "unavailable", reason: "malformed-response" });
    await expect(
      getDataSuffixSupport(providerThrowing(new Error("method unavailable")), {
        account,
        chainId: 8453,
      }),
    ).resolves.toMatchObject({ status: "unavailable", reason: "request-failed" });
  });
});

describe("app-side wallet attribution", () => {
  it("checks support before sending an attributed batch without mutating input", async () => {
    const request = vi.fn(async (rpc: Eip1193Request) => {
      if (rpc.method === "wallet_getCapabilities") {
        return { "0x2105": { dataSuffix: { supported: true } } };
      }
      return "0xbatch";
    });
    const provider = { request };
    const input = sendCallsRequest();

    const sent = await sendAttributedCalls<string>(provider, input, {
      codes: ["bc_app", "bc_partner"],
    });

    expect(sent).toMatchObject({
      result: "0xbatch",
      attribution: { delivery: "dataSuffix", codes: ["bc_app", "bc_partner"] },
    });
    expect(request.mock.calls.map(([rpc]) => rpc.method)).toEqual([
      "wallet_getCapabilities",
      "wallet_sendCalls",
    ]);
    const submitted = (request.mock.calls[1][0].params as unknown[])[0] as SendCallsRequest;
    expect(submitted.capabilities).toMatchObject({
      paymasterService: { url: "https://paymaster.example" },
      dataSuffix: { optional: false },
    });
    expect(
      decodeAttributionFromCalldata(submitted.capabilities?.dataSuffix?.value ?? "0x")?.codes,
    ).toEqual(["bc_app", "bc_partner"]);
    expect(input.capabilities?.dataSuffix).toBeUndefined();
    expect(submitted.calls).not.toBe(input.calls);
  });

  it("blocks unsupported wallets in strict mode without sending", async () => {
    const request = vi.fn(async () => ({ "0x2105": { dataSuffix: { supported: false } } }));

    await expect(
      sendAttributedCalls({ request }, sendCallsRequest(), { codes: ["bc_app"] }),
    ).rejects.toMatchObject({
      code: "DATA_SUFFIX_UNSUPPORTED",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("never retries wallet_sendCalls after a submission error", async () => {
    const request = vi.fn(async (rpc: Eip1193Request) => {
      if (rpc.method === "wallet_getCapabilities") {
        return { "0x2105": { dataSuffix: { supported: true } } };
      }
      throw Object.assign(new Error("capability rejected"), { code: 5700 });
    });

    await expect(
      sendAttributedCalls({ request }, sendCallsRequest(), {
        codes: ["bc_app"],
        fallback: "best-effort",
      }),
    ).rejects.toMatchObject({ code: 5700 });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(([rpc]) => rpc.method)).toEqual([
      "wallet_getCapabilities",
      "wallet_sendCalls",
    ]);
  });

  it("allows only an explicit best-effort unattributed fallback", async () => {
    const request = vi.fn(async (rpc: Eip1193Request) =>
      rpc.method === "wallet_getCapabilities" ? { "0x2105": {} } : "0xunattributed",
    );

    const input = sendCallsRequest();
    input.capabilities = {
      ...input.capabilities,
      dataSuffix: { value: createDataSuffix({ codes: ["bc_existing"] }), optional: true },
    };
    const sent = await sendAttributedCalls<string>({ request }, input, {
      codes: ["bc_app"],
      fallback: "best-effort",
    });

    expect(sent.attribution.delivery).toBe("unattributed");
    const submitted = (request.mock.calls[1][0].params as unknown[])[0] as SendCallsRequest;
    expect(submitted.capabilities?.dataSuffix).toBeUndefined();
    expect(input.capabilities?.dataSuffix).toBeDefined();
  });

  it("wraps wallet_sendCalls while preserving the EIP-1193 result shape", async () => {
    const onAttributionFallback = vi.fn();
    const request = vi.fn(async (rpc: Eip1193Request) =>
      rpc.method === "wallet_getCapabilities" ? { "0x2105": {} } : "0xbatch",
    );
    const wrapped = createAttributionProvider(
      { request },
      { codes: ["bc_app"], fallback: "best-effort", onAttributionFallback },
    );

    const result = await wrapped.request({
      method: "wallet_sendCalls",
      params: [sendCallsRequest()],
    });

    expect(result).toBe("0xbatch");
    expect(onAttributionFallback).toHaveBeenCalledWith(
      expect.objectContaining({ delivery: "unattributed" }),
    );
  });
});

describe("wallet-side UserOperation attribution", () => {
  it("combines wallet and app codes in one trailing suffix", () => {
    const attributed = attributeUserOperation(
      { sender: account, callData: "0x1234" },
      {
        walletCodes: ["bc_wallet"],
        appDataSuffix: createDataSuffix({ codes: ["bc_app", "bc_partner"] }),
      },
    );
    const decoded = decodeAttributionFromCalldata(attributed.callData);

    expect(decoded).toMatchObject({
      transactionData: "0x1234",
      codes: ["bc_wallet", "bc_app", "bc_partner"],
    });
  });

  it("is idempotent and deduplicates existing attribution", () => {
    const once = attributeUserOperation(
      { callData: appendDataSuffix("0x1234", { codes: ["bc_app"] }) },
      { walletCodes: ["bc_wallet"], appDataSuffix: createDataSuffix({ codes: ["bc_app"] }) },
    );
    const twice = attributeUserOperation(once, {
      walletCodes: ["bc_wallet"],
      appDataSuffix: createDataSuffix({ codes: ["bc_app"] }),
    });

    expect(twice.callData).toBe(once.callData);
    expect(decodeAttributionFromCalldata(twice.callData)?.codes).toEqual(["bc_wallet", "bc_app"]);
  });

  it("normalizes concatenated suffixes into one multi-code suffix", () => {
    const concatenated = appendDataSuffix(appendDataSuffix("0x1234", { codes: ["bc_wallet"] }), {
      codes: ["bc_app"],
    });
    const attributed = attributeUserOperation(
      { callData: concatenated },
      { walletCodes: ["bc_wallet"] },
    );
    const decoded = decodeAttributionFromCalldata(attributed.callData);

    expect(decoded?.transactionData).toBe("0x1234");
    expect(decoded?.codes).toEqual(["bc_wallet", "bc_app"]);
  });

  it("rejects excessive nested attribution layers", () => {
    let callData = "0x1234" as Hex;
    for (let index = 0; index < 65; index += 1) {
      callData = appendDataSuffix(callData, { codes: ["bc_app"] });
    }

    expect(() => attributeUserOperation({ callData }, { walletCodes: ["bc_wallet"] })).toThrow(
      /64-layer attribution limit/,
    );
  });

  it("rejects incompatible schema and registry combinations", () => {
    const registryA = `0x${"aa".repeat(20)}` as Hex;
    const registryB = `0x${"bb".repeat(20)}` as Hex;
    const schemaOne = createDataSuffix({
      id: 1,
      codes: ["bc_app"],
      codeRegistry: { address: registryA, chainId: 8453 },
    });

    expect(() =>
      attributeUserOperation(
        { callData: "0x" },
        { walletCodes: ["bc_wallet"], appDataSuffix: schemaOne },
      ),
    ).toThrowError(expect.objectContaining({ code: "MIXED_ATTRIBUTION_SCHEMA" }));

    const existing = appendDataSuffix("0x1234", {
      id: 1,
      codes: ["bc_existing"],
      codeRegistry: { address: registryB, chainId: 8453 },
    });
    expect(() =>
      attributeUserOperation({ callData: existing }, { appDataSuffix: schemaOne }),
    ).toThrowError(expect.objectContaining({ code: "REGISTRY_CONFLICT" }));
  });

  it("wraps a UserOperation builder and validates callData", async () => {
    const build = withUserOperationAttribution(
      async () => ({ sender: account, callData: "0xabcd" as Hex }),
      { walletCodes: ["bc_wallet"] },
    );
    const userOperation = await build({
      ...sendCallsRequest(),
      capabilities: {
        dataSuffix: { value: createDataSuffix({ codes: ["bc_app"] }), optional: false },
      },
    });
    const validation = validateUserOperationAttribution(userOperation, {
      expect: ["bc_wallet", "bc_app"],
    });

    expect(validation).toMatchObject({
      ok: true,
      codes: ["bc_wallet", "bc_app"],
      attributionPath: "userOp.callData",
    });
  });

  it("enforces the ERC-8021 byte limit after code merging", () => {
    const walletCodes = Array.from({ length: 8 }, (_, index) => `bc_${index}${"x".repeat(28)}`);

    expect(() => attributeUserOperation({ callData: "0x" }, { walletCodes })).toThrow(
      /255 bytes or less/,
    );
  });
});

function sendCallsRequest(): SendCallsRequest {
  return {
    version: "1.0",
    chainId: "0x2105",
    from: account,
    calls: [{ to, data: "0x1234", value: "0x0" }],
    capabilities: {
      paymasterService: { url: "https://paymaster.example" },
    },
  };
}

function providerReturning(result: unknown): Eip1193Provider {
  return { request: vi.fn(async () => result) };
}

function providerThrowing(error: unknown): Eip1193Provider {
  return {
    request: vi.fn(async () => {
      throw error;
    }),
  };
}
