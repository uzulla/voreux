import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";

const ORIGIN_URL = "https://ui.shadcn.com/docs/components/base/carousel";
const SHOTS_DIR = new URL("../screenshots/", import.meta.url).pathname;

async function pollUntil(
  page: any,
  fn: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 100,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await page.waitForTimeout(intervalMs);
  }
  return false;
}

async function getPageText(page: any): Promise<string> {
  return page.evaluate(() => document.body.innerText ?? "");
}

/**
 * このページは carousel サンプルが複数ありノイジーなので、
 * ページ最上部の basic carousel だけを対象に固定する。
 */
async function getTargetCarousel(_page: any): Promise<number> {
  return 0;
}

async function getTargetCarouselBox(
  page: any,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const index = await getTargetCarousel(page);
  const box = await page.evaluate((i: number) => {
    const el = document.querySelectorAll('[data-slot="carousel"]')[i] as
      | HTMLElement
      | undefined;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, index);
  if (!box) throw new Error("target carousel not found");
  return box;
}

/**
 * 現在 viewport 中央に最も近い item を「現在表示中のセル」とみなす。
 *
 * 実 DOM 観察の結果、transform そのものを見るよりも、item の矩形位置から
 * 中央に最も近いものを選ぶ方が教材としても分かりやすく、安定していた。
 */
async function getCenteredItem(
  page: any,
): Promise<{ text: string; left: number; right: number }> {
  const index = await getTargetCarousel(page);
  const result = await page.evaluate((i: number) => {
    const carousel = document.querySelectorAll('[data-slot="carousel"]')[i] as
      | HTMLElement
      | undefined;
    const content = carousel?.querySelector(
      '[data-slot="carousel-content"]',
    ) as HTMLElement | null;
    if (!carousel || !content) return null;
    const contentRect = content.getBoundingClientRect();
    const centerX = contentRect.left + contentRect.width / 2;
    const items = Array.from(
      carousel.querySelectorAll('[data-slot="carousel-item"]'),
    ).map((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const itemCenter = r.left + r.width / 2;
      return {
        text: (el.textContent || "").trim(),
        left: r.left,
        right: r.right,
        dist: Math.abs(itemCenter - centerX),
      };
    });
    items.sort((a, b) => a.dist - b.dist);
    return items[0] ?? null;
  }, index);
  if (!result) throw new Error("centered item not found");
  return result;
}

async function clickCarouselButton(
  page: any,
  slot: "carousel-next" | "carousel-previous",
) {
  const index = await getTargetCarousel(page);
  const box = await page.evaluate(
    (args: { i: number; slot: string }) => {
      const carousel = document.querySelectorAll('[data-slot="carousel"]')[
        args.i
      ] as HTMLElement | undefined;
      const button = carousel?.querySelector(
        `[data-slot="${args.slot}"]`,
      ) as HTMLElement | null;
      if (!button) return null;
      const r = button.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },
    { i: index, slot },
  );
  if (!box) throw new Error(`button not found: ${slot}`);
  await page.click(
    Math.round(box.x + box.width / 2),
    Math.round(box.y + box.height / 2),
  );
}

/**
 * アニメーション終了待ち:
 * ボタンクリック後、現在中央の item が期待値へ変わるまで待つ。
 *
 * fixed sleep だけで済ませず、「次のセルへ進んだ」という状態変化を観測してから
 * 次の操作へ進むことが、この sample の主題。
 */
async function waitForCenteredItem(
  page: any,
  expectedText: string,
): Promise<void> {
  const ok = await pollUntil(
    page,
    async () => {
      const item = await getCenteredItem(page);
      return item.text === expectedText;
    },
    5000,
    100,
  );
  if (!ok) throw new Error(`centered item did not become ${expectedText}`);
}

async function advanceUntilCenteredItem(
  page: any,
  expectedText: string,
  maxSteps = 10,
): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const current = await getCenteredItem(page);
    if (current.text === expectedText) return;
    await clickCarouselButton(page, "carousel-next");
    await page.waitForTimeout(300);
  }
  throw new Error(`failed to advance carousel until ${expectedText}`);
}

async function getButtonVisualState(
  page: any,
  slot: "carousel-next" | "carousel-previous",
): Promise<{ disabled: boolean; opacity: string; pointerEvents: string }> {
  const index = await getTargetCarousel(page);
  const state = await page.evaluate(
    (args: { i: number; slot: string }) => {
      const carousel = document.querySelectorAll('[data-slot="carousel"]')[
        args.i
      ] as HTMLElement | undefined;
      const button = carousel?.querySelector(
        `[data-slot="${args.slot}"]`,
      ) as HTMLButtonElement | null;
      if (!button) return null;
      const cs = getComputedStyle(button);
      return {
        disabled: button.hasAttribute("disabled"),
        opacity: cs.opacity,
        pointerEvents: cs.pointerEvents,
      };
    },
    { i: index, slot },
  );
  if (!state) throw new Error(`button state not found: ${slot}`);
  return state;
}

/**
 * carousel 領域だけを clip screenshot する。
 *
 * この sample では「人間が見て変化を知覚できるか」を重視したいので、
 * ページ全体ではなく対象 carousel の部分画像だけを撮る。
 */
async function screenshotCarouselClip(
  page: any,
  name: string,
): Promise<string> {
  const box = await getTargetCarouselBox(page);
  const filePath = `${SHOTS_DIR}${name}.png`;
  await page.screenshot({
    path: filePath,
    clip: {
      x: Math.max(0, Math.round(box.x - 24)),
      y: Math.max(0, Math.round(box.y - 24)),
      width: Math.round(box.width + 48),
      height: Math.round(box.height + 48),
    },
  });
  return filePath;
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
        expect(initialPrev.opacity).toBe("0.5");
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
        expect(lastNext.opacity).toBe("0.5");
        expect(lastNext.pointerEvents).toBe("none");
      },
    },
  ],
});
