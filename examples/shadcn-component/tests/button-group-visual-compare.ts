import path from "node:path";
import { compareWithBaseline, saveBaseline } from "./visual-compare.js";

const BASENAME = "button-group-archive-hover";

export async function assertArchiveHoverVisualChange(
  page: any,
  opts: {
    screenshotsDir: string;
    baselinesDir: string;
    hover: () => Promise<void>;
    waitUntilHovered: () => Promise<void>;
  },
): Promise<void> {
  const hiddenPath = path.join(opts.screenshotsDir, `${BASENAME}-before.png`);
  const visiblePath = path.join(opts.screenshotsDir, `${BASENAME}-after.png`);
  const diffPath = path.join(opts.screenshotsDir, `${BASENAME}-diff.png`);

  await screenshotArchiveButton(page, hiddenPath);
  saveBaseline(hiddenPath, BASENAME, opts.baselinesDir);

  await opts.hover();
  await opts.waitUntilHovered();
  await screenshotArchiveButton(page, visiblePath);
  const result = compareWithBaseline(visiblePath, BASENAME, {
    baselinesDir: opts.baselinesDir,
    diffPath,
  });

  if (result.skipped) {
    throw new Error("button-group hover baseline comparison was skipped");
  }
}

async function screenshotArchiveButton(page: any, outputPath: string) {
  const clip = await page.evaluate(() => {
    const preview = document.querySelector(
      '[data-slot="preview"]',
    ) as HTMLElement | null;
    const group = preview?.querySelector(
      '[data-slot="button-group"]',
    ) as HTMLElement | null;
    const button = Array.from(group?.querySelectorAll("button") ?? []).find(
      (el) => (el.textContent || "").trim() === "Archive",
    ) as HTMLElement | undefined;
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const padding = 8;
    const x = Math.max(0, Math.floor(rect.x - padding));
    const y = Math.max(0, Math.floor(rect.y - padding));
    return {
      x,
      y,
      width: Math.ceil(rect.x + rect.width + padding - x),
      height: Math.ceil(rect.y + rect.height + padding - y),
    };
  });

  if (!clip) {
    throw new Error("Archive button clip could not be determined");
  }

  await page.screenshot({ path: outputPath, clip });
}
