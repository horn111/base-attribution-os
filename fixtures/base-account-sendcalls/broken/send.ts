import { createDataSuffix } from "@base-attribution-os/core";

export async function send(provider, account, calls) {
  return provider.request({
    method: "wallet_sendCalls",
    params: [
      {
        version: "1.0",
        chainId: "0x2105",
        from: account,
        calls,
        capabilities: {
          dataSuffix: {
            value: createDataSuffix({ codes: ["bc_abc123"] }),
            optional: true,
          },
        },
      },
    ],
  });
}
