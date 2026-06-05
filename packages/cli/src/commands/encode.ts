import { createDataSuffix } from "@base-attribution-os/core";
import type { CommandResult } from "../output.js";

export interface EncodeOptions {
  code?: string;
  codes?: string[];
}

export function encodeCommand(options: EncodeOptions): CommandResult {
  const codes = options.codes ?? (options.code ? [options.code] : []);
  const suffix = createDataSuffix({ codes });

  return {
    ok: true,
    message: suffix,
    data: {
      codes,
      suffix,
    },
  };
}
