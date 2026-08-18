export const transactionTool = {
  execute: async ({ wallet, transaction }) => wallet.sendTransaction(transaction),
};
