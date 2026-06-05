import { describe, expect, it } from "vitest";
import { createDataSuffix } from "@base-attribution-os/core";
import {
  createAttributionConfig,
  normalizeAttributionConfig,
} from "../src/createAttributionConfig.js";

describe("@base-attribution-os/wagmi", () => {
  it("normalizes a single Builder Code", () => {
    expect(normalizeAttributionConfig({ builderCode: "baseapp" })).toEqual({
      codes: ["baseapp"],
    });
  });

  it("adds attribution metadata and dataSuffix to configs", () => {
    const config = createAttributionConfig({
      builderCode: "baseapp",
      chains: ["base"],
    });

    expect(config.dataSuffix).toBe(createDataSuffix({ codes: ["baseapp"] }));
    expect(config.attribution).toEqual({ codes: ["baseapp"] });
  });
});
