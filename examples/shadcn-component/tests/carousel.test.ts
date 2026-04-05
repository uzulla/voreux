import { fileURLToPath } from "node:url";
import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";
import {
  advanceUntilCenteredItem,
  clickCarouselButton,
  getButtonVisualState,
  getCenteredItem,
  getTargetCarouselBox,
  screenshotCarouselClip,
  waitForCenteredItem,
} from "./carousel-helpers.js";
import { compareWithBaseline, saveBaseline } from "./visual-compare.js";

const ORIGIN_URL = "https://ui.shadcn.com/docs/components/base/carousel";
const BASELINES_DIR = fileURLToPath(new URL("../baselines/", import.meta.url));

async function getPageText(page: any): Promise<string> {
  return page.evaluate(() => document.body.innerText ?? "");
}

defineScenarioSuite({
  suiteName: "shadcn-component E2E (carousel)",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "ページを開いて対象 carousel を特定する",
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="carousel"]', {
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
        await ctx.screenshot("01-carousel-page-opened");

        const pageText = await getPageText(ctx.page);
        expect(pageText).toContain("Carousel");
        expect(pageText).toContain("Previous slide");
        expect(pageText).toContain("Next slide");

        const box = await getTargetCarouselBox(ctx.page);
        expect(box.width).toBeGreaterThan(0);
      },
    },
    {
      name: "カルーセルを動かし、アニメーション終了後にさらに次へ進める",
      run: async (ctx: TestContext) => {
        const first = await getCenteredItem(ctx.page);
        expect(first.text).toBe("1");
        const initialShot = await screenshotCarouselClip(
          ctx.page,
          "02-initial",
        );

        await clickCarouselButton(ctx.page, "carousel-next");
        await waitForCenteredItem(ctx.page, "2");
        const secondShot = await screenshotCarouselClip(
          ctx.page,
          "03-after-next-to-2",
        );

        // 実 VRT 例:
        // 初期状態の clip screenshot を baseline として保存し、
        // 1 回進んだ後の画像との差分率が十分にあることを確認する。
        //
        // これにより「DOM 上で current item が変わった」だけでなく、
        // 人間が見て分かるレベルで見た目が変化していることを検証できる。
        saveBaseline(initialShot, "carousel-initial", BASELINES_DIR);
        const diff = compareWithBaseline(secondShot, "carousel-initial", {
          baselinesDir: BASELINES_DIR,
          diffPath: `${BASELINES_DIR}/carousel-initial-diff.png`,
        });
        expect(diff.skipped).toBe(false);
        // carousel は一度に大きく全体が変わるわけではなく、
        // 部分的に横移動するだけなので差分率は小さめになる。
        // 実観察では 0.2% 前後でも人間には十分見える変化だったため、
        // ここでは 0.1% 超を閾値にする。
        expect(diff.mismatchRatio).toBeGreaterThan(0.001);

        await clickCarouselButton(ctx.page, "carousel-next");
        await waitForCenteredItem(ctx.page, "3");
        const thirdShot = await screenshotCarouselClip(
          ctx.page,
          "04-after-next-to-3",
        );
        expect(thirdShot).toContain("04-after-next-to-3");
      },
    },
    {
      name: "短時間に連打してもカルーセルが壊れず進める",
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="carousel"]', {
          timeout: 30_000,
        });
        // NOTE: fixed wait は例外対応。通常は selector / state change /
        // stable DOM signal を待つべきで、sample の default として真似してほしい書き方ではない。
        // このページでは hydration 完了の安定 signal が弱く、再現性を優先して残している。
        await ctx.page.waitForTimeout(3000);

        const before = await getCenteredItem(ctx.page);
        expect(before.text).toBe("1");

        await clickCarouselButton(ctx.page, "carousel-next");
        await clickCarouselButton(ctx.page, "carousel-next");
        await clickCarouselButton(ctx.page, "carousel-next");

        // 連打後も carousel が壊れず、少なくとも後続セルへ進めていることを確認する。
        // ここでは「厳密に何枚進むか」より、「固まらない・見失わない・進行できる」ことを重視する。
        const okTexts = ["2", "3", "4"];
        const settled = await (async () => {
          for (let i = 0; i < 30; i++) {
            const current = await getCenteredItem(ctx.page);
            if (okTexts.includes(current.text)) return current.text;
            await ctx.page.waitForTimeout(100);
          }
          return null;
        })();

        expect(settled).not.toBeNull();
      },
    },
    {
      name: "端ではボタンの知覚可能な状態が変わることを確認する",
      run: async (ctx: TestContext) => {
        // 前 step で carousel を進めているため、この step は初期状態からやり直す。
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="carousel"]', {
          timeout: 30_000,
        });
        // NOTE: fixed wait は例外対応。通常は selector / state change /
        // stable DOM signal を待つべきで、sample の default として真似してほしい書き方ではない。
        // このページでは hydration 完了の安定 signal が弱く、再現性を優先して残している。
        await ctx.page.waitForTimeout(3000);

        const initialPrev = await getButtonVisualState(
          ctx.page,
          "carousel-previous",
        );
        const initialNext = await getButtonVisualState(
          ctx.page,
          "carousel-next",
        );

        // 初期状態では前へ進めないので、Previous は disabled / 半透明 / pointer-events none。
        // これは DOM 属性だけでなく、人間が見て "押せない" と知覚できる状態変化として扱う。
        expect(initialPrev.disabled).toBe(true);
        expect(Number(initialPrev.opacity)).toBeLessThan(
          Number(initialNext.opacity),
        );
        expect(initialPrev.pointerEvents).toBe("none");
        expect(initialNext.disabled).toBe(false);

        await advanceUntilCenteredItem(ctx.page, "5");

        const lastPrev = await getButtonVisualState(
          ctx.page,
          "carousel-previous",
        );
        const lastNext = await getButtonVisualState(ctx.page, "carousel-next");

        // 末尾では Next が知覚可能に無効化され、Previous は有効なまま。
        // ここも "DOM が正しい" ではなく、見た目と操作感が変わることを重視する。
        expect(lastPrev.disabled).toBe(false);
        expect(lastNext.disabled).toBe(true);
        expect(Number(lastNext.opacity)).toBeLessThan(Number(lastPrev.opacity));
        expect(lastNext.pointerEvents).toBe("none");
      },
    },
  ],
});
