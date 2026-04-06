import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";
import {
  clickDialogAction,
  clickShowDialog,
  dismissDialogWithEscape,
  getAlertDialogState,
  getOverlayVisualState,
  screenshotAlertDialogRegion,
  waitForDialogHidden,
  waitForDialogVisible,
} from "./alert-dialog-helpers.js";
import {
  compareWithBaseline,
  saveBaseline,
} from "./alert-dialog-visual-compare.js";

const ORIGIN_URL = "https://ui.shadcn.com/docs/components/radix/alert-dialog";
const BASELINES_DIR = process.env.E2E_BASELINES_DIR
  ? path.resolve(process.cwd(), process.env.E2E_BASELINES_DIR)
  : fileURLToPath(new URL("../baselines/", import.meta.url));

defineScenarioSuite({
  suiteName: "shadcn-component E2E (alert-dialog)",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "クリックで alert dialog が開き、背景がボケる",
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="preview"]', {
          timeout: 30_000,
        });
        await ctx.page.waitForTimeout(3000);

        const hiddenShot = await screenshotAlertDialogRegion(
          ctx.page,
          "alert-dialog-hidden",
        );

        await clickShowDialog(ctx.page);
        await waitForDialogVisible(ctx.page);

        const dialog = await getAlertDialogState(ctx.page);
        expect(dialog.visible).toBe(true);
        expect(dialog.title.length).toBeGreaterThan(0);

        const overlay = await getOverlayVisualState(ctx.page);
        expect(overlay.visible).toBe(true);
        expect(overlay.backdropFilter).not.toBe("none");
        expect(overlay.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

        const visibleShot = await screenshotAlertDialogRegion(
          ctx.page,
          "alert-dialog-visible",
        );

        saveBaseline(hiddenShot, "alert-dialog-hidden", BASELINES_DIR);
        const diff = compareWithBaseline(visibleShot, "alert-dialog-hidden", {
          baselinesDir: BASELINES_DIR,
          diffPath: `${BASELINES_DIR}/alert-dialog-hidden-diff.png`,
        });
        expect(diff.skipped).toBe(false);
        expect(diff.mismatchRatio).toBeGreaterThan(0.01);
      },
    },
    {
      name: "Cancel で dialog が閉じる",
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="preview"]', {
          timeout: 30_000,
        });
        await ctx.page.waitForTimeout(3000);

        await clickShowDialog(ctx.page);
        await waitForDialogVisible(ctx.page);

        await clickDialogAction(ctx.page, "Cancel");
        await waitForDialogHidden(ctx.page);

        const dialog = await getAlertDialogState(ctx.page);
        expect(dialog.visible).toBe(false);
      },
    },
    {
      name: "Continue でも dialog が閉じる",
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="preview"]', {
          timeout: 30_000,
        });
        await ctx.page.waitForTimeout(3000);

        await clickShowDialog(ctx.page);
        await waitForDialogVisible(ctx.page);

        await clickDialogAction(ctx.page, "Continue");
        await waitForDialogHidden(ctx.page);

        const dialog = await getAlertDialogState(ctx.page);
        expect(dialog.visible).toBe(false);
      },
    },
    {
      name: "Escape でも dialog が閉じられる",
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="preview"]', {
          timeout: 30_000,
        });
        await ctx.page.waitForTimeout(3000);

        await clickShowDialog(ctx.page);
        await waitForDialogVisible(ctx.page);

        await dismissDialogWithEscape(ctx.page);
        await waitForDialogHidden(ctx.page);

        const dialog = await getAlertDialogState(ctx.page);
        expect(dialog.visible).toBe(false);
      },
    },
  ],
});
