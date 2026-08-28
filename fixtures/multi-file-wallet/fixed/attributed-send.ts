import { sendAttributedCalls } from "@base-attribution-os/wallet";

export async function sendBatch(provider, request) {
  return sendAttributedCalls(provider, request, { codes: ["bc_abc123"] });
}
