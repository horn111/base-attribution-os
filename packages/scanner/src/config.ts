import { promises as fs } from "node:fs";
import path from "node:path";
import type { BaoConfig } from "./types.js";

export const DEFAULT_CONFIG_FILE = "bao.config.json";
export const CONFIG_SCHEMA_URL =
  "https://raw.githubusercontent.com/horn111/base-attribution-os/main/bao.schema.json";

export async function loadBaoConfig(
  root: string,
  configPath = DEFAULT_CONFIG_FILE,
): Promise<{ config: BaoConfig; path: string } | undefined> {
  const resolved = path.resolve(root, configPath);
  const source = await fs.readFile(resolved, "utf8").catch(() => undefined);

  if (source === undefined) {
    return undefined;
  }

  const parsed = JSON.parse(source) as Partial<BaoConfig>;

  if (!Array.isArray(parsed.builderCodes) || parsed.builderCodes.length === 0) {
    throw new Error(`${path.basename(resolved)} must define at least one builderCodes entry.`);
  }

  return {
    config: parsed as BaoConfig,
    path: resolved,
  };
}

export async function writeBaoConfig(
  root: string,
  builderCode: string,
  options: { force?: boolean; profile?: BaoConfig["profile"] } = {},
): Promise<string> {
  const target = path.resolve(root, DEFAULT_CONFIG_FILE);

  if (!options.force) {
    const exists = await fs.stat(target).then(
      () => true,
      () => false,
    );

    if (exists) {
      throw new Error(`${DEFAULT_CONFIG_FILE} already exists. Use --force to replace it.`);
    }
  }

  const config: BaoConfig = {
    $schema: CONFIG_SCHEMA_URL,
    builderCodes: [builderCode],
    profile: options.profile ?? "ci",
    include: ["src", "app", "packages"],
    exclude: ["**/*.test.*", "**/*.spec.*", "**/generated/**"],
  };

  await fs.writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return target;
}
