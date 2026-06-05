import { parseEther, type Address } from "viem";
import { builderCodeDataSuffix, withAttributionSuffix } from "@base-attribution-os/viem";

const BUILDER_CODE = "bc_abc123";

export const dataSuffix = builderCodeDataSuffix(BUILDER_CODE);

export function prepareTransfer(to: Address) {
  return withAttributionSuffix(
    {
      to,
      value: parseEther("0.001"),
      data: "0x",
    },
    { codes: [BUILDER_CODE] },
  );
}
