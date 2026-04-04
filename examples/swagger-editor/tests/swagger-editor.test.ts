import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";

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

async function focusMonacoEditor(page: any) {
  await page.waitForSelector(".monaco-editor", { timeout: 20000 });
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

async function placeCaretNearTitleLine(page: any) {
  // 現物確認で比較的安定して title 行付近へ入力が入った座標
  const box = await page.evaluate(() => {
    const el = document.querySelector(".monaco-editor") as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y };
  });
  if (!box) throw new Error("Monaco editor not found");
  await page.click(Math.round(box.x + 180), Math.round(box.y + 55));
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
        await placeCaretNearTitleLine(ctx.page);
        await ctx.screenshot("02a-before-monaco-edit");

        await ctx.page.type(APPENDED_TEXT, { delay: 50 });
        await ctx.page.waitForTimeout(1500);
        await ctx.screenshot("02b-after-monaco-edit");

        const probe = await ctx.page.evaluate(() => ({
          bodyHasVoreux: (document.body.innerText || "").includes("Voreux"),
          viewText: (document.querySelector(".view-lines")?.textContent || "").slice(0, 500),
        }));

        expect(probe.viewText).toContain("Streetlights");
        expect(probe.bodyHasVoreux).toBe(true);
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
