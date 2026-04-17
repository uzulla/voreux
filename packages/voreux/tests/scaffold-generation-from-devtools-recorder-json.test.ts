import { describe, expect, test } from "vitest";
import {
  generateDraftScenarioFromRecorder,
  parseDevToolsRecorderJson,
} from "../src/scaffold-generation-from-devtools-recorder-json.js";

describe("scenario scaffold generation from DevTools Recorder JSON", () => {
  test("generates a Voreux draft scenario from basic recorder json", () => {
    const input = JSON.stringify({
      title: "Login happy path",
      steps: [
        {
          type: "setViewport",
          width: 1280,
          height: 720,
          deviceScaleFactor: 1,
          isMobile: false,
          hasTouch: false,
          isLandscape: true,
        },
        {
          type: "navigate",
          url: "https://example.com/login",
        },
        {
          type: "click",
          selectors: [["aria/Log in"], ["button.login"]],
        },
        {
          type: "change",
          selectors: [["#email"]],
          value: "hello@example.com",
        },
      ],
    });

    const parsed = parseDevToolsRecorderJson(input);
    const generated = generateDraftScenarioFromRecorder(parsed);

    expect(generated).toContain(
      'import { defineScenarioSuite } from "@uzulla/voreux";',
    );
    expect(generated).toContain(
      'const ORIGIN_URL = "https://example.com/login";',
    );
    expect(generated).toContain('suiteName: "Login happy path"');
    expect(generated).toContain(
      'await ctx.page.goto("https://example.com/login")',
    );
    expect(generated).toContain(
      'await ctx.page.waitForSelector("button.login")',
    );
    expect(generated).toContain("element.click();");
    expect(generated).toContain(
      'selector: "#email", nextValue: "hello@example.com"',
    );
    expect(generated).toContain(
      "// TODO: add assertions for the expected happy-path landing state.",
    );
  });

  test("fails on unsupported step types", () => {
    const input = JSON.stringify({
      steps: [
        { type: "navigate", url: "https://example.com/" },
        { type: "doubleClick", selectors: [["#x"]] },
      ],
    });

    const parsed = parseDevToolsRecorderJson(input);
    expect(() => generateDraftScenarioFromRecorder(parsed)).toThrow(
      "Unsupported DevTools Recorder step type: doubleClick",
    );
  });

  test("fails when navigate step is missing", () => {
    const input = JSON.stringify({
      steps: [{ type: "click", selectors: [["#x"]] }],
    });

    const parsed = parseDevToolsRecorderJson(input);
    expect(() => generateDraftScenarioFromRecorder(parsed)).toThrow(
      "Recorder JSON must contain at least one navigate step",
    );
  });
});
