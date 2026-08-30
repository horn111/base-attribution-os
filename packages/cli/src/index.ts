#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Hex } from "@base-attribution-os/core";
import { checkCalldataCommand } from "./commands/check-calldata.js";
import { checkTransactionCommand } from "./commands/check-tx.js";
import { checkUserOperationFileCommand } from "./commands/check-user-op.js";
import { decodeCommand } from "./commands/decode.js";
import { doctorCommand } from "./commands/doctor.js";
import { encodeCommand } from "./commands/encode.js";
import { initCommand } from "./commands/init.js";
import { proofTransactionCommand } from "./commands/proof.js";
import { replayCommand } from "./commands/replay.js";
import { scanRepoCommand } from "./commands/scan-repo.js";
import { CliError, printResult, required } from "./output.js";

export { checkCalldataCommand } from "./commands/check-calldata.js";
export { checkTransactionCommand } from "./commands/check-tx.js";
export {
  checkUserOperationCommand,
  checkUserOperationFileCommand,
  extractUserOperation,
} from "./commands/check-user-op.js";
export { decodeCommand } from "./commands/decode.js";
export { doctorCommand, formatDoctorReport } from "./commands/doctor.js";
export { encodeCommand } from "./commands/encode.js";
export { initCommand } from "./commands/init.js";
export { proofTransactionCommand } from "./commands/proof.js";
export {
  formatReplayReport,
  readReplayInput,
  replayCommand,
  type ReplayFormat,
  type ReplayOptions,
} from "./commands/replay.js";
export { normalizeScanProfile, scanRepo, scanRepoCommand } from "./commands/scan-repo.js";
export type {
  ScanFinding,
  ScanProfile,
  ScanRepoOptions,
  ScanRepoResult,
} from "./commands/scan-repo.js";

if (isCliEntrypoint()) {
  run(process.argv.slice(2)).catch((error) => {
    if (error instanceof CliError) {
      console.error(error.message);
      process.exit(error.exitCode);
    }

    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

function isCliEntrypoint(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
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
      expect: parseExpectedCodes(options.expect),
    });
    printResult(result, json);
    return setExitCode(result.ok);
  }

  if (command === "check-tx") {
    const result = await checkTransactionCommand({
      hash: required(options.hash, "--hash") as Hex,
      rpcUrl: required(options["rpc-url"], "--rpc-url"),
      expect: parseExpectedCodes(options.expect),
    });
    printResult(result, json);
    return setExitCode(result.ok);
  }

  if (command === "check-user-op") {
    const result = await checkUserOperationFileCommand({
      input: required(options.input, "--input"),
      expect: parseExpectedCodes(required(options.expect, "--expect")),
    });
    printResult(result, json);
    return setExitCode(result.ok);
  }

  if (command === "proof") {
    const format = options.format ?? (json ? "json" : "markdown");
    const result = await proofTransactionCommand({
      hash: required(options.hash, "--hash") as Hex,
      rpcUrl: required(options["rpc-url"], "--rpc-url"),
      expect: required(options.expect, "--expect"),
      chainId: parseChainId(options["chain-id"]),
      format,
      output: options.output,
    });

    if (format === "json" && !options.output) {
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.log(result.message);
    }
    return setExitCode(result.ok);
  }

  if (command === "replay") {
    const format = options.format ?? (json ? "json" : "human");
    const result = await replayCommand({
      builderCode: required(options["builder-code"], "--builder-code"),
      input: options.input,
      hashes: options.hashes
        ?.split(",")
        .map((hash) => hash.trim())
        .filter(Boolean),
      rpcUrl: options["rpc-url"],
      chainId: parseChainId(options["chain-id"]),
      explorerBaseUrl: options["explorer-base-url"],
      format,
      output: options.output,
      failOnMissing: options["fail-on-missing"] !== "false",
    });

    if (format === "json" && !options.output) {
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.log(result.message);
    }
    return setExitCode(result.ok);
  }

  if (command === "init") {
    const result = await initCommand({
      path: options.path ?? ".",
      builderCode: required(options["builder-code"], "--builder-code"),
      force: options.force === "true",
      profile: options.profile,
    });
    printResult(result, json);
    return setExitCode(result.ok);
  }

  if (command === "doctor") {
    const format = options.format ?? (json ? "json" : "human");
    const builderCodes = (options["builder-codes"] ?? options["builder-code"])
      ?.split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    const result = await doctorCommand({
      path: options.path ?? ".",
      builderCodes,
      config: options.config,
      profile: options.profile,
      changedSince: options["changed-since"],
      baseline: options.baseline,
      writeBaseline: options["write-baseline"],
      output: options.output,
      format,
    });

    if (format === "json" || (format === "sarif" && !options.output)) {
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.log(result.message);
    }
    return setExitCode(result.ok);
  }

  if (command === "scan-repo") {
    const builderCodes = (options["builder-codes"] ?? options["builder-code"])
      ?.split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    const result = await scanRepoCommand({
      path: options.path ?? ".",
      builderCodes,
      config: options.config,
      changedSince: options["changed-since"],
      failOnMissing:
        options["fail-on-missing"] === undefined
          ? undefined
          : options["fail-on-missing"] !== "false",
      paths: options.paths
        ?.split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
      profile: options.profile,
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

function parseChainId(value?: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const chainId = Number(value);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new CliError(`Invalid --chain-id: ${value}`);
  }
  return chainId;
}

function parseExpectedCodes(value?: string): string[] | undefined {
  if (value === undefined) return undefined;
  const codes = value
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  return codes.length > 0 ? codes : undefined;
}

function helpText(): string {
  return `Base Attribution OS CLI

Usage:
  bao init --builder-code bc_abc123
  bao doctor [--changed-since origin/main] [--format human|json|sarif]
  bao encode --code bc_abc123
  bao decode --calldata 0x...
  bao check-calldata --calldata 0x... --expect bc_abc123
  bao check-tx --hash 0x... --rpc-url https://... --expect bc_abc123
  bao check-user-op --input user-op.json --expect bc_app,bc_wallet
  bao proof --hash 0x... --rpc-url https://... --expect bc_abc123 --output proof.md
  bao replay --builder-code bc_abc123 --input dune-export.csv
  bao replay --builder-code bc_abc123 --hashes 0x...,0x... --rpc-url https://...
  bao scan-repo --path . [--builder-code bc_abc123] [--config bao.config.json] --profile ci

Options:
  --json                  Print machine-readable JSON
  --codes a,b             Encode multiple Builder Codes
  --expect a,b            Require one or more Builder Codes
  --profile local|ci|strict
  --config path            Use a custom BAO config file
  --changed-since ref      Audit only files changed since a Git ref
  --baseline path          Ignore findings recorded in a baseline
  --write-baseline path    Write current findings as a baseline
  --format human|json|sarif
  --input path             Read replay transactions from Dune JSON or CSV
  --hashes hash,...        Fetch transaction calldata from an RPC endpoint
  --chain-id number        Set replay network (defaults to Base mainnet 8453)
  --output path            Write SARIF or replay proof output to a file
  --fail-on-missing false Allow scan findings without failing
`;
}
