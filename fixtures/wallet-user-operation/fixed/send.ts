import { attributeUserOperation } from "@base-attribution-os/wallet";

export async function send(provider, userOp, entryPoint, appDataSuffix) {
  const attributed = attributeUserOperation(userOp, {
    walletCodes: ["bc_abc123"],
    appDataSuffix,
  });
  return provider.request({
    method: "eth_sendUserOperation",
    params: [attributed, entryPoint],
  });
}
