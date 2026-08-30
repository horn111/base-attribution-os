import { promises as fs } from "node:fs";
import path from "node:path";
import { validateBuilderCodes } from "@base-attribution-os/core";
import { SCAN_PROFILES } from "./types.js";
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

  const fileName = path.basename(resolved);
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `${fileName} is not valid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }

  assertBaoConfig(parsed, fileName);

  return {
    config: parsed,
    path: resolved,
  };
}

function assertBaoConfig(value: unknown, fileName: string): asserts value is BaoConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fileName} must contain a JSON object.`);
  }

  const config = value as Record<string, unknown>;
  const allowed = new Set([
    "$schema",
    "builderCodes",
    "profile",
    "include",
    "exclude",
    "rules",
    "baseline",
    "workspace",
  ]);
  const unknownKeys = Object.keys(config).filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`${fileName} contains unsupported field(s): ${unknownKeys.join(", ")}.`);
  }

  if (!Array.isArray(config.builderCodes) || !config.builderCodes.every(isString)) {
    throw new Error(`${fileName} must define builderCodes as a non-empty string array.`);
  }
  const codeErrors = validateBuilderCodes(config.builderCodes);
  if (codeErrors.length > 0) throw new Error(`${fileName}: ${codeErrors.join("; ")}`);

  if (config.$schema !== undefined && typeof config.$schema !== "string") {
    throw new Error(`${fileName}.$schema must be a string.`);
  }
  if (
    config.profile !== undefined &&
    (typeof config.profile !== "string" ||
      !SCAN_PROFILES.some((profile) => profile === config.profile))
  ) {
    throw new Error(`${fileName}.profile must be local, ci, or strict.`);
  }
  assertOptionalStringArray(config.include, `${fileName}.include`);
  assertOptionalStringArray(config.exclude, `${fileName}.exclude`);
  if (config.baseline !== undefined && typeof config.baseline !== "string") {
    throw new Error(`${fileName}.baseline must be a string.`);
  }
  assertRules(config.rules, fileName);
  assertWorkspace(config.workspace, fileName);
}

function assertWorkspace(value: unknown, fileName: string): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fileName}.workspace must be an object.`);
  }
  const workspace = value as Record<string, unknown>;
  const unknown = Object.keys(workspace).filter((key) => key !== "roots" && key !== "tsconfig");
  if (unknown.length > 0) {
    throw new Error(`${fileName}.workspace contains unsupported field(s): ${unknown.join(", ")}.`);
  }
  assertOptionalStringArray(workspace.roots, `${fileName}.workspace.roots`);
  assertOptionalStringArray(workspace.tsconfig, `${fileName}.workspace.tsconfig`);
  for (const [key, entries] of Object.entries(workspace)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries as string[]) {
      const normalized = entry.replaceAll("\\", "/");
      if (!entry || path.isAbsolute(entry) || normalized.split("/").includes("..")) {
        throw new Error(
          `${fileName}.workspace.${key} entries must be relative paths inside the scan root.`,
        );
      }
    }
  }
}

function assertOptionalStringArray(value: unknown, field: string): void {
  if (value !== undefined && (!Array.isArray(value) || !value.every(isString))) {
    throw new Error(`${field} must be an array of strings.`);
  }
}

function assertRules(value: unknown, fileName: string): void {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fileName}.rules must be an object.`);
  }

  const allowedRules = new Set([
    "missing-attribution",
    "wrong-builder-code",
    "dynamic-attribution",
    "ambiguous-path",
  ]);
  for (const [rule, severity] of Object.entries(value)) {
    if (!allowedRules.has(rule))
      throw new Error(`${fileName}.rules contains unsupported rule ${rule}.`);
    if (!["error", "warning", "off"].includes(String(severity))) {
      throw new Error(`${fileName}.rules.${rule} must be error, warning, or off.`);
    }
  }
}

function isString(value: unknown): value is string {
  return typeof value === "string";
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
