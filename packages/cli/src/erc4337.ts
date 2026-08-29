import { assertHex, hexByteLength, sliceHex, type Hex } from "@base-attribution-os/core";

const WORD_BYTES = 32;
const HANDLE_OPS_SELECTORS = new Set(["0x1fad948c", "0x765e827f"]);
const ENTRY_POINT_BY_SELECTOR = new Map([
  ["0x1fad948c", "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789"],
  ["0x765e827f", "0x0000000071727de22e5e9d8baf0edac6f37da032"],
]);

export function isSupportedErc4337HandleOps(input: Hex, target?: Hex): boolean {
  try {
    assertHex(input, "transaction calldata");
    if (hexByteLength(input) < 4 || !target) return false;
    const selector = sliceHex(input, 0, 4).toLowerCase();
    return ENTRY_POINT_BY_SELECTOR.get(selector) === target.toLowerCase();
  } catch {
    return false;
  }
}

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
