import type { Hex } from "@base-attribution-os/core";

export type ChainId = Hex | number | bigint;
export type FallbackMode = "strict" | "best-effort";
export type AttributionDelivery = "dataSuffix" | "unattributed";

export interface Eip1193Request {
  method: string;
  params?: readonly unknown[] | object;
}

export interface Eip1193Provider {
  request(request: Eip1193Request): Promise<unknown>;
  [key: string]: unknown;
}

export interface WalletCall {
  to?: Hex;
  data?: Hex;
  value?: Hex;
  capabilities?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DataSuffixCapabilityRequest {
  value: Hex;
  optional: boolean;
}

export interface SendCallsRequest {
  version?: string;
  chainId: ChainId;
  from: Hex;
  calls: readonly WalletCall[];
  capabilities?: Record<string, unknown> & {
    dataSuffix?: DataSuffixCapabilityRequest;
  };
  [key: string]: unknown;
}

export interface UserOperationLike {
  callData: Hex;
  [key: string]: unknown;
}

export type DataSuffixSupport =
  | {
      status: "supported";
      chainId: Hex;
      source: "chain" | "global";
    }
  | {
      status: "unsupported";
      chainId: Hex;
      reason: "not-advertised" | "reported-unsupported";
    }
  | {
      status: "unavailable";
      chainId: Hex;
      reason: "request-failed" | "malformed-response";
      error?: unknown;
    };

export type WalletAttributionErrorCode =
  | "CAPABILITY_UNAVAILABLE"
  | "DATA_SUFFIX_UNSUPPORTED"
  | "INVALID_APP_SUFFIX"
  | "INVALID_SEND_CALLS_REQUEST"
  | "INVALID_USER_OPERATION"
  | "MIXED_ATTRIBUTION_SCHEMA"
  | "REGISTRY_CONFLICT";

export class WalletAttributionError extends Error {
  readonly code: WalletAttributionErrorCode;
  readonly cause?: unknown;

  constructor(code: WalletAttributionErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "WalletAttributionError";
    this.code = code;
    this.cause = cause;
  }
}
