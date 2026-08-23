import type { Hex } from "@base-attribution-os/core";
import type { CommandResult } from "../output.js";
import { replayCommand, type ReplayFormat } from "./replay.js";

export interface ProofTransactionOptions {
  hash: Hex;
  rpcUrl: string;
  expect: string;
  chainId?: number;
  format?: ReplayFormat | string;
  output?: string;
  fetcher?: typeof fetch;
}

export function proofTransactionCommand(options: ProofTransactionOptions): Promise<CommandResult> {
  return replayCommand({
    builderCode: options.expect,
    hashes: [options.hash],
    rpcUrl: options.rpcUrl,
    chainId: options.chainId,
    format: options.format ?? "markdown",
    output: options.output,
    fetcher: options.fetcher,
  });
}
