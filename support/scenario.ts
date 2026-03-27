import { describe, test, beforeAll, afterAll, afterEach } from "vitest";
import { initStagehand, closeStagehand } from "./stagehand.js";
import type { TestContext } from "./context.js";
import type { Recorder } from "./recording.js";
import { withSelfHeal } from "./self-heal.js";

export interface ScenarioStep {
  name: string;
  run: (ctx: TestContext) => Promise<void>;
  /** true の場合のみ self-heal を適用 */
  selfHeal?: boolean;
}

export interface ScenarioSuiteOptions {
  suiteName: string;
  originUrl: string;
  steps: ScenarioStep[];
}

/**
 * E2E シナリオ実行の共通ライフサイクルを提供する。
 * 利用者は steps を並べるだけでシナリオを定義できる。
 */
export function defineScenarioSuite({
  suiteName,
  originUrl,
  steps,
}: ScenarioSuiteOptions): void {
  describe(suiteName, () => {
    let _ctx: TestContext | undefined;
    let _recorder: Recorder | undefined;

    const getCtx = (): TestContext => {
      if (!_ctx) throw new Error("ctx not initialized");
      return _ctx;
    };

    beforeAll(async () => {
      ({ ctx: _ctx, recorder: _recorder } = await initStagehand(originUrl));
    });

    afterAll(async () => {
      if (_ctx && _recorder) {
        await closeStagehand(_ctx, _recorder).catch((e) =>
          console.error("closeStagehand error:", e)
        );
      }
    });

    afterEach(async (testCtx) => {
      if (_ctx && testCtx.task.result?.state === "fail") {
        const name = `error-${testCtx.task.name.replace(/\s+/g, "-")}`;
        try {
          await _ctx.screenshot(name);
        } catch (err) {
          console.warn(`Failed to capture error screenshot "${name}":`, err);
        }
      }
    });

    for (const step of steps) {
      test(step.name, async () => {
        const ctx = getCtx();
        if (step.selfHeal === false) {
          await step.run(ctx);
          return;
        }
        await withSelfHeal(ctx, async () => {
          await step.run(ctx);
        });
      });
    }
  });
}
