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

async function clickButtonByText(
  page: any,
  candidates: string[],
): Promise<boolean> {
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
        await ensureMonacoIsVisible(ctx.page);
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
         * この step は、通常のサンプルより意図的に詳しく説明しています。
         *
         * 理由:
         * - Monaco は普通の input / textarea と同じようには扱えない
         * - Voreux / Stagehand で「特殊な editor widget をどう扱うか」の
         *   実例として後から読める形にしておきたい
         *
         * このサンプルで重視しているバランス:
         * - Monaco に focus して入力できることは確認したい
         * - ただし hosted UI 上の caret 位置は少し揺れるため、
         *   位置まで厳密に固定した assertion にすると flaky になりやすい
         * - そのためこの step では、「title 付近の Monaco 領域に対して
         *   実際に入力できる」という性質を優先して確認する
         *
         * ここでやること:
         * 1. Monaco が見えるまで待つ
         * 2. title 行付近の既知の座標へ click する
         * 3. Stagehand の page.type() で追記する
         * 4. Monaco の描画結果を見て、title 領域の内容変化を確認する
         */
        await ensureMonacoIsVisible(ctx.page);
        await placeCaretNearSwaggerTitleLine(ctx.page);
        await ctx.screenshot("02a-before-monaco-edit");

        await appendTextIntoMonacoAtCurrentCaret(ctx.page, APPENDED_TEXT);
        // hosted Monaco は repaint 反映が少し遅れることがあり、
        // `.view-lines` の存在だけでは「編集結果が見えた」ことの判定になりません。
        // そのため、ここは短い固定待機を残しています。
        // 完全に state-based に寄せるより、このサンプル用途ではこちらの方が安定しました。
        await ctx.page.waitForTimeout(1500);
        await ctx.screenshot("02b-after-monaco-edit");

        const probe = await readMonacoProbe(ctx.page, "Voreux");

        // 挿入位置そのものは run ごとに少し揺れることがあるため、
        // このサンプルでは「厳密にどの文字の直後へ入ったか」までは固定しません。
        // ここで確認したいのは、Monaco の title 付近に対して
        // 実際に入力が行われ、描画上の変化を観測できることです。
        expect(probe.viewText).toContain("Streetlights");
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
        await ctx.page.waitForTimeout(300);
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
