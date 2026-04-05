import { fileURLToPath } from "node:url";
import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";
import {
  getTooltipState,
  hoverTooltipTrigger,
  movePointerAway,
  screenshotTooltipRegion,
  waitForTooltipHidden,
  waitForTooltipVisible,
} from "./tooltip-helpers.js";
import { compareWithBaseline, saveBaseline } from "./visual-compare.js";

const ORIGIN_URL = "https://ui.shadcn.com/docs/components/radix/tooltip";
const BASELINES_DIR = fileURLToPath(new URL("../baselines/", import.meta.url));

defineScenarioSuite({
  suiteName: "shadcn-tooltip E2E",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "hover 待ち tooltip が表示され、VRT で見た目の変化を確認する",
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="tooltip-trigger"]', {
          timeout: 30_000,
        });
        // NOTE:
        // fixed wait は一般には推奨しない。通常は selector / state change /
        // stable DOM signal を待つべきで、この書き方を sample の default として
        // 真似してほしいわけではない。
        //
        // ここでは公開 docs サイト相手で hydration 完了の安定した signal が弱く、
        // 実観察では deterministic wait だけだと再現性が落ちやすかったため、
        // 例外的に fixed wait を残している。
        await ctx.page.waitForTimeout(3000);

        const before = await getTooltipState(ctx.page);
        expect(before.visible).toBe(false);
        const hiddenShot = await screenshotTooltipRegion(
          ctx.page,
          "01-tooltip-hidden",
        );

        await hoverTooltipTrigger(ctx.page);
        await waitForTooltipVisible(ctx.page);

        const visible = await getTooltipState(ctx.page);
        expect(visible.visible).toBe(true);
        expect(visible.text.length).toBeGreaterThan(0);

        // 録画を人間が見た時にも tooltip 表示が分かるよう、
        // visible 状態を少し維持してから screenshot を撮る。
        await ctx.page.waitForTimeout(1200);
        const visibleShot = await screenshotTooltipRegion(
          ctx.page,
          "02-tooltip-visible",
        );

        saveBaseline(hiddenShot, "tooltip-hidden", BASELINES_DIR);
        const diff = compareWithBaseline(visibleShot, "tooltip-hidden", {
          baselinesDir: BASELINES_DIR,
          diffPath: `${BASELINES_DIR}/tooltip-hidden-diff.png`,
        });
        expect(diff.skipped).toBe(false);
        expect(diff.mismatchRatio).toBeGreaterThan(0.005);
      },
    },
    {
      name: "pointer が離れると tooltip が消える",
      run: async (ctx: TestContext) => {
        await hoverTooltipTrigger(ctx.page);
        await waitForTooltipVisible(ctx.page);

        await movePointerAway(ctx.page);
        await waitForTooltipHidden(ctx.page);
        await ctx.page.waitForTimeout(600);

        const hidden = await getTooltipState(ctx.page);
        expect(hidden.visible).toBe(false);
      },
    },
  ],
});
