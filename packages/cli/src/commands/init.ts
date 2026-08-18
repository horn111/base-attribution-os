import path from "node:path";
import {
  analyzeProject,
  normalizeProfile,
  writeBaoConfig,
  type ScanProfile,
} from "@base-attribution-os/scanner";
import type { CommandResult } from "../output.js";

export interface InitOptions {
  path: string;
  builderCode: string;
  force?: boolean;
  profile?: ScanProfile | string;
}

export async function initCommand(options: InitOptions): Promise<CommandResult> {
  const root = path.resolve(options.path);
  const profile = normalizeProfile(options.profile);
  const target = await writeBaoConfig(root, options.builderCode, {
    force: options.force,
    profile,
  });
  const report = await analyzeProject({
    root,
    builderCodes: [options.builderCode],
    profile: "local",
  });

  return {
    ok: true,
    message: `Created ${path.relative(root, target)}. Detected: ${
      report.frameworks.length ? report.frameworks.join(", ") : "no supported framework yet"
    }.`,
    data: {
      config: target,
      frameworks: report.frameworks,
      transactionPaths: report.summary.total,
    },
  };
}
