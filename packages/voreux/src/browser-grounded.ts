import fs from "fs";
import path from "path";
import { sanitizeArtifactName } from "./screenshot.js";

export async function waitUntil(
  page: any,
  fn: () => Promise<boolean>,
  opts: {
    timeoutMs: number;
    intervalMs?: number;
    message?: string;
  },
): Promise<void> {
  const deadline = Date.now() + opts.timeoutMs;
  const intervalMs = opts.intervalMs ?? 100;

  while (Date.now() < deadline) {
    if (await fn()) return;
    await page.waitForTimeout(intervalMs);
  }

  throw new Error(
    opts.message ?? `Condition not met within ${opts.timeoutMs}ms`,
  );
}

export function getCenterPoint(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number } {
  return {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
}

export async function movePointerToSafeCorner(page: any): Promise<void> {
  await page.hover(10, 10);
}

export async function clearPointerHover(
  page: any,
  settleMs = 200,
): Promise<void> {
  await movePointerToSafeCorner(page);
  await page.waitForTimeout(settleMs);
}

export async function screenshotClip(
  page: any,
  outputPath: string,
  clip: { x: number; y: number; width: number; height: number },
): Promise<string> {
  await page.screenshot({ path: outputPath, clip });
  return outputPath;
}

export async function screenshotClipAroundBox(
  page: any,
  outputPath: string,
  box: { x: number; y: number; width: number; height: number },
  opts?: {
    padding?: number;
    viewport?: { width: number; height: number };
  },
): Promise<string> {
  const padding = opts?.padding ?? 0;
  const viewport =
    opts?.viewport ??
    (await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    })));

  const x = Math.max(0, Math.floor(box.x - padding));
  const y = Math.max(0, Math.floor(box.y - padding));
  const width = Math.max(
    1,
    Math.min(Math.ceil(box.x + box.width + padding - x), viewport.width - x),
  );
  const height = Math.max(
    1,
    Math.min(Math.ceil(box.y + box.height + padding - y), viewport.height - y),
  );

  return screenshotClip(page, outputPath, { x, y, width, height });
}

export async function isPerceivablyVisible(
  page: any,
  selector: string,
): Promise<boolean> {
  return page.evaluate((targetSelector: string) => {
    const el = document.querySelector(targetSelector) as HTMLElement | null;
    if (!el) return false;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
      cs.display !== "none" &&
      cs.visibility !== "hidden" &&
      cs.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }, selector);
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function createArtifactPath(dir: string, name: string): string {
  ensureDir(dir);
  return path.join(dir, `${sanitizeArtifactName(name)}.png`);
}
