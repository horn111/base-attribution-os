import { createAttributionSigner } from "@base-attribution-os/ethers";

export const ethersSigner = createAttributionSigner(signer, {
  codes: ["bc_abc123"],
});
