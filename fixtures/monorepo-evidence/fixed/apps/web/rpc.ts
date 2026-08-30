import { rpcClient } from "@fixture/attribution";

rpcClient.request({
  method: "eth_sendTransaction",
  params: [{ to, data: "0x" }],
});
