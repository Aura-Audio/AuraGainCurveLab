import { describe, expect, it } from "vitest";
import { deserializeParams, serializeParams } from "../../js/utils/url.js";
import { DEFAULT_PARAMS } from "../../js/config/presets.js";

describe("URL parameter utilities", () => {
  it("serializes and deserializes params", () => {
    const encoded = serializeParams(DEFAULT_PARAMS);
    const decoded = deserializeParams(encoded);

    expect(decoded).toEqual(DEFAULT_PARAMS);
  });

  it("returns null for invalid input", () => {
    expect(deserializeParams("not-valid")).toBeNull();
  });
});
