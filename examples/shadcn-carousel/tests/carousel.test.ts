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

const ORIGIN_URL = "https://ui.shadcn.com/docs/components/base/carousel";

async function getPageText(page: any): Promise<string> {
  return page.evaluate(() => document.body.innerText ?? "");
}

defineScenarioSuite({
  suiteName: "shadcn-carousel E2E",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "ページを開いて対象 carousel を特定する",
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="carousel"]', {
          timeout: 30_000,
        });
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
        await screenshotCarouselClip(ctx.page, "02-initial");
        await ctx.screenshot("02-page-initial");

        await clickCarouselButton(ctx.page, "carousel-next");
        await waitForCenteredItem(ctx.page, "2");
        const secondShot = await screenshotCarouselClip(
          ctx.page,
          "03-after-next-to-2",
        );
        await ctx.screenshot("03-page-after-next-to-2");

        // 部分 screenshot を残しておくことで、将来的に carousel 領域だけの
        // 軽量な VRT を追加しやすくしている。
        //
        // 今回はまず centered item の変化を主 assertion にしているが、
        // "どのセルが見えているか" を画面上で確認したい時の材料としても使える。
        expect(secondShot).toContain("03-after-next-to-2");

        await clickCarouselButton(ctx.page, "carousel-next");
        await waitForCenteredItem(ctx.page, "3");
        const thirdShot = await screenshotCarouselClip(
          ctx.page,
          "04-after-next-to-3",
        );
        await ctx.screenshot("04-page-after-next-to-3");
        expect(thirdShot).toContain("04-after-next-to-3");
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
        await ctx.screenshot("05-at-last-slide");

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
