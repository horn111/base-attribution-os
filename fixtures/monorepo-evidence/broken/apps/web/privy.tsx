import { usePrivy } from "@privy-io/react-auth";
export function Wallet() {
  const { sendTransaction } = usePrivy();
  return <button onClick={() => sendTransaction({ to, data: "0x" })}>Send</button>;
}
