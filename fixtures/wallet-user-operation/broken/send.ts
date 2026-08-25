export async function send(provider, userOp, entryPoint) {
  return provider.request({
    method: "eth_sendUserOperation",
    params: [userOp, entryPoint],
  });
}
