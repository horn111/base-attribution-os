import {
  ERC8021_SUFFIX_BYTE_LENGTH,
  SCHEMA_CANONICAL_REGISTRY,
  SCHEMA_CUSTOM_REGISTRY,
} from "./constants.js";
import {
  type Hex,
  assertHex,
  concatHex,
  hasErc8021Marker,
  hexByteLength,
  hexToNumber,
  hexToString,
  sliceHex,
} from "./hex.js";
import type { AttributionRegistry, AttributionSchemaId } from "./encode.js";

export interface DecodedAttribution {
  id: AttributionSchemaId;
  codes: string[];
  codeRegistry?: AttributionRegistry;
  suffix: Hex;
  transactionData: Hex;
}

export function decodeAttribution(data: Hex): DecodedAttribution | undefined {
  return decodeAttributionFromCalldata(data);
}

export function decodeAttributionFromCalldata(data: Hex): DecodedAttribution | undefined {
  assertHex(data, "calldata");

  const minBytes = ERC8021_SUFFIX_BYTE_LENGTH + 2;
  if (hexByteLength(data) < minBytes || !hasErc8021Marker(data)) {
    return undefined;
  }

  const withoutMarker = sliceHex(data, 0, -ERC8021_SUFFIX_BYTE_LENGTH);
  const schemaId = hexToNumber(sliceHex(withoutMarker, -1)) as AttributionSchemaId;

  if (schemaId !== SCHEMA_CANONICAL_REGISTRY && schemaId !== SCHEMA_CUSTOM_REGISTRY) {
    return undefined;
  }

  const beforeSchema = sliceHex(withoutMarker, 0, -1);

  if (hexByteLength(beforeSchema) < 1) {
    return undefined;
  }

  const codesLength = hexToNumber(sliceHex(beforeSchema, -1));
  const beforeCodesLength = sliceHex(beforeSchema, 0, -1);

  if (hexByteLength(beforeCodesLength) < codesLength) {
    return undefined;
  }

  const codesHex = sliceHex(beforeCodesLength, -codesLength);
  const codes = hexToString(codesHex).split(",").filter(Boolean);
  const beforeSuffixData = sliceHex(beforeCodesLength, 0, -codesLength);

  if (schemaId === SCHEMA_CUSTOM_REGISTRY) {
    const registry = readRegistryData(beforeSuffixData);

    if (!registry) {
      return undefined;
    }

    return {
      id: schemaId,
      codes,
      codeRegistry: registry.registry,
      suffix: concatHex([
        registry.registryData,
        codesHex,
        sliceHex(beforeSchema, -1),
        sliceHex(withoutMarker, -1),
        sliceHex(data, -ERC8021_SUFFIX_BYTE_LENGTH),
      ]),
      transactionData: registry.transactionData,
    };
  }

  return {
    id: schemaId,
    codes,
    suffix: concatHex([
      codesHex,
      sliceHex(beforeSchema, -1),
      sliceHex(withoutMarker, -1),
      sliceHex(data, -ERC8021_SUFFIX_BYTE_LENGTH),
    ]),
    transactionData: beforeSuffixData,
  };
}

export function decodeDataSuffix(suffix: Hex): DecodedAttribution | undefined {
  const decoded = decodeAttributionFromCalldata(suffix);

  if (!decoded) {
    return undefined;
  }

  return {
    ...decoded,
    transactionData: "0x",
  };
}

function readRegistryData(dataBeforeCodes: Hex):
  | {
      registry: AttributionRegistry;
      registryData: Hex;
      transactionData: Hex;
    }
  | undefined {
  const byteLength = hexByteLength(dataBeforeCodes);

  if (byteLength < 20) {
    return undefined;
  }

  const maybeChainIdLength = hexToNumber(sliceHex(dataBeforeCodes, -1));

  if (maybeChainIdLength > 0 && byteLength >= 20 + maybeChainIdLength + 1) {
    const registryData = sliceHex(dataBeforeCodes, -(20 + maybeChainIdLength + 1));
    const address = sliceHex(registryData, 0, 20);
    const chainIdHex = sliceHex(registryData, 20, 20 + maybeChainIdLength);
    const transactionData = sliceHex(dataBeforeCodes, 0, -(20 + maybeChainIdLength + 1));

    return {
      registry: {
        address,
        chainId: BigInt(chainIdHex),
      },
      registryData,
      transactionData,
    };
  }

  const registryData = sliceHex(dataBeforeCodes, -20);

  return {
    registry: {
      address: registryData,
    },
    registryData,
    transactionData: sliceHex(dataBeforeCodes, 0, -20),
  };
}
