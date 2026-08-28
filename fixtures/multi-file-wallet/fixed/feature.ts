import { sendBatch } from "./attributed-send.js";

export async function mintSeasonReward(provider, request) {
  return sendBatch(provider, request);
}
