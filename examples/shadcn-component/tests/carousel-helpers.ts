import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createArtifactPath,
  ensureDir,
  getClosestToContainerCenter,
  readElementVisualState,
  screenshotClipAroundBox,
  waitUntil,
} from "@uzulla/voreux";

const SHOTS_DIR = process.env.E2E_SCREENSHOTS_DIR
  ? path.resolve(process.cwd(), process.env.E2E_SCREENSHOTS_DIR)
  : fileURLToPath(new URL("../screenshots/", import.meta.url));

ensureDir(SHOTS_DIR);

/**
 * このページは carousel サンプルが複数ありノイジーなので、
 * ページ最上部の basic carousel だけを対象に固定する。
 */
export async function getTargetCarousel(_page: any): Promise<number> {
  return 0;
}

export async function getTargetCarouselBox(
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
export async function getCenteredItem(
  page: any,
): Promise<{ text: string; left: number; right: number }> {
  const index = await getTargetCarousel(page);
  const result = await getClosestToContainerCenter(page, {
    containerSelector: `[data-slot="carousel-content"]:nth-of-type(${index + 1})`,
    itemSelector: '[data-slot="carousel-item"]',
  });
  if (!result) throw new Error("centered item not found");
  return result;
}

export async function clickCarouselButton(
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
 */
export async function waitForCenteredItem(
  page: any,
  expectedText: string,
): Promise<void> {
  await waitUntil(
    page,
    async () => {
      const item = await getCenteredItem(page);
      return item.text === expectedText;
    },
    {
      timeoutMs: 5000,
      intervalMs: 100,
      message: `centered item did not become ${expectedText}`,
    },
  );
}

/**
 * 期待セルに着くまで next を進める。
 *
 * fixed sleep の回数決め打ちはフレーキーなので、
 * 各クリックごとに「中央セルが変わったか」を観測する。
 */
export async function advanceUntilCenteredItem(
  page: any,
  expectedText: string,
  maxSteps = 10,
): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const current = await getCenteredItem(page);
    if (current.text === expectedText) return;

    const nextState = await getButtonVisualState(page, "carousel-next");
    if (nextState.disabled) break;

    await clickCarouselButton(page, "carousel-next");
    await waitUntil(
      page,
      async () => (await getCenteredItem(page)).text !== current.text,
      {
        timeoutMs: 3000,
        intervalMs: 100,
        message: "carousel did not progress after next click",
      },
    );
  }
  throw new Error(`failed to advance carousel until ${expectedText}`);
}

export async function getButtonVisualState(
  page: any,
  slot: "carousel-next" | "carousel-previous",
): Promise<{ disabled: boolean; opacity: string; pointerEvents: string }> {
  const index = await getTargetCarousel(page);
  const state = await readElementVisualState(page, {
    rootSelector: '[data-slot="carousel"]',
    rootIndex: index,
    selector: `[data-slot="${slot}"]`,
    css: ["opacity", "pointer-events"],
    attributes: ["disabled"],
  });
  if (!state.found) throw new Error(`button state not found: ${slot}`);
  return {
    disabled: state.attributes.disabled !== null,
    opacity: state.css.opacity ?? "",
    pointerEvents: state.css["pointer-events"] ?? "",
  };
}

/**
 * carousel 領域だけを clip screenshot する。
 *
 * この sample では「人間が見て変化を知覚できるか」を重視したいので、
 * ページ全体ではなく対象 carousel の部分画像だけを撮る。
 */
export async function screenshotCarouselClip(
  page: any,
  name: string,
): Promise<string> {
  const box = await getTargetCarouselBox(page);
  const filePath = createArtifactPath(SHOTS_DIR, name);
  return screenshotClipAroundBox(page, filePath, box, { padding: 24 });
}
