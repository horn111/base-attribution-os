import { describe, expect, it } from "vitest";
import {
  appendDataSuffix,
  createDataSuffix,
  decodeAttributionFromCalldata,
  validateAttribution,
  type Hex,
} from "../src/index.js";

const MARKER = "80218021802180218021802180218021";

describe("@base-attribution-os/core", () => {
  it("encodes schema 0 suffixes in the ox/erc8021 format", () => {
    expect(createDataSuffix({ codes: ["baseapp", "morpho"] })).toBe(
      `0x626173656170702c6d6f7270686f0e00${MARKER}`,
    );
  });

  it("decodes schema 0 suffixes from full calldata", () => {
    const calldata = appendDataSuffix("0xdddddddd", { codes: ["baseapp"] });
    const decoded = decodeAttributionFromCalldata(calldata);

    expect(decoded).toMatchObject({
      id: 0,
      codes: ["baseapp"],
      transactionData: "0xdddddddd",
    });
  });

  it("encodes and decodes schema 1 registry suffixes", () => {
    const suffix = createDataSuffix({
      id: 1,
      codes: ["baseapp"],
      codeRegistry: {
        address: "0xcccccccccccccccccccccccccccccccccccccccc",
        chainId: 8453,
      },
    });

    expect(suffix).toBe(
      `0xcccccccccccccccccccccccccccccccccccccccc210502626173656170700701${MARKER}`,
    );

    const decoded = decodeAttributionFromCalldata(`0xdddddddd${suffix.slice(2)}` as Hex);

    expect(decoded).toMatchObject({
      id: 1,
      codes: ["baseapp"],
      transactionData: "0xdddddddd",
      codeRegistry: {
        address: "0xcccccccccccccccccccccccccccccccccccccccc",
        chainId: 8453n,
      },
    });
  });

  it("reports invalid hex", () => {
    const result = validateAttribution({ calldata: "0x123" as Hex });

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("0x-prefixed hex");
  });

  it("reports missing ERC-8021 markers", () => {
    const result = validateAttribution({ calldata: "0x1234" });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("missing ERC-8021 marker");
  });

  it("validates expected Builder Codes", () => {
    const calldata = appendDataSuffix("0x", { codes: ["baseapp"] });

    expect(validateAttribution({ calldata, expect: "baseapp" }).ok).toBe(true);
    expect(validateAttribution({ calldata, expect: "bc_missing" }).ok).toBe(false);
  });

  it("warns when multiple comma-separated Builder Codes are present", () => {
    const calldata = appendDataSuffix("0x", { codes: ["baseapp", "morpho"] });
    const result = validateAttribution({ calldata });

    expect(result.ok).toBe(true);
    expect(result.warnings[0]).toContain("multiple Builder Codes");
  });
});
