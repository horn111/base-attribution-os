import type { Hex } from "@base-attribution-os/core";
import type { ChainId, DataSuffixSupport, Eip1193Provider } from "./types.js";

export interface GetDataSuffixSupportOptions {
  account: Hex;
  chainId: ChainId;
}

export async function getDataSuffixSupport(
  provider: Eip1193Provider,
  options: GetDataSuffixSupportOptions,
): Promise<DataSuffixSupport> {
  const chainId = normalizeChainId(options.chainId);
  let response: unknown;

  try {
    response = await provider.request({
      method: "wallet_getCapabilities",
      params: [options.account, [chainId]],
    });
  } catch (error) {
    if (!hasRpcCode(error, -32602)) {
      return { status: "unavailable", chainId, reason: "request-failed", error };
    }

    try {
      response = await provider.request({
        method: "wallet_getCapabilities",
        params: [options.account],
      });
    } catch (fallbackError) {
      return {
        status: "unavailable",
        chainId,
        reason: "request-failed",
        error: fallbackError,
      };
    }
  }

  if (!isRecord(response)) {
    return { status: "unavailable", chainId, reason: "malformed-response" };
  }

  const chainValue = findChainValue(response, chainId);
  const globalValue = findChainValue(response, "0x0");
  if (
    (chainValue !== undefined && !isRecord(chainValue)) ||
    (globalValue !== undefined && !isRecord(globalValue))
  ) {
    return { status: "unavailable", chainId, reason: "malformed-response" };
  }
  const chainCapabilities = readCapabilities(chainValue);
  const globalCapabilities = readCapabilities(globalValue);
  const source = chainCapabilities?.dataSuffix === undefined ? "global" : "chain";
  const capability = chainCapabilities?.dataSuffix ?? globalCapabilities?.dataSuffix;

  if (capability === undefined) {
    return { status: "unsupported", chainId, reason: "not-advertised" };
  }

  if (!isRecord(capability) || typeof capability.supported !== "boolean") {
    return { status: "unavailable", chainId, reason: "malformed-response" };
  }

  return capability.supported
    ? { status: "supported", chainId, source }
    : { status: "unsupported", chainId, reason: "reported-unsupported" };
}

export function normalizeChainId(chainId: ChainId): Hex {
  let value: bigint;

  try {
    value = typeof chainId === "bigint" ? chainId : BigInt(chainId);
  } catch {
    throw new TypeError(`Invalid chain ID: ${String(chainId)}`);
  }

  if (value < 0n) {
    throw new TypeError(`Invalid chain ID: ${String(chainId)}`);
  }

  return `0x${value.toString(16)}`;
}

function readCapabilities(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function findChainValue(response: Record<string, unknown>, chainId: Hex): unknown {
  const entry = Object.entries(response).find(([key]) => {
    try {
      return normalizeChainId(key as Hex) === chainId;
    } catch {
      return false;
    }
  });
  return entry?.[1];
}

function hasRpcCode(error: unknown, code: number): boolean {
  return isRecord(error) && error.code === code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
