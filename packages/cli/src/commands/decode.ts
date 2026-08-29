import {
  decodeAttributionFromCalldata,
  validateBuilderCodes,
  type Hex,
} from "@base-attribution-os/core";
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

  if (validateBuilderCodes(decoded.codes).length > 0) {
    return {
      ok: false,
      message: "ERC-8021 suffix contains invalid Builder Codes.",
      data: decoded,
    };
  }

  return {
    ok: true,
    message: `Found Builder Codes: ${decoded.codes.join(", ")}`,
    data: decoded,
  };
}
