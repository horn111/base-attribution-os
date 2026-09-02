import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_PROOF_SET_SCHEMA_VERSION,
  MAX_ATTRIBUTION_PROOF_SET_REPORTS,
  createAttributionProofSet,
  createAttributionReplayReport,
  createDataSuffix,
  parseAttributionProofSet,
  type AttributionReplayReport,
  type Hex,
} from "../src/index.js";

const BUILDER_CODE = "bc_abc123";
const OTHER_CODE = "bc_other";
const HASH_A = `0x${"11".repeat(32)}` as Hex;
const HASH_B = `0x${"22".repeat(32)}` as Hex;
const HASH_C = `0x${"33".repeat(32)}` as Hex;

function report(
  hash: Hex,
  options: {
    calldata?: Hex;
    chainId?: number;
    generatedAt?: string;
    verified?: boolean;
  } = {},
): AttributionReplayReport {
  return createAttributionReplayReport(
    [
      {
        hash,
        calldata: options.calldata ?? createDataSuffix({ codes: [BUILDER_CODE] }),
        verified: options.verified ?? true,
      },
    ],
    {
      builderCode: BUILDER_CODE,
      chainId: options.chainId,
      generatedAt: options.generatedAt ?? "2026-09-01T00:00:00.000Z",
    },
  );
}

