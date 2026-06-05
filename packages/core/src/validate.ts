import { BUILDER_CODE_PATTERN } from "./constants.js";
import { decodeAttributionFromCalldata } from "./decode.js";
import type { Hex } from "./hex.js";
import { assertHex, hasErc8021Marker } from "./hex.js";

export interface ValidationInput {
  calldata: Hex;
  expect?: string | string[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  codes: string[];
  schemaId?: number;
}

export function validateAttribution(input: ValidationInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    assertHex(input.calldata, "calldata");
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : "invalid hex"],
      warnings,
      codes: [],
    };
  }

  if (!hasErc8021Marker(input.calldata)) {
    errors.push("missing ERC-8021 marker");
  }

  const attribution = decodeAttributionFromCalldata(input.calldata);

  if (!attribution) {
    errors.push("unable to decode ERC-8021 attribution suffix");
    return { ok: false, errors: unique(errors), warnings, codes: [] };
  }

  const codeErrors = validateBuilderCodes(attribution.codes);
  errors.push(...codeErrors);

  const expected = normalizeExpected(input.expect);

  for (const expectedCode of expected) {
    if (!attribution.codes.includes(expectedCode)) {
      errors.push(`expected Builder Code "${expectedCode}" was not found`);
    }
  }

  if (attribution.codes.length > 1) {
    warnings.push("multiple Builder Codes found in a single attribution suffix");
  }

  return {
    ok: errors.length === 0,
    errors: unique(errors),
    warnings,
    codes: attribution.codes,
    schemaId: attribution.id,
  };
}

export function validateBuilderCodes(codes: string[]): string[] {
  const errors: string[] = [];

  if (codes.length === 0) {
    errors.push("at least one Builder Code is required");
  }

  for (const code of codes) {
    if (code.trim() !== code || code.length === 0) {
      errors.push("Builder Codes cannot be empty or padded");
    }

    if (code.includes(",")) {
      errors.push(`Builder Code "${code}" contains a comma`);
    }

    if (!BUILDER_CODE_PATTERN.test(code)) {
      errors.push(`Builder Code "${code}" contains unsupported characters`);
    }
  }

  return unique(errors);
}

function normalizeExpected(expect?: string | string[]): string[] {
  if (!expect) {
    return [];
  }

  return Array.isArray(expect) ? expect : [expect];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
