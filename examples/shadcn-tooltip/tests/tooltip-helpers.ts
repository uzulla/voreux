import { fileURLToPath } from "node:url";

const SHOTS_DIR = fileURLToPath(new URL("../screenshots/", import.meta.url));

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
 * trigger + tooltip 周辺だけを撮る。tooltip は portal される可能性があるため、
 * trigger 単体ではなく tooltip content を含めた union を clip にする。
 */
export async function screenshotTooltipRegion(
  page: any,
  name: string,
): Promise<string> {
  const box = await page.evaluate(() => {
    const preview = document.querySelector(
      '[data-slot="preview"]',
    ) as HTMLElement | null;
    const trigger = Array.from(preview?.querySelectorAll("button") ?? []).find(
      (el) => (el.textContent || "").trim() === "Hover",
    ) as HTMLElement | undefined;
    const content = Array.from(
      document.querySelectorAll('[data-slot="tooltip-content"]'),
    ).find((el) => {
      const text = (el.textContent || "").trim();
      return text.includes("Add to library");
    }) as HTMLElement | undefined;
    if (!trigger) return null;

    const triggerRect = trigger.getBoundingClientRect();
    const rects = [triggerRect];
    if (content) {
      const contentRect = content.getBoundingClientRect();
      if (contentRect.width > 0 && contentRect.height > 0) {
        rects.push(contentRect);
      }
    }

    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
  });

  if (!box) throw new Error("tooltip screenshot target not found");

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
