export const ERC8021_SUFFIX = "0x80218021802180218021802180218021" as const;
export const ERC8021_SUFFIX_BYTE_LENGTH = 16;
export const SCHEMA_CANONICAL_REGISTRY = 0;
export const SCHEMA_CUSTOM_REGISTRY = 1;
export const MAX_CODES_BYTE_LENGTH = 255;
export const BUILDER_CODE_PATTERN = /^[A-Za-z0-9._:-]+$/;

export const KNOWN_TRANSACTION_MARKERS = [
  "sendTransaction",
  "writeContract",
  "sendCalls",
  "useSendTransaction",
  "useWriteContract",
  "prepareTransactionRequest",
  "dataSuffix",
] as const;
