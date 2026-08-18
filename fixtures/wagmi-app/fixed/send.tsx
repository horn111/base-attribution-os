import { useSendTransaction } from "wagmi";
import { useAttributionSuffix } from "@base-attribution-os/wagmi";

export function SendButton() {
  const { sendTransaction } = useSendTransaction();
  const dataSuffix = useAttributionSuffix("bc_abc123");
  return <button onClick={() => sendTransaction({ to, data: "0x", dataSuffix })}>Send</button>;
}
