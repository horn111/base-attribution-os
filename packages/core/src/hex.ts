import { ERC8021_SUFFIX } from "./constants.js";

export type Hex = `0x${string}`;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function isHex(value: string): value is Hex {
  return /^0x([0-9a-fA-F]{2})*$/.test(value);
}

export function assertHex(value: string, label = "hex"): asserts value is Hex {
  if (!isHex(value)) {
    throw new Error(`${label} must be 0x-prefixed hex with an even number of digits`);
  }
}

export function stripHexPrefix(hex: Hex): string {
  return hex.slice(2);
}

export function hexByteLength(hex: Hex): number {
  return stripHexPrefix(hex).length / 2;
}

export function concatHex(values: Hex[]): Hex {
  return `0x${values.map((value) => stripHexPrefix(value)).join("")}`;
}

export function numberToByteHex(value: number): Hex {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error("value must fit in one byte");
  }

  return `0x${value.toString(16).padStart(2, "0")}`;
}

export function bigintToMinimalHex(value: bigint): Hex {
  if (value < 0n) {
    throw new Error("value must be non-negative");
  }

  if (value === 0n) {
    return "0x00";
  }

  const hex = value.toString(16);
  return `0x${hex.length % 2 === 0 ? hex : `0${hex}`}`;
}

export function stringToHex(value: string): Hex {
  return bytesToHex(encoder.encode(value));
}

export function hexToString(hex: Hex): string {
  return decoder.decode(hexToBytes(hex));
}

export function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hexToBytes(hex: Hex): Uint8Array {
  assertHex(hex);

  const clean = stripHexPrefix(hex);
  const bytes = new Uint8Array(clean.length / 2);

  for (let index = 0; index < clean.length; index += 2) {
    bytes[index / 2] = Number.parseInt(clean.slice(index, index + 2), 16);
  }

  return bytes;
}

export function sliceHex(hex: Hex, startByte: number, endByte?: number): Hex {
  const clean = stripHexPrefix(hex);
  const start = startByte < 0 ? clean.length + startByte * 2 : startByte * 2;
  const end =
    endByte === undefined ? clean.length : endByte < 0 ? clean.length + endByte * 2 : endByte * 2;

  return `0x${clean.slice(start, end)}`;
}

export function hexToNumber(hex: Hex): number {
  return Number.parseInt(stripHexPrefix(hex) || "0", 16);
}

export function hasErc8021Marker(data: Hex): boolean {
  return data.toLowerCase().endsWith(ERC8021_SUFFIX.toLowerCase().slice(2));
}
