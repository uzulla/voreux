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
 * docs ページには alert dialog demo が複数あるため、最上部 preview 内の
 * `Show Dialog` ボタンを対象に固定する。
 */
export async function getShowDialogButtonBox(
  page: any,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.evaluate(() => {
    const preview = document.querySelector(
      '[data-slot="preview"]',
    ) as HTMLElement | null;
    const trigger = Array.from(preview?.querySelectorAll("button") ?? []).find(
      (el) => (el.textContent || "").trim() === "Show Dialog",
    ) as HTMLElement | undefined;
    if (!trigger) return null;
    const r = trigger.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  if (!box) throw new Error("show dialog button not found");
  return box;
}

export async function getShowDialogClickPoint(
  page: any,
): Promise<{ x: number; y: number }> {
  const box = await getShowDialogButtonBox(page);
  return {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
}

export async function getDialogActionClickPoint(
  page: any,
  text: "Cancel" | "Continue",
): Promise<{ x: number; y: number }> {
  const box = await page.evaluate((targetText: string) => {
    const isVisible = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        cs.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const content = Array.from(
      document.querySelectorAll('[data-slot="alert-dialog-content"]'),
    ).find((el) => isVisible(el as HTMLElement)) as HTMLElement | undefined;
    const button = Array.from(content?.querySelectorAll("button") ?? []).find(
      (el) =>
        (el.textContent || "").trim() === targetText &&
        isVisible(el as HTMLElement),
    ) as HTMLElement | undefined;
    if (!button) return null;
    const r = button.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, text);
  if (!box) throw new Error(`dialog action not found: ${text}`);
  return {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
}

/**
 * dialog は overlay / content / title の複合 UI なので、
 * content の有無だけでなく visible な矩形を持つかまで見る。
 */
export async function getAlertDialogState(page: any): Promise<{
  visible: boolean;
  title: string;
}> {
  return page.evaluate(() => {
    const isVisible = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        cs.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const content = Array.from(
      document.querySelectorAll('[data-slot="alert-dialog-content"]'),
    ).find((el) => isVisible(el as HTMLElement)) as HTMLElement | undefined;
    const title = content?.querySelector(
      '[data-slot="alert-dialog-title"]',
    ) as HTMLElement | null;
    if (!content) return { visible: false, title: "" };
    return {
      visible: true,
      title: (title?.textContent || "").trim(),
    };
  });
}

export async function waitForDialogVisible(page: any): Promise<void> {
  const ok = await pollUntil(
    page,
    async () => (await getAlertDialogState(page)).visible,
    5000,
    100,
  );
  if (!ok) throw new Error("alert dialog did not become visible");
}

export async function waitForDialogHidden(page: any): Promise<void> {
  const ok = await pollUntil(
    page,
    async () => !(await getAlertDialogState(page)).visible,
    5000,
    100,
  );
  if (!ok) throw new Error("alert dialog did not become hidden");
}

/**
 * overlay の backdrop-filter / background を観測して、
 * ダイアログ表示中に背景がボケていることを確認する。
 */
export async function dismissDialogWithEscape(page: any): Promise<void> {
  await page.evaluate(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
  await page.waitForTimeout(300);
}

export async function getOverlayVisualState(page: any): Promise<{
  visible: boolean;
  backdropFilter: string;
  backgroundColor: string;
}> {
  return page.evaluate(() => {
    const isVisible = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        cs.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const overlay = Array.from(
      document.querySelectorAll('[data-slot="alert-dialog-overlay"]'),
    ).find((el) => isVisible(el as HTMLElement)) as HTMLElement | undefined;
    if (!overlay) {
      return { visible: false, backdropFilter: "", backgroundColor: "" };
    }
    const cs = getComputedStyle(overlay);
    return {
      visible: true,
      backdropFilter: cs.backdropFilter,
      backgroundColor: cs.backgroundColor,
    };
  });
}

/**
 * trigger / overlay / dialog を含む固定 clip を切り出す。
 * open / closed で dialog のサイズが変わっても、比較画像サイズを安定させたい。
 */
export async function screenshotAlertDialogRegion(
  page: any,
  name: string,
): Promise<string> {
  const box = await getShowDialogButtonBox(page);
  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const x = Math.min(
    Math.max(0, Math.round(box.x - 160)),
    Math.max(0, viewport.width - 1),
  );
  const y = Math.min(
    Math.max(0, Math.round(box.y - 120)),
    Math.max(0, viewport.height - 1),
  );
  const width = Math.max(1, Math.min(420, viewport.width - x));
  const height = Math.max(1, Math.min(320, viewport.height - y));

  const filePath = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({
    path: filePath,
    clip: {
      x,
      y,
      width,
      height,
    },
  });
  return filePath;
}
