import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHOTS_DIR = process.env.E2E_SCREENSHOTS_DIR
  ? path.resolve(process.cwd(), process.env.E2E_SCREENSHOTS_DIR)
  : fileURLToPath(new URL("../screenshots/", import.meta.url));

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

export async function pollUntil(
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

export async function hoverTooltipTrigger(page: any): Promise<void> {
  const box = await getTooltipTriggerBox(page);
  await page.hover(
    Math.round(box.x + box.width / 2),
    Math.round(box.y + box.height / 2),
  );
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

export async function movePointerAway(page: any): Promise<void> {
  await page.hover(10, 10);
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

export async function waitForTooltipVisible(page: any): Promise<void> {
  const ok = await pollUntil(
    page,
    async () => {
      const state = await getTooltipState(page);
      return state.visible;
    },
    5000,
    100,
  );
  if (!ok) throw new Error("tooltip did not become visible");
}

export async function waitForTooltipHidden(page: any): Promise<void> {
  const ok = await pollUntil(
    page,
    async () => {
      const state = await getTooltipState(page);
      return !state.visible;
    },
    5000,
    100,
  );
  if (!ok) throw new Error("tooltip did not become hidden");
}

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

  const filePath = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({
    path: filePath,
    clip: {
      x: Math.max(0, Math.round(box.x - 48)),
      y: Math.max(0, Math.round(box.y - 72)),
      width: Math.round(box.width + 96),
      height: Math.round(box.height + 128),
    },
  });
  return filePath;
}
