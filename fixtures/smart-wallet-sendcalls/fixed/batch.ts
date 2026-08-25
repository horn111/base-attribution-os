import { createDataSuffix } from "@base-attribution-os/core";

export async function batch(wallet) {
  const capabilities = await wallet.request({
    method: "wallet_getCapabilities",
    params: [account, ["0x2105"]],
  });
  if (!capabilities["0x2105"]?.dataSuffix?.supported) {
    throw new Error("dataSuffix is required");
  }

  return wallet.sendCalls({
    calls: [{ to, data: "0x" }],
    capabilities: {
      dataSuffix: {
        value: createDataSuffix({ codes: ["bc_abc123"] }),
        optional: true,
      },
    },
  });
}
