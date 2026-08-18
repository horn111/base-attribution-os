import { useSendTransaction } from "wagmi";

export function SendButton() {
  const { sendTransaction } = useSendTransaction();
  return <button onClick={() => sendTransaction({ to, data: "0x" })}>Send</button>;
}
