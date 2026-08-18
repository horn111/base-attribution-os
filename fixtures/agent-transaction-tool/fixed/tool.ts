import { withViemDataSuffix } from "@base-attribution-os/viem";

export const transactionTool = {
  execute: async ({ wallet, transaction }) =>
    wallet.sendTransaction(withViemDataSuffix(transaction, "bc_abc123")),
};
