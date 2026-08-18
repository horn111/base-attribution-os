export async function send(from, to) {
  return window.ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data: "0x" }],
  });
}
