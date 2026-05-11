import { describe, expect, it } from "vitest";
import { defineScenarioSuite, findPreviewIndex } from "../src/index.js";

describe("voreux public api", () => {
  it("exports defineScenarioSuite", () => {
    expect(typeof defineScenarioSuite).toBe("function");
  });

  it("exports findPreviewIndex", () => {
    expect(typeof findPreviewIndex).toBe("function");
  });
});
