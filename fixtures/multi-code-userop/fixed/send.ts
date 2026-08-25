import { createDataSuffix } from "@base-attribution-os/core";
import { attributeUserOperation } from "@base-attribution-os/wallet";

export async function send(provider, userOp, entryPoint) {
  const attributed = attributeUserOperation(userOp, {
    walletCodes: ["bc_abc123"],
    appDataSuffix: createDataSuffix({ codes: ["bc_partner"] }),
  });
  return provider.request({ method: "eth_sendUserOperation", params: [attributed, entryPoint] });
}
