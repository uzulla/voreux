import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearPointerHover,
  createArtifactPath,
  ensureDir,
  getCenterPoint,
  screenshotClipAroundBox,
  waitUntil,
} from "@uzulla/voreux";

// screenshot 出力先は env で差し替えられるようにしつつ、
// sample 単体でそのまま読んでも分かるよう既定値もローカルに持つ。
const SHOTS_DIR = process.env.E2E_SCREENSHOTS_DIR
  ? path.resolve(process.cwd(), process.env.E2E_SCREENSHOTS_DIR)
  : fileURLToPath(new URL("../screenshots/", import.meta.url));

// sample は「そのまま動かして読める教材」でありたいので、
// 出力先ディレクトリの事前作成も helper 側で面倒を見る。
ensureDir(SHOTS_DIR);

/**
 * docs ページには tooltip サンプルが複数あるため、最上部 preview 内の
 * `Hover` ボタンを対象に固定する。
 */
export async function getTooltipTriggerBox(
  page: any,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.evaluate(() => {
    const preview = document.querySelector(
      '[data-slot="preview"]',
    ) as HTMLElement | null;
    const trigger = Array.from(preview?.querySelectorAll("button") ?? []).find(
      (el) => (el.textContent || "").trim() === "Hover",
    ) as HTMLElement | undefined;
    if (!trigger) return null;
    const r = trigger.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  if (!box) throw new Error("tooltip trigger not found");
  return box;
}

/**
 * tooltip trigger に hover する。
 *
 * Stagehand の座標 hover を基本にしつつ、hosted docs 上で hover 起点の UI が
 * 取りこぼされないように page.evaluate で pointer / mouse 系 event も補強する。
 * ここは「通常の button click sample」と違って、hover 起点コンポーネント特有の
 * 実装上のクセを集約している。
 */
export async function hoverTooltipTrigger(page: any): Promise<void> {
  const box = await getTooltipTriggerBox(page);
  const point = getCenterPoint(box);
  await page.hover(point.x, point.y);
  await page.evaluate(() => {
    const preview = document.querySelector(
      '[data-slot="preview"]',
    ) as HTMLElement | null;
    const trigger = Array.from(preview?.querySelectorAll("button") ?? []).find(
      (el) => (el.textContent || "").trim() === "Hover",
    ) as HTMLElement | undefined;
    if (!trigger) return;
    for (const type of [
      "pointerenter",
      "mouseenter",
      "mouseover",
      "pointermove",
      "mousemove",
    ]) {
      trigger.dispatchEvent(
        new MouseEvent(type, { bubbles: true, cancelable: true }),
      );
    }
  });
}

/**
 * pointer を tooltip trigger から外す。
 *
 * docs 上の tooltip は pointer leave だけでなく focus / dismiss 系の影響も受けるため、
 * この helper では
 * - 画面端への hover
 * - そこへの click
 * - leave / blur / Escape の補助 event
 * をまとめて扱い、「消えること」を安定して再現する。
 */
export async function movePointerAway(page: any): Promise<void> {
  await clearPointerHover(page, 0);
  await page.click(10, 10);
  await page.evaluate(() => {
    const preview = document.querySelector(
      '[data-slot="preview"]',
    ) as HTMLElement | null;
    const trigger = Array.from(preview?.querySelectorAll("button") ?? []).find(
      (el) => (el.textContent || "").trim() === "Hover",
    ) as HTMLElement | undefined;
    if (!trigger) return;
    for (const type of [
      "pointerleave",
      "mouseleave",
      "mouseout",
      "pointerout",
      "blur",
    ]) {
      trigger.dispatchEvent(
        new Event(type, { bubbles: true, cancelable: true }),
      );
    }
    trigger.blur?.();
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
}

/**
 * tooltip が見える状態になるまで待つ。
 *
 * ここで見ているのは DOM の存在ではなく、getTooltipState() が返す
 * human-perceivable な visible 状態である。
 */
export async function waitForTooltipVisible(page: any): Promise<void> {
  await waitUntil(
    page,
    async () => {
      const state = await getTooltipState(page);
      return state.visible;
    },
    {
      timeoutMs: 5000,
      intervalMs: 100,
      message: "tooltip did not become visible",
    },
  );
}

/**
 * tooltip が消えた状態になるまで待つ。
 *
 * 「表示される」だけでなく「消える」まで見て初めて tooltip の E2E として
 * 使い物になるため、この helper を独立させている。
 */
export async function waitForTooltipHidden(page: any): Promise<void> {
  await waitUntil(
    page,
    async () => {
      const state = await getTooltipState(page);
      return !state.visible;
    },
    {
      timeoutMs: 5000,
      intervalMs: 100,
      message: "tooltip did not become hidden",
    },
  );
}

/**
 * tooltip の知覚可能な状態を取得する。
 *
 * この sample では、単に tooltip content node が存在するかではなく、
 * - display
 * - visibility
 * - opacity
 * - rect size
 * を組み合わせて「人間が見えているか」を判定する。
 *
 * また、docs ページには複数の tooltip があるため、文言 `Add to library` を含む
 * content に対象を絞っている。
 */
export async function getTooltipState(page: any): Promise<{
  visible: boolean;
  text: string;
}> {
  const result = await page.evaluate(() => {
    const content = Array.from(
      document.querySelectorAll('[data-slot="tooltip-content"]'),
    ).find((el) => {
      const text = (el.textContent || "").trim();
      return text.includes("Add to library");
    }) as HTMLElement | undefined;

    if (!content) return { visible: false, text: "" };

    const cs = getComputedStyle(content);
    const rect = content.getBoundingClientRect();
    const visible =
      cs.display !== "none" &&
      cs.visibility !== "hidden" &&
      cs.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0;

    return {
      visible,
      text: (content.textContent || "").trim(),
    };
  });
  return result;
}

/**
 * tooltip は hidden / visible で矩形サイズが変わるため、
 * screenshot では union ではなく trigger 基準の固定 clip を使う。
 * これにより hidden→visible 比較でも画像サイズを安定させられる。
 */
export async function screenshotTooltipRegion(
  page: any,
  name: string,
): Promise<string> {
  const box = await getTooltipTriggerBox(page);

  // hidden / visible の両方で同じ比較領域を使いたいため、
  // tooltip content の実矩形ではなく trigger 基準の固定 clip を切り出す。
  // これにより VRT 時の image size mismatch を避けやすくしている。
  const filePath = createArtifactPath(SHOTS_DIR, name);
  return screenshotClipAroundBox(page, filePath, box, { padding: 48 });
}
