import { appendDataSuffix, type Hex } from "@base-attribution-os/core";

const BUILDER_CODE = "bc_abc123";

export interface WalletCall {
  to: Hex;
  data?: Hex;
  value?: Hex;
}

export function attributeSendCalls(calls: WalletCall[]): WalletCall[] {
  return calls.map((call) => ({
    ...call,
    data: appendDataSuffix(call.data ?? "0x", { codes: [BUILDER_CODE] }),
  }));
}
