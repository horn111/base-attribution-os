import { appendDataSuffix, validateAttribution, type Hex } from "@base-attribution-os/core";

const BUILDER_CODE = "bc_abc123";

export interface AgentTransactionToolInput {
  to: Hex;
  data?: Hex;
  value?: Hex;
}

export function prepareAgentTransaction(input: AgentTransactionToolInput) {
  const data = appendDataSuffix(input.data ?? "0x", { codes: [BUILDER_CODE] });
  const validation = validateAttribution({ calldata: data, expect: BUILDER_CODE });

  if (!validation.ok) {
    throw new Error(validation.errors.join("; "));
  }

  return {
    ...input,
    data,
  };
}
