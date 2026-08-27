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

export type ViemClientLike = {
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
  const attribution = options as AttributionInput;
  const sendTransaction = client.sendTransaction;
  const writeContract = client.writeContract;
  const withAttribution = (request: TransactionLike) =>
    options.preferDataSuffixField
      ? withViemDataSuffix(request, attribution)
      : withAttributionSuffix(request, attribution);
  const wrapped = new Proxy(client, {
    get(target, property) {
      if (property === "attribution") return options;
      if (property === "sendTransaction" && typeof sendTransaction === "function") {
        return (request: TransactionLike) =>
          Promise.resolve(sendTransaction.call(target, withAttribution(request)));
      }
      if (property === "writeContract" && typeof writeContract === "function") {
        return (request: TransactionLike) =>
          Promise.resolve(writeContract.call(target, withAttribution(request)));
      }

      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(target, property) {
      return property === "attribution" || Reflect.has(target, property);
    },
  });

  return wrapped as TClient & {
    attribution: AttributionClientOptions;
    sendTransaction?: (request: TransactionLike) => Promise<unknown>;
    writeContract?: (request: TransactionLike) => Promise<unknown>;
  };
}
