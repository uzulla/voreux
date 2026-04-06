import fs from "fs";
import path from "path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import type { Recorder } from "./recording.js";

export class ImageSizeMismatchError extends Error {
  constructor(
    public currentSize: { width: number; height: number },
    public baselineSize: { width: number; height: number },
  ) {
    super(
      `Image size mismatch: current=${currentSize.width}x${currentSize.height}, baseline=${baselineSize.width}x${baselineSize.height}`,
    );
    this.name = "ImageSizeMismatchError";
  }
}

export type ScreenshotFn = (name: string, targetPage?: any) => Promise<string>;

/**
 * スクリーンショット撮影ヘルパーを生成する。
 * 返り値の関数は名前を受け取ってスクリーンショットを保存し、ファイルパスを返す。
 */
export function createScreenshotHelper(
  page: any,
  dir: string,
  recorder?: Recorder,
): ScreenshotFn {
  return async (name: string, targetPage = page) => {
    const filePath = path.join(dir, `${name}.png`);
    recorder?.pause();
    try {
      await recorder?.captureFrameNow();
      try {
        await targetPage.screenshot({ path: filePath, fullPage: true });
      } catch {
        await targetPage.screenshot({ path: filePath });
      }
      await recorder?.captureFrameNow();
    } finally {
      recorder?.resume();
    }
    return filePath;
  };
}

/**
 * 2枚の PNG スクリーンショットを比較し、差異の割合と diff 画像を返す。
 * ベースラインが存在しない場合は比較をスキップ。
 */
export function compareWithBaseline(
  currentPath: string,
  baselineName: string,
  opts: { baselinesDir: string; diffPath: string },
): { mismatchRatio: number; diffSaved: boolean; skipped: boolean } {
  const baselinePath = path.join(opts.baselinesDir, `${baselineName}.png`);

  if (!fs.existsSync(baselinePath)) {
    return { mismatchRatio: 0, diffSaved: false, skipped: true };
  }

  const img1 = PNG.sync.read(fs.readFileSync(currentPath));
  const img2 = PNG.sync.read(fs.readFileSync(baselinePath));

  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new ImageSizeMismatchError(
      { width: img1.width, height: img1.height },
      { width: img2.width, height: img2.height },
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
    { threshold: 0.1 },
  );

  const mismatchRatio = numDiffPixels / (width * height);
  const diffDir = path.dirname(opts.diffPath);
  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir, { recursive: true });
  }
  fs.writeFileSync(opts.diffPath, PNG.sync.write(diff));
  return { mismatchRatio, diffSaved: true, skipped: false };
}

/**
 * 現在のスクリーンショットをベースラインとして保存する。
 */
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
