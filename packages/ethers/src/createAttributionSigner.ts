import { appendDataSuffix, type AttributionInput, type Hex } from "@base-attribution-os/core";

export interface EthersTransactionRequestLike {
  data?: Hex;
  [key: string]: unknown;
}

export type EthersTransactionHandler = (
  request: EthersTransactionRequestLike,
) => Promise<unknown> | unknown;

export type EthersSignerLike = Record<string, unknown> & {
  sendTransaction?: EthersTransactionHandler;
  populateTransaction?: EthersTransactionHandler;
};

export type EthersAttributionOptions = AttributionInput;

export function withEthersAttribution<TRequest extends EthersTransactionRequestLike>(
  request: TRequest,
  attribution: AttributionInput,
): TRequest & { data: Hex } {
  return {
    ...request,
    data: appendDataSuffix(request.data, attribution),
  };
}

export function createAttributionSigner<TSigner extends EthersSignerLike>(
  signer: TSigner,
  attribution: EthersAttributionOptions,
): TSigner & {
  attribution: EthersAttributionOptions;
  sendTransaction?: (request: EthersTransactionRequestLike) => Promise<unknown>;
  populateTransaction?: (request: EthersTransactionRequestLike) => Promise<unknown>;
} {
  const wrapped: Record<string, unknown> = {
    ...signer,
    attribution,
  };
  const sendTransaction = signer.sendTransaction;
  const populateTransaction = signer.populateTransaction;

  if (typeof sendTransaction === "function") {
    wrapped.sendTransaction = (request: EthersTransactionRequestLike) =>
      sendTransaction(withEthersAttribution(request, attribution));
  }

  if (typeof populateTransaction === "function") {
    wrapped.populateTransaction = (request: EthersTransactionRequestLike) =>
      populateTransaction(withEthersAttribution(request, attribution));
  }

  return wrapped as TSigner & {
    attribution: EthersAttributionOptions;
    sendTransaction?: (request: EthersTransactionRequestLike) => Promise<unknown>;
    populateTransaction?: (request: EthersTransactionRequestLike) => Promise<unknown>;
  };
}
