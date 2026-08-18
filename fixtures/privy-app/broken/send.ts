import "@privy-io/react-auth";

export async function send(wallet) {
  return wallet.sendTransaction({ to, data: "0x" });
}
