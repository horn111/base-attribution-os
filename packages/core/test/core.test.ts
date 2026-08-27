import { describe, expect, it } from "vitest";
import {
  appendDataSuffix,
  createAttributionReplayReport,
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

  it("rejects schema 1 attribution without a registry chain ID", () => {
    expect(() =>
      createDataSuffix({
        id: 1,
        codes: ["baseapp"],
        codeRegistry: {
          address: "0xcccccccccccccccccccccccccccccccccccccccc",
        },
      } as unknown as Parameters<typeof createDataSuffix>[0]),
    ).toThrow("codeRegistry.chainId");
  });

  it("rejects unsafe numeric registry chain IDs", () => {
    expect(() =>
      createDataSuffix({
        id: 1,
        codes: ["baseapp"],
        codeRegistry: {
          address: "0xcccccccccccccccccccccccccccccccccccccccc",
          chainId: Number.MAX_SAFE_INTEGER + 1,
        },
      }),
    ).toThrow("safe integer");
  });

  it("rejects schema 1 registry data with a zero chain ID length", () => {
    const invalidSchemaOne =
      `0x${"dd".repeat(40)}${"aa".repeat(19)}00${"62617365617070"}0701${MARKER}` as Hex;

    expect(decodeAttributionFromCalldata(invalidSchemaOne)).toBeUndefined();
  });

  it("rejects unsupported Builder Code formats while encoding", () => {
    expect(() => createDataSuffix({ codes: ["Not A Builder Code"] })).toThrow(
      "1-32 lowercase letters",
    );
    expect(() => createDataSuffix({ codes: ["a".repeat(33)] })).toThrow("1-32 lowercase letters");
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

  it("creates replay reports across attributed and missing transactions", () => {
    const attributed = appendDataSuffix("0x1234", { codes: ["bc_abc123"] });
    const wrong = appendDataSuffix("0x1234", { codes: ["bc_other"] });
    const report = createAttributionReplayReport(
      [
        { hash: `0x${"11".repeat(32)}`, calldata: attributed },
        { hash: `0x${"22".repeat(32)}`, calldata: "0x1234" },
        { hash: `0x${"33".repeat(32)}`, calldata: wrong },
      ],
      {
        builderCode: "bc_abc123",
        generatedAt: "2026-08-23T00:00:00.000Z",
      },
    );

    expect(report).toMatchObject({
      ok: false,
      attributed: 1,
      missing: 1,
      wrongCode: 1,
      total: 3,
      coverage: 33,
      network: "Base mainnet",
    });
    expect(report.transactions.map((transaction) => transaction.status)).toEqual([
      "attributed",
      "missing-attribution",
      "wrong-builder-code",
    ]);
    expect(report.transactions[0].explorerUrl).toContain("basescan.org/tx/");
  });

  it("marks unavailable replay candidates without hiding them from coverage", () => {
    const report = createAttributionReplayReport(
      [{ hash: `0x${"44".repeat(32)}`, error: "Transaction not found" }],
      { builderCode: "bc_abc123" },
    );

    expect(report).toMatchObject({
      ok: false,
      total: 1,
      unavailable: 1,
      coverage: 0,
    });
    expect(report.transactions[0]).toMatchObject({
      status: "unavailable",
      error: "Transaction not found",
    });
  });
});
