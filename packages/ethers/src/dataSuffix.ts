import { createDataSuffix, type AttributionInput, type Hex } from "@base-attribution-os/core";

export type BuilderCodeInput = string | string[] | AttributionInput;

export function ethersBuilderCodeDataSuffix(input: BuilderCodeInput): Hex {
  return createDataSuffix(normalizeBuilderCodeInput(input));
}

export function normalizeBuilderCodeInput(input: BuilderCodeInput): AttributionInput {
  if (typeof input === "string") {
    return { codes: [input] };
  }

  if (Array.isArray(input)) {
    return { codes: input };
  }

  return input;
}
