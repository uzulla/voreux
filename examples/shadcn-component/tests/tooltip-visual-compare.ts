import fs from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

// tooltip helper 本体から分離している理由:
// - tooltip-helpers.ts は「対象要素の特定・hover・visible/hidden 観測」に集中させたい
// - 画像比較ロジックまで混ぜると、UI 操作 helper と VRT utility の責務が混線しやすい
// - 将来的に tooltip 以外の shadcn sample でも同じ比較パターンを再利用しやすくしたい
//
// つまりこのファイルは「tooltip を操作する helper」ではなく、
// 「tooltip sample で使う最小の部分 VRT utility」として分けている。
const PIXELMATCH_THRESHOLD = 0.1;

/**
 * 現在の screenshot を baseline として保存する。
 *
 * sample としては「最初に hidden 状態を撮る → baseline 保存 → visible 状態と比較する」
 * という流れを見せたいため、保存処理を呼び出し側から読める形で分離している。
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

/**
 * baseline との差分を比較し、 mismatch ratio を返す。
 *
 * ここでは巨大な VRT 基盤を持ち込まず、sample として理解しやすい最小構成
 * （PNG 読み込み / pixelmatch / diff 画像保存）に留めている。
 */
export function compareWithBaseline(
  currentPath: string,
  baselineName: string,
  opts: { baselinesDir: string; diffPath: string },
): { mismatchRatio: number; diffSaved: boolean; skipped: boolean } {
  const baselinePath = path.join(opts.baselinesDir, `${baselineName}.png`);

  // baseline がまだ無い段階では比較を skip できるようにしている。
  // sample 上は saveBaseline() を先に呼ぶので通常は skip されないが、
  // helper 単体としての振る舞いを明確にするため戻り値で区別している。
  if (!fs.existsSync(baselinePath)) {
    return { mismatchRatio: 0, diffSaved: false, skipped: true };
  }

  const img1 = PNG.sync.read(fs.readFileSync(currentPath));
  const img2 = PNG.sync.read(fs.readFileSync(baselinePath));

  // サイズが違う場合は「比較結果」ではなく「比較不能」なので、その場で失敗させる。
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
    {
      threshold: PIXELMATCH_THRESHOLD,
    },
  );

  // 画素単位の差分数を画像全体で割って、sample から扱いやすい比率へ落とす。
  const mismatchRatio = numDiffPixels / (width * height);
  const diffDir = path.dirname(opts.diffPath);
  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir, { recursive: true });
  }
  fs.writeFileSync(opts.diffPath, PNG.sync.write(diff));
  return { mismatchRatio, diffSaved: true, skipped: false };
}
