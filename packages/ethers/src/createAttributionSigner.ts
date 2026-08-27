import { appendDataSuffix, type AttributionInput, type Hex } from "@base-attribution-os/core";

export interface EthersTransactionRequestLike {
  data?: Hex;
  [key: string]: unknown;
}

export type EthersTransactionHandler = (
  request: EthersTransactionRequestLike,
) => Promise<unknown> | unknown;

export type EthersSignerLike = {
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
  const sendTransaction = signer.sendTransaction;
  const populateTransaction = signer.populateTransaction;
  const wrapped = new Proxy(signer, {
    get(target, property) {
      if (property === "attribution") return attribution;
      if (property === "sendTransaction" && typeof sendTransaction === "function") {
        return (request: EthersTransactionRequestLike) =>
          Promise.resolve(
            sendTransaction.call(target, withEthersAttribution(request, attribution)),
          );
      }
      if (property === "populateTransaction" && typeof populateTransaction === "function") {
        return (request: EthersTransactionRequestLike) =>
          Promise.resolve(
            populateTransaction.call(target, withEthersAttribution(request, attribution)),
          );
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(target, property) {
      return property === "attribution" || Reflect.has(target, property);
    },
  });

  return wrapped as TSigner & {
    attribution: EthersAttributionOptions;
    sendTransaction?: (request: EthersTransactionRequestLike) => Promise<unknown>;
    populateTransaction?: (request: EthersTransactionRequestLike) => Promise<unknown>;
  };
}
