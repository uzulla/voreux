import fs from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/**
 * calendar の selection highlight は背景色との差が小さい（薄いグレーリング）。
 * デフォルト 0.1 では見逃すため、calendar 用には低めの threshold を使う。
 */
const DEFAULT_PIXELMATCH_THRESHOLD = 0.01;

export function saveBaseline(
  screenshotPath: string,
  baselineName: string,
  baselinesDir: string,
): string {
  if (!fs.existsSync(baselinesDir)) {
    fs.mkdirSync(baselinesDir, { recursive: true });
  }
  const dest = path.join(baselinesDir, `${baselineName}.png`);
  fs.copyFileSync(screenshotPath, dest);
  return dest;
}

export function compareWithBaseline(
  currentPath: string,
  baselineName: string,
  opts: { baselinesDir: string; diffPath: string; pixelmatchThreshold?: number },
): { mismatchRatio: number; diffSaved: boolean; skipped: boolean } {
  const baselinePath = path.join(opts.baselinesDir, `${baselineName}.png`);

  if (!fs.existsSync(baselinePath)) {
    return { mismatchRatio: 0, diffSaved: false, skipped: true };
  }

  const img1 = PNG.sync.read(fs.readFileSync(currentPath));
  const img2 = PNG.sync.read(fs.readFileSync(baselinePath));

  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(
      `Image size mismatch: current=${img1.width}x${img1.height}, baseline=${img2.width}x${img2.height}`,
    );
  }

  const { width, height } = img1;
  const diff = new PNG({ width, height });
  const numDiffPixels = pixelmatch(
    img1.data,
    img2.data,
    diff.data,
    width,
    height,
    { threshold: opts.pixelmatchThreshold ?? DEFAULT_PIXELMATCH_THRESHOLD },
  );

  const mismatchRatio = numDiffPixels / (width * height);
  const diffDir = path.dirname(opts.diffPath);
  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir, { recursive: true });
  }
  fs.writeFileSync(opts.diffPath, PNG.sync.write(diff));
  return { mismatchRatio, diffSaved: true, skipped: false };
}
