import { createDataSuffix, type AttributionInput, type Hex } from "@base-attribution-os/core";

export interface AttributionConfig {
  builderCode?: string;
  codes?: string[];
  attribution?: AttributionInput;
}

export type ConfigWithAttribution<TConfig> = TConfig & {
  attribution: AttributionInput;
  dataSuffix: Hex;
};

export function createAttributionConfig<TConfig extends Record<string, unknown>>(
  config: TConfig & AttributionConfig,
): ConfigWithAttribution<TConfig> {
  const attribution = normalizeAttributionConfig(config);

  return {
    ...config,
    attribution,
    dataSuffix: createDataSuffix(attribution),
  };
}

export function normalizeAttributionConfig(config: AttributionConfig): AttributionInput {
  if (config.attribution) {
    return config.attribution;
  }

  if (config.codes) {
    return { codes: config.codes };
  }

  if (config.builderCode) {
    return { codes: [config.builderCode] };
  }

  throw new Error("builderCode, codes, or attribution is required");
}
