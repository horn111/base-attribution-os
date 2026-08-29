import type { Hex } from "@base-attribution-os/core";
import { checkCalldataCommand } from "./check-calldata.js";
import { extractErc4337UserOperationCalldata, isSupportedErc4337HandleOps } from "../erc4337.js";
import type { CommandResult } from "../output.js";

export interface CheckTransactionOptions {
  hash: Hex;
  rpcUrl: string;
  expect?: string | string[];
}

export async function checkTransactionCommand(
  options: CheckTransactionOptions,
): Promise<CommandResult> {
  const transactionResponse = await requestRpc<{
    hash?: Hex;
    input?: Hex;
    data?: Hex;
    to?: Hex;
  }>(options.rpcUrl, "eth_getTransactionByHash", [options.hash]);
  if (!transactionResponse.ok) return transactionResponse;
  const transaction = transactionResponse.result;

  if (!transaction) {
    return {
      ok: false,
      message: "Transaction not found.",
    };
  }

  if (!transaction.hash || transaction.hash.toLowerCase() !== options.hash.toLowerCase()) {
    return {
      ok: false,
      message: "RPC response transaction hash does not match the requested hash.",
    };
  }

  const chainResponse = await requestRpc<string>(options.rpcUrl, "eth_chainId", []);
  if (!chainResponse.ok) return chainResponse;
  const chainId = chainResponse.result?.toLowerCase();
  if (chainId !== "0x2105" && chainId !== "0x14a34") {
    return {
      ok: false,
      message: `RPC chain ${chainResponse.result ?? "unknown"} is not Base mainnet or Base Sepolia.`,
    };
  }

  const receiptResponse = await requestRpc<{
    transactionHash?: Hex;
    status?: Hex;
  }>(options.rpcUrl, "eth_getTransactionReceipt", [options.hash]);
  if (!receiptResponse.ok) return receiptResponse;
  const receipt = receiptResponse.result;
  if (!receipt) {
    return { ok: false, message: "Transaction receipt not found; the transaction is not mined." };
  }
  if (
    !receipt.transactionHash ||
    receipt.transactionHash.toLowerCase() !== options.hash.toLowerCase()
  ) {
    return {
      ok: false,
      message: "RPC response receipt hash does not match the requested transaction.",
    };
  }
  if (receipt.status?.toLowerCase() !== "0x1") {
    return { ok: false, message: "Transaction receipt is not successful." };
  }

  const calldata = transaction.input ?? transaction.data ?? "0x";
  const directResult = checkCalldataCommand({
    calldata,
    expect: options.expect,
  });

  if (!isSupportedErc4337HandleOps(calldata, transaction.to)) {
    return directResult;
  }

  const userOperationCalldata = extractErc4337UserOperationCalldata(calldata);
  if (userOperationCalldata.length === 0) {
    return {
      ok: false,
      message: "Unable to decode UserOperations from supported EntryPoint handleOps calldata.",
    };
  }

  let firstDecodedMismatch: CommandResult | undefined;
  for (const [index, nestedCalldata] of userOperationCalldata.entries()) {
    const nestedResult = checkCalldataCommand({
      calldata: nestedCalldata,
      expect: options.expect,
    });

    const annotated = {
      ...nestedResult,
      message: `${nestedResult.message} (ERC-4337 UserOperation #${index})`,
      data: {
        ...(isRecord(nestedResult.data) ? nestedResult.data : {}),
        attributionPath: "erc4337-user-operation",
        userOperationIndex: index,
      },
    };

    if (nestedResult.ok) {
      return annotated;
    }
    if (!firstDecodedMismatch && hasDecodedCodes(nestedResult)) {
      firstDecodedMismatch = annotated;
    }
  }

  return (
    firstDecodedMismatch ?? {
      ok: false,
      message: "No ERC-4337 UserOperation contains valid Builder Code attribution.",
      data: {
        attributionPath: "erc4337-user-operation",
        userOperationCount: userOperationCalldata.length,
      },
    }
  );
}

async function requestRpc<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<{ ok: true; result: T | null } | { ok: false; message: string }> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!response.ok) {
    return { ok: false, message: `RPC request failed with HTTP ${response.status}` };
  }

  const payload = (await response.json()) as {
    result?: T | null;
    error?: { message?: string };
  };
  if (payload.error) {
    return { ok: false, message: `RPC error: ${payload.error.message ?? "unknown error"}` };
  }
  return { ok: true, result: payload.result ?? null };
}

function hasDecodedCodes(result: CommandResult): boolean {
  return isRecord(result.data) && Array.isArray(result.data.codes) && result.data.codes.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
