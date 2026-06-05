import {
  ERC8021_SUFFIX,
  MAX_CODES_BYTE_LENGTH,
  SCHEMA_CANONICAL_REGISTRY,
  SCHEMA_CUSTOM_REGISTRY,
} from "./constants.js";
import {
  type Hex,
  assertHex,
  bigintToMinimalHex,
  concatHex,
  hexByteLength,
  numberToByteHex,
  stringToHex,
} from "./hex.js";

export type AttributionSchemaId = typeof SCHEMA_CANONICAL_REGISTRY | typeof SCHEMA_CUSTOM_REGISTRY;

export interface AttributionRegistry {
  address: Hex;
  chainId?: number | bigint;
}

export interface CanonicalAttributionInput {
  codes: string[];
  id?: typeof SCHEMA_CANONICAL_REGISTRY;
}

export interface CustomRegistryAttributionInput {
  codes: string[];
  id?: typeof SCHEMA_CUSTOM_REGISTRY;
  codeRegistry?: AttributionRegistry;
  codeRegistryAddress?: Hex;
}

export type AttributionInput = CanonicalAttributionInput | CustomRegistryAttributionInput;

export interface EncodedAttribution {
  suffix: Hex;
  schemaId: AttributionSchemaId;
  codes: string[];
}

export function createDataSuffix(input: AttributionInput): Hex {
  const codes = normalizeCodes(input.codes);
  const codesHex = stringToHex(codes.join(","));
  const codesLength = hexByteLength(codesHex);

  if (codesLength > MAX_CODES_BYTE_LENGTH) {
    throw new Error(`Builder Codes must encode to ${MAX_CODES_BYTE_LENGTH} bytes or less`);
  }

  const schemaId = getSchemaId(input);
  const codesLengthHex = numberToByteHex(codesLength);
  const schemaIdHex = numberToByteHex(schemaId);

  if (schemaId === SCHEMA_CUSTOM_REGISTRY) {
    return concatHex([
      registryToData(input as CustomRegistryAttributionInput),
      codesHex,
      codesLengthHex,
      schemaIdHex,
      ERC8021_SUFFIX,
    ]);
  }

  return concatHex([codesHex, codesLengthHex, schemaIdHex, ERC8021_SUFFIX]);
}

export function encodeAttributionSuffix(input: AttributionInput): EncodedAttribution {
  const codes = normalizeCodes(input.codes);
  return {
    suffix: createDataSuffix({ ...input, codes } as AttributionInput),
    schemaId: getSchemaId(input),
    codes,
  };
}

export function appendDataSuffix(data: Hex | undefined, input: AttributionInput): Hex {
  const calldata = data ?? "0x";
  assertHex(calldata, "calldata");
  return concatHex([calldata, createDataSuffix(input)]);
}

export function getSchemaId(input: AttributionInput): AttributionSchemaId {
  if (
    input.id === SCHEMA_CUSTOM_REGISTRY ||
    "codeRegistry" in input ||
    "codeRegistryAddress" in input
  ) {
    return SCHEMA_CUSTOM_REGISTRY;
  }

  return SCHEMA_CANONICAL_REGISTRY;
}

export function normalizeCodes(codes: string[]): string[] {
  if (!Array.isArray(codes) || codes.length === 0) {
    throw new Error("At least one Builder Code is required");
  }

  return codes.map((code) => {
    const normalized = code.trim();

    if (normalized.length === 0) {
      throw new Error("Builder Codes cannot be empty");
    }

    if (normalized.includes(",")) {
      throw new Error("Builder Codes cannot contain commas");
    }

    return normalized;
  });
}

function registryToData(input: CustomRegistryAttributionInput): Hex {
  const address = input.codeRegistry?.address ?? input.codeRegistryAddress;

  if (!address) {
    throw new Error("schema 1 attribution requires codeRegistry.address");
  }

  assertHex(address, "codeRegistry.address");

  if (hexByteLength(address) !== 20) {
    throw new Error("codeRegistry.address must be 20 bytes");
  }

  const chainId = input.codeRegistry?.chainId;

  if (chainId === undefined) {
    return address.toLowerCase() as Hex;
  }

  const chainIdHex = bigintToMinimalHex(typeof chainId === "bigint" ? chainId : BigInt(chainId));
  const chainIdLengthHex = numberToByteHex(hexByteLength(chainIdHex));

  return concatHex([address.toLowerCase() as Hex, chainIdHex, chainIdLengthHex]);
}
