import { appendDataSuffix } from "@base-attribution-os/core";

export async function send(from, to) {
  return window.ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data: appendDataSuffix("0x", { codes: ["bc_abc123"] }) }],
  });
}
