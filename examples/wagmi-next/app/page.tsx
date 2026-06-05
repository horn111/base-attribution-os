"use client";

import { useAttributionSuffix } from "@base-attribution-os/wagmi";

const BUILDER_CODE = "bc_abc123";

export default function Page() {
  const dataSuffix = useAttributionSuffix({ codes: [BUILDER_CODE] });

  return (
    <main style={{ fontFamily: "system-ui", padding: 32 }}>
      <h1>Wagmi Builder Code example</h1>
      <p>Pass this suffix into your writeContract or sendTransaction request.</p>
      <code>{dataSuffix}</code>
    </main>
  );
}
