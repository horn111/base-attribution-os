import { builderCodeDataSuffix } from "@base-attribution-os/viem";
import { createWalletClient } from "viem";
import { createAttributionSigner } from "@base-attribution-os/ethers";
import { withDataSuffixCapability } from "@base-attribution-os/wallet";
import { declareBuilderCodeExtension } from "@x402/extensions/builder-code";
import { dataSuffix } from "@privy-io/react-auth";

export const unrelatedViem = createWalletClient({ dataSuffix: builderCodeDataSuffix("bc_abc123") });
export const unrelatedEthers = createAttributionSigner(signer, { codes: ["bc_abc123"] });
export const unrelatedWallet = withDataSuffixCapability({ calls: [] }, { codes: ["bc_abc123"] });
export const unrelatedX402 = declareBuilderCodeExtension("bc_abc123");
export const unrelatedPrivy = { plugins: [dataSuffix("bc_abc123")] };
