import { assertHex, hexByteLength, sliceHex, type Hex } from "@base-attribution-os/core";

const WORD_BYTES = 32;
const HANDLE_OPS_SELECTORS = new Set(["0x1fad948c", "0x765e827f"]);

export function extractErc4337UserOperationCalldata(input: Hex): Hex[] {
  try {
    assertHex(input, "transaction calldata");

    if (hexByteLength(input) < 4 + WORD_BYTES * 2) {
      return [];
    }

    const selector = sliceHex(input, 0, 4).toLowerCase();
    if (!HANDLE_OPS_SELECTORS.has(selector)) {
      return [];
    }

    const args = sliceHex(input, 4);
    const opsOffset = readWordNumber(args, 0);
    if (opsOffset === undefined) {
      return [];
    }

    const operationCount = readWordNumber(args, opsOffset);
    if (operationCount === undefined) {
      return [];
    }

    const offsetsStart = opsOffset + WORD_BYTES;
    const availableOffsetWords = Math.floor((hexByteLength(args) - offsetsStart) / WORD_BYTES);
    if (operationCount > availableOffsetWords) {
      return [];
    }

    const result: Hex[] = [];

    for (let index = 0; index < operationCount; index += 1) {
      const operationOffset = readWordNumber(args, offsetsStart + index * WORD_BYTES);
      if (operationOffset === undefined) {
        return [];
      }

      const operationStart = offsetsStart + operationOffset;
      const callDataOffset = readWordNumber(args, operationStart + WORD_BYTES * 3);
      if (callDataOffset === undefined) {
        return [];
      }

      const callDataLengthOffset = operationStart + callDataOffset;
      const callDataLength = readWordNumber(args, callDataLengthOffset);
      if (callDataLength === undefined) {
        return [];
      }

      const callDataStart = callDataLengthOffset + WORD_BYTES;
      const callDataEnd = callDataStart + callDataLength;
      if (callDataEnd > hexByteLength(args)) {
        return [];
      }

      result.push(sliceHex(args, callDataStart, callDataEnd));
    }

    return result;
  } catch {
    return [];
  }
}

function readWordNumber(data: Hex, offset: number): number | undefined {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + WORD_BYTES > hexByteLength(data)) {
    return undefined;
  }

  const value = BigInt(sliceHex(data, offset, offset + WORD_BYTES));
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : undefined;
}
