import {
  createDataSuffix,
  decodeDataSuffix,
  normalizeCodes,
  type AttributionInput,
  type AttributionRegistry,
  type Hex,
} from "@base-attribution-os/core";
import { getDataSuffixSupport, normalizeChainId } from "./capabilities.js";
import {
  WalletAttributionError,
  type AttributionDelivery,
  type DataSuffixSupport,
  type Eip1193Provider,
  type Eip1193Request,
  type FallbackMode,
  type SendCallsRequest,
} from "./types.js";

export type SendAttributedCallsOptions = AttributionInput & {
  fallback?: FallbackMode;
};

export interface AttributionOutcome {
  delivery: AttributionDelivery;
  codes: string[];
  chainId: Hex;
  support: DataSuffixSupport;
}

export interface SendAttributedCallsResult<TResult = unknown> {
  result: TResult;
  attribution: AttributionOutcome;
}

export type AttributionProviderOptions = SendAttributedCallsOptions & {
  onAttributionFallback?: (outcome: AttributionOutcome) => void;
};

export function withDataSuffixCapability(
  request: SendCallsRequest,
  attribution: AttributionInput,
): SendCallsRequest {
  const existing = request.capabilities?.dataSuffix?.value;
  const codes = [...normalizeCodes(attribution.codes)];

  if (existing !== undefined) {
    const decoded = decodeDataSuffix(existing);
    if (!decoded || decoded.suffix.toLowerCase() !== existing.toLowerCase()) {
      throw new WalletAttributionError(
        "INVALID_APP_SUFFIX",
        "wallet_sendCalls contains an invalid dataSuffix capability.",
      );
    }
    if (decoded.id !== (attribution.id ?? 0)) {
      throw new WalletAttributionError(
        "MIXED_ATTRIBUTION_SCHEMA",
        "Cannot merge dataSuffix capabilities with different attribution schemas.",
      );
    }
    if (
      decoded.id === 1 &&
      !sameRegistry(decoded.codeRegistry, readRegistryFromInput(attribution))
    ) {
      throw new WalletAttributionError(
        "REGISTRY_CONFLICT",
        "Cannot merge dataSuffix capabilities that use different code registries.",
      );
    }
    codes.push(...decoded.codes);
  }

  const suffix = createDataSuffix({ ...attribution, codes: unique(codes) } as AttributionInput);

  return {
    ...request,
    calls: request.calls.map((call) => ({ ...call })),
    capabilities: {
      ...request.capabilities,
      dataSuffix: {
        value: suffix,
        optional: false,
      },
    },
  };
}

export async function sendAttributedCalls<TResult = unknown>(
  provider: Eip1193Provider,
  request: SendCallsRequest,
  options: SendAttributedCallsOptions,
): Promise<SendAttributedCallsResult<TResult>> {
  assertSendCallsRequest(request);
  const fallback = options.fallback ?? "strict";
  const codes = normalizeCodes(options.codes);
  const support = await getDataSuffixSupport(provider, {
    account: request.from,
    chainId: request.chainId,
  });

  if (support.status === "supported") {
    const attributedRequest = withDataSuffixCapability(request, { ...options, codes });
    const deliveredCodes =
      decodeDataSuffix(attributedRequest.capabilities?.dataSuffix?.value ?? "0x")?.codes ?? codes;
    const result = (await provider.request({
      method: "wallet_sendCalls",
      params: [attributedRequest],
    })) as TResult;
    return {
      result,
      attribution: {
        delivery: "dataSuffix",
        codes: deliveredCodes,
        chainId: support.chainId,
        support,
      },
    };
  }

  if (fallback === "strict") {
    const code =
      support.status === "unsupported" ? "DATA_SUFFIX_UNSUPPORTED" : "CAPABILITY_UNAVAILABLE";
    throw new WalletAttributionError(
      code,
      support.status === "unsupported"
        ? `Wallet does not support dataSuffix on chain ${support.chainId}.`
        : `Unable to verify dataSuffix support on chain ${support.chainId}.`,
      support.status === "unavailable" ? support.error : undefined,
    );
  }

  const result = (await provider.request({
    method: "wallet_sendCalls",
    params: [withoutDataSuffixCapability(request)],
  })) as TResult;
  return {
    result,
    attribution: {
      delivery: "unattributed",
      codes,
      chainId: support.chainId,
      support,
    },
  };
}

export function createAttributionProvider<TProvider extends Eip1193Provider>(
  provider: TProvider,
  options: AttributionProviderOptions,
): TProvider {
  return new Proxy(provider, {
    get(target, property, receiver) {
      if (property !== "request") {
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      }

      return async (rpcRequest: Eip1193Request): Promise<unknown> => {
        if (rpcRequest.method !== "wallet_sendCalls") {
          return provider.request(rpcRequest);
        }

        const request = readSendCallsRequest(rpcRequest);
        const sent = await sendAttributedCalls(provider, request, options);
        if (sent.attribution.delivery === "unattributed") {
          options.onAttributionFallback?.(sent.attribution);
        }
        return sent.result;
      };
    },
  });
}

function readSendCallsRequest(request: Eip1193Request): SendCallsRequest {
  const first = Array.isArray(request.params) ? request.params[0] : undefined;
  if (!isRecord(first)) {
    throw new WalletAttributionError(
      "INVALID_SEND_CALLS_REQUEST",
      "wallet_sendCalls expects its request object as the first params entry.",
    );
  }
  return first as unknown as SendCallsRequest;
}

function assertSendCallsRequest(request: SendCallsRequest): void {
  if (
    !isRecord(request) ||
    typeof request.from !== "string" ||
    request.from.length === 0 ||
    request.chainId === undefined ||
    !Array.isArray(request.calls)
  ) {
    throw new WalletAttributionError(
      "INVALID_SEND_CALLS_REQUEST",
      "wallet_sendCalls requires from, chainId, and a calls array.",
    );
  }

  normalizeChainId(request.chainId);
}

function cloneSendCallsRequest(request: SendCallsRequest): SendCallsRequest {
  return {
    ...request,
    calls: request.calls.map((call) => ({ ...call })),
    ...(request.capabilities ? { capabilities: { ...request.capabilities } } : {}),
  };
}

function withoutDataSuffixCapability(request: SendCallsRequest): SendCallsRequest {
  const cloned = cloneSendCallsRequest(request);
  if (!cloned.capabilities?.dataSuffix) return cloned;
  const { dataSuffix: _dataSuffix, ...capabilities } = cloned.capabilities;
  return {
    ...cloned,
    capabilities,
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function readRegistryFromInput(input: AttributionInput): AttributionRegistry | undefined {
  if (!("codeRegistry" in input) && !("codeRegistryAddress" in input)) return undefined;
  const address = input.codeRegistry?.address ?? input.codeRegistryAddress;
  return address ? { address, chainId: input.codeRegistry?.chainId } : undefined;
}

function sameRegistry(
  left: AttributionRegistry | undefined,
  right: AttributionRegistry | undefined,
): boolean {
  return (
    left !== undefined &&
    right !== undefined &&
    left.address.toLowerCase() === right.address.toLowerCase() &&
    optionalBigInt(left.chainId) === optionalBigInt(right.chainId)
  );
}

function optionalBigInt(value: number | bigint | undefined): bigint | undefined {
  return value === undefined ? undefined : BigInt(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