describe("Attribution Proof Sets", () => {
  it("creates and parses a canonical single-report manifest", () => {
    const proofSet = createAttributionProofSet([report(HASH_A)], {
      title: "  Example project  ",
      builderCode: BUILDER_CODE,
    });

    expect(proofSet).toMatchObject({
      schemaVersion: ATTRIBUTION_PROOF_SET_SCHEMA_VERSION,
      title: "Example project",
      builderCode: BUILDER_CODE,
      generatedAt: "2026-09-01T00:00:00.000Z",
      ok: true,
      summary: {
        reports: 1,
        total: 1,
        attributed: 1,
        verified: 1,
        coverage: 100,
      },
    });
    expect(parseAttributionProofSet(JSON.parse(JSON.stringify(proofSet)))).toEqual(proofSet);
  });

  it("sorts mixed-network reports and aggregates every replay status", () => {
    const mainnet = createAttributionReplayReport(
      [
        { hash: HASH_A, calldata: createDataSuffix({ codes: [BUILDER_CODE] }), verified: true },
        { hash: HASH_B, calldata: "0x1234", verified: true },
      ],
      { builderCode: BUILDER_CODE, generatedAt: "2026-09-02T00:00:00Z" },
    );
    const sepolia = createAttributionReplayReport(
      [
        { hash: HASH_C, calldata: createDataSuffix({ codes: [OTHER_CODE] }), verified: true },
        { hash: `0x${"44".repeat(32)}` as Hex, error: "RPC unavailable" },
      ],
      {
        builderCode: BUILDER_CODE,
        chainId: 84532,
        generatedAt: "2026-09-01T00:00:00Z",
      },
    );

    const proofSet = createAttributionProofSet([mainnet, sepolia], {
      title: "Mixed evidence",
      builderCode: BUILDER_CODE,
    });

    expect(proofSet.reports.map((entry) => entry.chainId)).toEqual([84532, 8453]);
    expect(proofSet.summary).toMatchObject({
      reports: 2,
      total: 4,
      attributed: 1,
      missing: 1,
      wrongCode: 1,
      unavailable: 1,
      verified: 3,
      unverified: 1,
      coverage: 25,
    });
    expect(proofSet.summary.networks.map((entry) => entry.chainId)).toEqual([8453, 84532]);
    expect(proofSet.ok).toBe(false);
  });

  it("deduplicates identical transactions and promotes verified evidence", () => {
    const offline = report(HASH_A, { verified: false, generatedAt: "2026-09-01T00:00:00Z" });
    const verified = report(HASH_A, { verified: true, generatedAt: "2026-09-02T00:00:00Z" });
    const proofSet = createAttributionProofSet([verified, offline], {
      title: "Progressive verification",
      builderCode: BUILDER_CODE,
    });

    expect(proofSet.summary).toMatchObject({ reports: 2, total: 1, verified: 1 });
    expect(proofSet.ok).toBe(true);
    expect(proofSet.summary.total).toBe(1);
  });

  it("rejects conflicting calldata for the same chain and hash", () => {
    const attributed = report(HASH_A);
    const wrongCode = report(HASH_A, { calldata: createDataSuffix({ codes: [OTHER_CODE] }) });

    expect(() =>
      createAttributionProofSet([attributed, wrongCode], {
        title: "Conflict",
        builderCode: BUILDER_CODE,
      }),
    ).toThrow(/conflicting proof evidence/i);
  });

  it("recalculates corrupted replay counters and transaction statuses", () => {
    const corrupted = structuredClone(report(HASH_A));
    corrupted.ok = false;
    corrupted.attributed = 0;
    corrupted.missing = 1;
    corrupted.coverage = 0;
    corrupted.transactions[0].status = "missing-attribution";
    corrupted.transactions[0].codes = [];

    const proofSet = createAttributionProofSet([corrupted], {
      title: "Recalculated",
      builderCode: BUILDER_CODE,
    });

    expect(proofSet.reports[0]).toMatchObject({
      ok: true,
      attributed: 1,
      missing: 0,
      coverage: 100,
    });
    expect(proofSet.reports[0].transactions[0]).toMatchObject({
      status: "attributed",
      codes: [BUILDER_CODE],
    });
  });

  it("rejects a manifest whose derived fields were edited", () => {
    const proofSet = createAttributionProofSet([report(HASH_A)], {
      title: "Canonical",
      builderCode: BUILDER_CODE,
    });
    const corrupted = structuredClone(proofSet);
    corrupted.summary.coverage = 12;

    expect(() => parseAttributionProofSet(corrupted)).toThrow(/derived fields/i);
  });

  it("rejects unsupported fields and schema versions", () => {
    const proofSet = createAttributionProofSet([report(HASH_A)], {
      title: "Canonical",
      builderCode: BUILDER_CODE,
    });

    expect(() => parseAttributionProofSet({ ...proofSet, privateNote: "do not publish" })).toThrow(
      /unsupported field/i,
    );
    expect(() => parseAttributionProofSet({ ...proofSet, schemaVersion: 2 })).toThrow(
      /schemaVersion/i,
    );

    const malformedTimestamp = structuredClone(report(HASH_A));
    malformedTimestamp.transactions[0].timestamp = "not-a-timestamp";
    expect(() =>
      createAttributionProofSet([malformedTimestamp], {
        title: "Malformed timestamp",
        builderCode: BUILDER_CODE,
      }),
    ).toThrow(/timestamp.*ISO-8601/i);
  });

  it("rejects empty, mismatched, malformed, and oversized inputs", () => {
    expect(() =>
      createAttributionProofSet([], { title: "Empty", builderCode: BUILDER_CODE }),
    ).toThrow(/at least one/i);

    const mismatched = structuredClone(report(HASH_A));
    mismatched.builderCode = OTHER_CODE;
    expect(() =>
      createAttributionProofSet([mismatched], {
        title: "Mismatch",
        builderCode: BUILDER_CODE,
      }),
    ).toThrow(/instead of/i);

    const malformed = structuredClone(report(HASH_A));
    malformed.transactions[0].hash = "0x12" as Hex;
    expect(() =>
      createAttributionProofSet([malformed], {
        title: "Malformed",
        builderCode: BUILDER_CODE,
      }),
    ).toThrow(/32 bytes/i);

    const tooMany = Array.from({ length: MAX_ATTRIBUTION_PROOF_SET_REPORTS + 1 }, () =>
      report(HASH_A),
    );
    expect(() =>
      createAttributionProofSet(tooMany, {
        title: "Oversized",
        builderCode: BUILDER_CODE,
      }),
    ).toThrow(/at most 100/i);
  });

  it("rejects more than 10,000 unique transactions", () => {
    const calldata = createDataSuffix({ codes: [BUILDER_CODE] });
    const oversized = createAttributionReplayReport(
      Array.from({ length: 10_001 }, (_, index) => ({
        hash: `0x${index.toString(16).padStart(64, "0")}` as Hex,
        calldata,
        verified: true,
      })),
      { builderCode: BUILDER_CODE },
    );

    expect(() =>
      createAttributionProofSet([oversized], {
        title: "Oversized transactions",
        builderCode: BUILDER_CODE,
      }),
    ).toThrow(/at most 10000 unique transactions/i);
  });

  it("serializes deterministically regardless of report order", () => {
    const earlier = report(HASH_B, { generatedAt: "2026-09-01T00:00:00Z" });
    const later = report(HASH_A, { generatedAt: "2026-09-02T00:00:00Z" });
    const options = { title: "Stable", builderCode: BUILDER_CODE };

    expect(JSON.stringify(createAttributionProofSet([later, earlier], options))).toBe(
      JSON.stringify(createAttributionProofSet([earlier, later], options)),
    );
  });
});
