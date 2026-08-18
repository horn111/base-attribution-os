import { createDataSuffix } from "@base-attribution-os/core";

export async function batch(wallet) {
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
