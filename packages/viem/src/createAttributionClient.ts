import { appendDataSuffix, type AttributionInput, type Hex } from "@base-attribution-os/core";

export interface TransactionLike {
  data?: Hex;
  dataSuffix?: Hex;
  [key: string]: unknown;
}

export type AttributionClientOptions = AttributionInput & {
  preferDataSuffixField?: boolean;
};

export type TransactionSender = (request: TransactionLike) => Promise<unknown> | unknown;

export type ViemClientLike = Record<string, unknown> & {
  sendTransaction?: TransactionSender;
  writeContract?: TransactionSender;
};

export function withAttributionSuffix<TRequest extends TransactionLike>(
  request: TRequest,
  attribution: AttributionInput,
): TRequest & { data: Hex } {
  return {
    ...request,
    data: appendDataSuffix(request.data, attribution),
  };
}

export function withViemDataSuffix<TRequest extends TransactionLike>(
  request: TRequest,
  attribution: AttributionInput,
): TRequest & { dataSuffix: Hex } {
  return {
    ...request,
    dataSuffix: appendDataSuffix("0x", attribution),
  };
}

export function createAttributionClient<TClient extends ViemClientLike>(
  client: TClient,
  options: AttributionClientOptions,
): TClient & {
  attribution: AttributionClientOptions;
  sendTransaction?: (request: TransactionLike) => Promise<unknown>;
  writeContract?: (request: TransactionLike) => Promise<unknown>;
} {
  const wrapped: Record<string, unknown> = {
    ...client,
    attribution: options,
  };
  const attribution = options as AttributionInput;
  const sendTransaction = client.sendTransaction;
  const writeContract = client.writeContract;

  if (typeof sendTransaction === "function") {
    wrapped.sendTransaction = (request: TransactionLike) =>
      sendTransaction(
        options.preferDataSuffixField
          ? withViemDataSuffix(request, attribution)
          : withAttributionSuffix(request, attribution),
      );
  }

  if (typeof writeContract === "function") {
    wrapped.writeContract = (request: TransactionLike) =>
      writeContract(
        options.preferDataSuffixField
          ? withViemDataSuffix(request, attribution)
          : withAttributionSuffix(request, attribution),
      );
  }

  return wrapped as TClient & {
    attribution: AttributionClientOptions;
    sendTransaction?: (request: TransactionLike) => Promise<unknown>;
    writeContract?: (request: TransactionLike) => Promise<unknown>;
  };
}
