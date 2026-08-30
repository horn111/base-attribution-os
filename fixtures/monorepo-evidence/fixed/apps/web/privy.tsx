import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { privyConfig } from "@fixture/attribution";

function Wallet() {
  const { sendTransaction } = usePrivy();
  return <button onClick={() => sendTransaction({ to, data: "0x" })}>Send</button>;
}

export function App() {
  return (
    <PrivyProvider config={privyConfig}>
      <Wallet />
    </PrivyProvider>
  );
}
