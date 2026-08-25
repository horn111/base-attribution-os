import { createDataSuffix } from "@base-attribution-os/core";

export async function send(provider, userOp, entryPoint) {
  const walletSuffix = createDataSuffix({ codes: ["bc_abc123"] });
  const appSuffix = createDataSuffix({ codes: ["bc_partner"] });
  userOp.callData = `${userOp.callData}${walletSuffix.slice(2)}${appSuffix.slice(2)}`;
  return provider.request({ method: "eth_sendUserOperation", params: [userOp, entryPoint] });
}
