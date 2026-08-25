import { createDataSuffix, type Hex } from "@base-attribution-os/core";
import {
  attributeUserOperation,
  sendAttributedCalls,
  type Eip1193Provider,
  type SendCallsRequest,
  type UserOperationLike,
} from "@base-attribution-os/wallet";

const BUILDER_CODE = "bc_abc123";
export const BASE_MAINNET = "0x2105";
export const BASE_SEPOLIA = "0x14a34";

export interface WalletCall {
  to: Hex;
  data?: Hex;
  value?: Hex;
}

export async function sendBaseAccountBatch(provider: Eip1193Provider, request: SendCallsRequest) {
  return sendAttributedCalls(provider, request, {
    codes: [BUILDER_CODE],
  });
}

export function attributeWalletUserOperation<TUserOperation extends UserOperationLike>(
  userOperation: TUserOperation,
  appCode: string,
): TUserOperation {
  return attributeUserOperation(userOperation, {
    walletCodes: [BUILDER_CODE],
    appDataSuffix: createDataSuffix({ codes: [appCode] }),
  });
}
