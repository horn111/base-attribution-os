import { validateAttribution, type Hex } from "@base-attribution-os/core";
import type { CommandResult } from "../output.js";

export interface CheckCalldataOptions {
  calldata: Hex;
  expect?: string;
}

export function checkCalldataCommand(options: CheckCalldataOptions): CommandResult {
  const result = validateAttribution({
    calldata: options.calldata,
    expect: options.expect,
  });

  return {
    ok: result.ok,
    message: result.ok
      ? `Attribution OK: ${result.codes.join(", ")}`
      : `Attribution failed: ${result.errors.join("; ")}`,
    data: result,
  };
}
