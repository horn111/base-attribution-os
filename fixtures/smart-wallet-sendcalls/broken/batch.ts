export async function batch(wallet) {
  return wallet.sendCalls({ calls: [{ to, data: "0x" }] });
}
