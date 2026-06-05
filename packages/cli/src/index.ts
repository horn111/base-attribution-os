#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import type { Hex } from "@base-attribution-os/core";
import { checkCalldataCommand } from "./commands/check-calldata.js";
import { checkTransactionCommand } from "./commands/check-tx.js";
import { decodeCommand } from "./commands/decode.js";
import { encodeCommand } from "./commands/encode.js";
import { scanRepoCommand } from "./commands/scan-repo.js";
import { CliError, printResult, required } from "./output.js";

export { checkCalldataCommand } from "./commands/check-calldata.js";
export { checkTransactionCommand } from "./commands/check-tx.js";
export { decodeCommand } from "./commands/decode.js";
export { encodeCommand } from "./commands/encode.js";
export { scanRepo, scanRepoCommand } from "./commands/scan-repo.js";
export type { ScanFinding, ScanRepoOptions, ScanRepoResult } from "./commands/scan-repo.js";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch((error) => {
    if (error instanceof CliError) {
      console.error(error.message);
      process.exit(error.exitCode);
    }

    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

async function run(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  const options = parseOptions(rest);
  const json = options.json === "true" || options.json === "1";

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(helpText());
    return;
  }

  if (command === "encode") {
    const codes = options.codes
      ?.split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    const result = encodeCommand({ code: options.code, codes });
    printResult(result, json);
    return setExitCode(result.ok);
  }

  if (command === "decode") {
    const result = decodeCommand({ calldata: required(options.calldata, "--calldata") as Hex });
    printResult(result, json);
    return setExitCode(result.ok);
  }

  if (command === "check-calldata") {
    const result = checkCalldataCommand({
      calldata: required(options.calldata, "--calldata") as Hex,
      expect: options.expect,
    });
    printResult(result, json);
    return setExitCode(result.ok);
  }

  if (command === "check-tx") {
    const result = await checkTransactionCommand({
      hash: required(options.hash, "--hash") as Hex,
      rpcUrl: required(options["rpc-url"], "--rpc-url"),
      expect: options.expect,
    });
    printResult(result, json);
    return setExitCode(result.ok);
  }

  if (command === "scan-repo") {
    const result = await scanRepoCommand({
      path: options.path ?? ".",
      builderCode: required(options["builder-code"], "--builder-code"),
      failOnMissing: options["fail-on-missing"] !== "false",
      paths: options.paths
        ?.split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    });
    printResult(result, json);
    return setExitCode(result.ok);
  }

  throw new CliError(`Unknown command: ${command}`);
}

function parseOptions(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function setExitCode(ok: boolean): void {
  if (!ok) {
    process.exitCode = 1;
  }
}

function helpText(): string {
  return `Base Attribution OS CLI

Usage:
  bao encode --code bc_abc123
  bao decode --calldata 0x...
  bao check-calldata --calldata 0x... --expect bc_abc123
  bao check-tx --hash 0x... --rpc-url https://... --expect bc_abc123
  bao scan-repo --path . --builder-code bc_abc123

Options:
  --json                  Print machine-readable JSON
  --codes a,b             Encode multiple Builder Codes
  --fail-on-missing false Allow scan findings without failing
`;
}
