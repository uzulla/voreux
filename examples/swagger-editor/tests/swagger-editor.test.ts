import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";
import {
  appendTextIntoMonacoAtCurrentCaret,
  ensureMonacoIsVisible,
  placeCaretNearSwaggerTitleLine,
  readMonacoProbe,
} from "./monaco-helpers.js";

const ORIGIN_URL = "https://editor.swagger.io/";
const APPENDED_TEXT = " Voreux";

async function dismissCookieBanner(page: any) {
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((button) =>
      (button.textContent || "").toLowerCase().includes("allow all cookies"),
    ) as HTMLButtonElement | undefined;
    if (target) {
      target.click();
      return true;
    }
    return false;
  });
  if (clicked) {
    await page.waitForTimeout(500);
  }
}

async function listButtonTexts(page: any): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("button"))
      .map((button) => (button.textContent || "").trim().replace(/\s+/g, " "))
      .filter(Boolean),
  );
}

async function clickButtonByText(page: any, candidates: string[]): Promise<boolean> {
  return page.evaluate((texts: string[]) => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const target = buttons.find((button) => {
      const text = (button.textContent || "").trim().replace(/\s+/g, " ");
      return texts.some((candidate) => text.includes(candidate));
    }) as HTMLButtonElement | undefined;
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, candidates);
}

async function getPageText(page: any) {
  return page.evaluate(() => document.body.innerText || "");
}

defineScenarioSuite({
  suiteName: "swagger-editor E2E",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "Navigate to swagger editor",
      selfHeal: false,
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForLoadState("domcontentloaded");
        await ctx.page.waitForTimeout(6000);
        await dismissCookieBanner(ctx.page);
        await ctx.screenshot("01-editor-opened");

        const text = await getPageText(ctx.page);
        expect(text).toContain("Streetlights Kafka API");
        expect(text).toContain("About");
      },
    },
    {
      name: "Edit Monaco title with keyboard input",
      selfHeal: false,
      run: async (ctx: TestContext) => {
        /**
         * This step is intentionally treated as a special case and documented in
         * more detail than a normal sample step.
         *
         * Why:
         * - Monaco is not a normal input control.
         * - We want this sample to teach future readers how to approach
         *   code-editor-like widgets in Voreux / Stagehand.
         *
         * What we do here:
         * 1. Wait until Monaco is visible.
         * 2. Click a known-good coordinate near the title line.
         * 3. Type additional text using Stagehand's page.type().
         * 4. Assert against both the editor rendering (`.view-lines`) and the
         *    visible page text so the sample stays useful as documentation.
         */
        await ensureMonacoIsVisible(ctx.page);
        await placeCaretNearSwaggerTitleLine(ctx.page);
        await ctx.screenshot("02a-before-monaco-edit");

        await appendTextIntoMonacoAtCurrentCaret(ctx.page, APPENDED_TEXT);
        await ctx.page.waitForTimeout(1500);
        await ctx.screenshot("02b-after-monaco-edit");

        const probe = await readMonacoProbe(ctx.page);

        // The exact insertion point may vary a little, but the editor should
        // still visibly contain the original title text plus our inserted token.
        expect(probe.viewText).toContain("Streetlights");
        expect(probe.bodyHasInsertedText).toBe(true);
      },
    },
    {
      name: "Open a preview accordion with click",
      selfHeal: false,
      run: async (ctx: TestContext) => {
        const buttonTexts = await listButtonTexts(ctx.page);
        expect(buttonTexts.length).toBeGreaterThan(0);

        const clicked = await clickButtonByText(ctx.page, [
          "Parameters",
          "Payload",
          "Headers",
          "Expand all",
        ]);

        expect(clicked).toBe(true);
        await ctx.page.waitForTimeout(1500);
        await ctx.screenshot("03-accordion-opened");

        const text = await getPageText(ctx.page);
        expect(
          text.includes("Operation specific information") ||
            text.includes("Payload") ||
            text.includes("Headers") ||
            text.includes("Parameters"),
        ).toBe(true);
      },
    },
  ],
});
