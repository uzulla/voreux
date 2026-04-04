import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";

const ORIGIN_URL = "https://editor.swagger.io/";
const APPENDED_TEXT = " Voreux";

async function dismissCookieBanner(page: any) {
  const buttons = await page.locator("button").all();
  for (const button of buttons) {
    const text = ((await button.textContent()) || "").trim().toLowerCase();
    if (text.includes("allow all cookies")) {
      await button.click().catch(() => {});
      await page.waitForTimeout(500);
      return;
    }
  }
}

async function focusMonacoEditor(page: any) {
  await page.waitForSelector(".monaco-editor", { timeout: 20000 });
  await page.click(".monaco-editor", { position: { x: 220, y: 58 } });
}

async function moveCursorToTitleLineEnd(page: any) {
  // 初期コンテンツ先頭付近に title 行がある前提で、Home -> 下2回 -> End と辿る
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
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
        await focusMonacoEditor(ctx.page);
        await moveCursorToTitleLineEnd(ctx.page);
        await ctx.screenshot("02a-before-monaco-edit");

        await ctx.page.keyboard.type(APPENDED_TEXT, { delay: 80 });
        await ctx.page.waitForTimeout(1500);
        await ctx.screenshot("02b-after-monaco-edit");

        const text = await getPageText(ctx.page);
        expect(text).toContain(`Streetlights Kafka API${APPENDED_TEXT}`);
      },
    },
    {
      name: "Open a preview accordion with click",
      selfHeal: false,
      run: async (ctx: TestContext) => {
        await ctx.page.click("button", { position: { x: 20, y: 20 } }).catch(() => {});

        const buttons = await ctx.page.locator("button").all();
        let clicked = false;
        for (const button of buttons) {
          const text = (((await button.textContent()) || "").trim().replace(/\s+/g, " "));
          if (
            text.includes("Parameters") ||
            text.includes("Payload") ||
            text.includes("Headers") ||
            text.includes("Expand all")
          ) {
            await button.click().catch(() => {});
            clicked = true;
            break;
          }
        }

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
