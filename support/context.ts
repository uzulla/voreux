import path from "path";
import type { Stagehand } from "@browserbasehq/stagehand";
import type { ScreenshotFn } from "./screenshot.js";
import type { Recorder } from "./recording.js";
import { compareWithBaseline, saveBaseline } from "./screenshot.js";
import {
  highlightElement,
  highlightElements,
  removeHighlights,
} from "./highlight.js";

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------

export const SCREENSHOT_DIR = path.resolve("screenshots");
export const RECORDING_DIR = path.resolve("recordings");
export const FRAMES_DIR = path.join(RECORDING_DIR, "frames");
export const BASELINES_DIR = path.resolve("baselines");

export const VISUAL_DIFF_THRESHOLD = 0.1; // 10%

// ----------------------------------------------------------------
// VisualRegressionError
// ----------------------------------------------------------------

export class VisualRegressionError extends Error {
  diffPath: string;
  mismatchRatio: number;
  constructor(diffPath: string, mismatchRatio: number) {
    super(
      `Visual regression detected (${(mismatchRatio * 100).toFixed(1)}% mismatch). Diff: ${diffPath}`
    );
    this.name = "VisualRegressionError";
    this.diffPath = diffPath;
    this.mismatchRatio = mismatchRatio;
  }
}

// ----------------------------------------------------------------
// TestContext
// ----------------------------------------------------------------

export interface TestContext {
  stagehand: Stagehand;
  page: any;
  screenshot: ScreenshotFn;
  recorder: Recorder;
  originUrl: string;

  /** act() 実行 → 新タブ or 同一タブ遷移を待って結果ページを返す */
  actAndWaitForNav: (instruction: string, urlPattern: string) => Promise<any>;

  /** ビューポートのスクリーンショットをベースラインと比較し、差異超過なら throw */
  assertNoVisualRegression: (baselineName: string) => Promise<void>;

  /** 現在のスクリーンショットをベースラインとして保存 */
  saveCurrentBaseline: (baselineName: string) => void;

  /** observe() 結果を一括ハイライト → screenshot → 録画フレーム注入 → ハイライト除去 */
  highlightObserved: (actions: any[], screenshotName: string) => Promise<void>;

  /** observe() で要素を探し、単一ハイライト → screenshot → 録画フレーム注入 → ハイライト除去 */
  highlightTarget: (instruction: string, screenshotName: string) => Promise<void>;
}

// ベースライン比較用の一時パスを保持
let _lastComparisonSsPath: string | null = null;

export function createTestContext(
  stagehand: Stagehand,
  page: any,
  recorder: Recorder,
  screenshotFn: ScreenshotFn,
  originUrl: string
): TestContext {
  const ctx: TestContext = {
    stagehand,
    page,
    recorder,
    originUrl,
    screenshot: screenshotFn,

    async actAndWaitForNav(instruction: string, urlPattern: string) {
      const pagesBefore = stagehand.context.pages().length;
      await stagehand.act(instruction);

      // 新タブ or 同一タブ遷移で URL が urlPattern にマッチするまでポーリング（最大 5 秒）
      const deadline = Date.now() + 5000;
      let resultPage: any = null;
      while (Date.now() < deadline) {
        const allPages = stagehand.context.pages();
        const matchedPage = allPages.find((p: any) =>
          p.url().includes(urlPattern)
        );
        if (matchedPage) {
          resultPage = matchedPage;
          break;
        }
        if (page.url().includes(urlPattern)) {
          resultPage = page;
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!resultPage) {
        throw new Error(
          `Navigation failed: no page matching "${urlPattern}" found`
        );
      }

      if (resultPage !== page) {
        await resultPage.waitForLoadState("domcontentloaded").catch(() => {});
      }
      return resultPage;
    },

    async assertNoVisualRegression(baselineName: string) {
      const ssPath = path.join(SCREENSHOT_DIR, `${baselineName}.png`);
      await page.screenshot({ path: ssPath });
      _lastComparisonSsPath = ssPath;

      const diffPath = path.join(SCREENSHOT_DIR, `${baselineName}-diff.png`);
      const comparison = compareWithBaseline(ssPath, baselineName, {
        baselinesDir: BASELINES_DIR,
        diffPath,
      });

      if (!comparison.skipped && comparison.mismatchRatio > VISUAL_DIFF_THRESHOLD) {
        throw new VisualRegressionError(diffPath, comparison.mismatchRatio);
      }
    },

    saveCurrentBaseline(baselineName: string) {
      if (_lastComparisonSsPath) {
        saveBaseline(_lastComparisonSsPath, baselineName, BASELINES_DIR);
      }
    },

    async highlightObserved(actions: any[], screenshotName: string) {
      await highlightElements(page, actions);
      try {
        await screenshotFn(screenshotName);
        await recorder.injectFrames(3);
      } finally {
        await removeHighlights(page);
      }
    },

    async highlightTarget(instruction: string, screenshotName: string) {
      const targets = await stagehand.observe(instruction);
      if (targets.length > 0) {
        await highlightElement(page, targets[0].selector, {
          showCursor: true,
          label: "Click target",
        });
        try {
          await screenshotFn(screenshotName);
          await recorder.injectFrames(3);
        } finally {
          await removeHighlights(page);
        }
      }
    },
  };

  return ctx;
}
