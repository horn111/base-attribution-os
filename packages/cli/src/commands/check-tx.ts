import type { Hex } from "@base-attribution-os/core";
import { checkCalldataCommand } from "./check-calldata.js";
import type { CommandResult } from "../output.js";

export interface CheckTransactionOptions {
  hash: Hex;
  rpcUrl: string;
  expect?: string;
}

export async function checkTransactionCommand(
  options: CheckTransactionOptions,
): Promise<CommandResult> {
  const response = await fetch(options.rpcUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionByHash",
      params: [options.hash],
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      message: `RPC request failed with HTTP ${response.status}`,
    };
  }

  const payload = (await response.json()) as {
    result?: { input?: Hex; data?: Hex } | null;
    error?: { message?: string };
  };

  if (payload.error) {
    return {
      ok: false,
      message: `RPC error: ${payload.error.message ?? "unknown error"}`,
    };
  }

  const transaction = payload.result;

  if (!transaction) {
    return {
      ok: false,
      message: "Transaction not found.",
    };
  }

  return checkCalldataCommand({
    calldata: transaction.input ?? transaction.data ?? "0x",
    expect: options.expect,
  });
}
