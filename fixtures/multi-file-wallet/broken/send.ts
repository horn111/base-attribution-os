export async function sendBatch(wallet) {
  return wallet.sendCalls({ calls: [{ to, data: "0x" }] });
}
