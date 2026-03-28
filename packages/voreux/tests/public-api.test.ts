import { describe, expect, it } from "vitest";
import { defineScenarioSuite } from "../src/index.js";

describe("voreux public api", () => {
  it("exports defineScenarioSuite", () => {
    expect(typeof defineScenarioSuite).toBe("function");
  });
});
