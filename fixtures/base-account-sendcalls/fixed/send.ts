import { sendAttributedCalls } from "@base-attribution-os/wallet";

export async function send(provider, account, calls) {
  return sendAttributedCalls(
    provider,
    {
      version: "1.0",
      chainId: "0x2105",
      from: account,
      calls,
    },
    { codes: ["bc_abc123"] },
  );
}
