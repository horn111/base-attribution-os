import {
  appendDataSuffix,
  decodeAttributionFromCalldata,
  decodeDataSuffix,
  normalizeCodes,
  validateAttribution,
  type AttributionInput,
  type AttributionRegistry,
  type DecodedAttribution,
  type Hex,
  type ValidationResult,
} from "@base-attribution-os/core";
import { WalletAttributionError, type SendCallsRequest, type UserOperationLike } from "./types.js";

export interface AttributeUserOperationOptions {
  walletCodes?: string[];
  appDataSuffix?: Hex;
}

export interface WithUserOperationAttributionOptions {
  walletCodes?: string[];
}

export interface ValidateUserOperationOptions {
  expect?: string | string[];
}

export interface UserOperationValidationResult extends ValidationResult {
  callData: Hex;
  attributionPath: "userOp.callData";
}

const MAX_ATTRIBUTION_LAYERS = 64;

export function attributeUserOperation<TUserOperation extends UserOperationLike>(
  userOperation: TUserOperation,
  options: AttributeUserOperationOptions,
): TUserOperation {
  if (!userOperation || typeof userOperation.callData !== "string") {
    throw new WalletAttributionError(
      "INVALID_USER_OPERATION",
      "UserOperation requires a hex callData field.",
    );
  }

  try {
    const existing = peelAttribution(userOperation.callData);
    const app = readExactSuffix(options.appDataSuffix);
    const walletCodes = options.walletCodes ? normalizeCodes(options.walletCodes) : [];
    const decoded = [...existing.attributions, ...(app ? [app] : [])];
    const attribution = resolveAttributionInput(walletCodes, decoded);

    return {
      ...userOperation,
      callData: appendDataSuffix(existing.callData, attribution),
    };
  } catch (error) {
    if (error instanceof WalletAttributionError) throw error;
    throw new WalletAttributionError(
      "INVALID_USER_OPERATION",
      error instanceof Error ? error.message : "Unable to attribute UserOperation callData.",
      error,
    );
  }
}

export function withUserOperationAttribution<
  TRequest extends SendCallsRequest,
  TUserOperation extends UserOperationLike,
>(
  buildUserOperation: (request: TRequest) => Promise<TUserOperation> | TUserOperation,
  options: WithUserOperationAttributionOptions,
): (request: TRequest) => Promise<TUserOperation> {
  return async (request: TRequest) => {
    const userOperation = await buildUserOperation(request);
    return attributeUserOperation(userOperation, {
      walletCodes: options.walletCodes,
      appDataSuffix: request.capabilities?.dataSuffix?.value,
    });
  };
}

export function validateUserOperationAttribution(
  userOperation: UserOperationLike,
  options: ValidateUserOperationOptions = {},
): UserOperationValidationResult {
  const result = validateAttribution({
    calldata: userOperation.callData,
    expect: options.expect,
  });

  return {
    ...result,
    callData: userOperation.callData,
    attributionPath: "userOp.callData",
  };
}

function peelAttribution(callData: Hex): {
  callData: Hex;
  attributions: DecodedAttribution[];
} {
  const attributions: DecodedAttribution[] = [];
  let remaining = callData;

  while (true) {
    const decoded = decodeAttributionFromCalldata(remaining);
    if (!decoded) break;
    if (attributions.length >= MAX_ATTRIBUTION_LAYERS) {
      throw new WalletAttributionError(
        "INVALID_USER_OPERATION",
        `UserOperation callData exceeds the ${MAX_ATTRIBUTION_LAYERS}-layer attribution limit.`,
      );
    }
    attributions.unshift(decoded);
    remaining = decoded.transactionData;
  }

  return { callData: remaining, attributions };
}

function readExactSuffix(suffix?: Hex): DecodedAttribution | undefined {
  if (!suffix) return undefined;
  const decoded = decodeDataSuffix(suffix);
  if (!decoded || decoded.suffix.toLowerCase() !== suffix.toLowerCase()) {
    throw new WalletAttributionError(
      "INVALID_APP_SUFFIX",
      "The app dataSuffix is not a standalone ERC-8021 suffix.",
    );
  }
  return decoded;
}

function resolveAttributionInput(
  walletCodes: string[],
  attributions: DecodedAttribution[],
): AttributionInput {
  if (attributions.length === 0) {
    return { codes: normalizeCodes(walletCodes) };
  }

  const schemaIds = new Set(attributions.map((attribution) => attribution.id));
  if (schemaIds.size > 1 || (walletCodes.length > 0 && !schemaIds.has(0))) {
    throw new WalletAttributionError(
      "MIXED_ATTRIBUTION_SCHEMA",
      "Wallet and app attribution must use a compatible ERC-8021 schema.",
    );
  }

  const codes = unique([
    ...walletCodes,
    ...attributions.flatMap((attribution) => attribution.codes),
  ]);
  const first = attributions[0];

  if (first.id === 0) {
    return { codes };
  }

  const registry = first.codeRegistry;
  if (!registry || attributions.some((entry) => !sameRegistry(registry, entry.codeRegistry))) {
    throw new WalletAttributionError(
      "REGISTRY_CONFLICT",
      "Schema 1 attribution suffixes must use the same code registry.",
    );
  }

  return { id: 1, codes, codeRegistry: registry };
}

function sameRegistry(left: AttributionRegistry, right: AttributionRegistry | undefined): boolean {
  return (
    right !== undefined &&
    left.address.toLowerCase() === right.address.toLowerCase() &&
    normalizeOptionalBigInt(left.chainId) === normalizeOptionalBigInt(right.chainId)
  );
}

function normalizeOptionalBigInt(value: number | bigint | undefined): bigint | undefined {
  return value === undefined ? undefined : BigInt(value);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
