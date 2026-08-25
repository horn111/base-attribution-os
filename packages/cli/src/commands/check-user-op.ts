import { promises as fs } from "node:fs";
import {
  validateUserOperationAttribution,
  type UserOperationLike,
} from "@base-attribution-os/wallet";
import type { CommandResult } from "../output.js";

export interface CheckUserOperationOptions {
  userOperation: UserOperationLike;
  expect?: string | string[];
}

export interface CheckUserOperationFileOptions {
  input: string;
  expect?: string | string[];
}

export function checkUserOperationCommand(options: CheckUserOperationOptions): CommandResult {
  const result = validateUserOperationAttribution(options.userOperation, {
    expect: options.expect,
  });

  return {
    ok: result.ok,
    message: result.ok
      ? `UserOperation attribution OK: ${result.codes.join(", ")}`
      : `UserOperation attribution failed: ${result.errors.join("; ")}`,
    data: result,
  };
}

export async function checkUserOperationFileCommand(
  options: CheckUserOperationFileOptions,
): Promise<CommandResult> {
  try {
    const source =
      options.input === "-" ? await readStdin() : await fs.readFile(options.input, "utf8");
    const parsed = JSON.parse(source) as unknown;
    const userOperation = extractUserOperation(parsed);

    if (!userOperation) {
      return {
        ok: false,
        message:
          "UserOperation input must be an object with callData or a JSON-RPC object with result.callData.",
      };
    }

    return checkUserOperationCommand({
      userOperation,
      expect: options.expect,
    });
  } catch (error) {
    return {
      ok: false,
      message: `Unable to read UserOperation: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function readStdin(): Promise<string> {
  let source = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    source += String(chunk);
  }
  return source;
}

export function extractUserOperation(value: unknown): UserOperationLike | undefined {
  if (!isRecord(value)) return undefined;
  const candidate = isRecord(value.result) ? value.result : value;

  return typeof candidate.callData === "string"
    ? (candidate as unknown as UserOperationLike)
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
