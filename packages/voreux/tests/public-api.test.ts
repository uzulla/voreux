import { describe, expect, it } from "vitest";
import {
  defineScenarioSuite,
  findPreviewIndex,
  readElementVisualState,
} from "../src/index.js";

describe("voreux public api", () => {
  it("exports defineScenarioSuite", () => {
    expect(typeof defineScenarioSuite).toBe("function");
  });

  it("exports findPreviewIndex", () => {
    expect(typeof findPreviewIndex).toBe("function");
  });

  it("exports readElementVisualState", () => {
    expect(typeof readElementVisualState).toBe("function");
  });
});
