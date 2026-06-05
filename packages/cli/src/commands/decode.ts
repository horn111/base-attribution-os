import { decodeAttributionFromCalldata, type Hex } from "@base-attribution-os/core";
import type { CommandResult } from "../output.js";

export interface DecodeOptions {
  calldata: Hex;
}

export function decodeCommand(options: DecodeOptions): CommandResult {
  const decoded = decodeAttributionFromCalldata(options.calldata);

  if (!decoded) {
    return {
      ok: false,
      message: "No ERC-8021 attribution suffix found.",
    };
  }

  return {
    ok: true,
    message: `Found Builder Codes: ${decoded.codes.join(", ")}`,
    data: decoded,
  };
}
