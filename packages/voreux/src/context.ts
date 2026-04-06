import type { Stagehand } from "@browserbasehq/stagehand";
import path from "path";
import {
  annotateKey as annotateKeyHelper,
  annotatePoint,
} from "./annotation.js";
import { frameworkConfig } from "./config.js";
import {
  highlightElement,
  highlightElements,
  removeHighlights,
} from "./highlight.js";
import type { Recorder } from "./recording.js";
import type { ScreenshotFn } from "./screenshot.js";
import { compareWithBaseline, saveBaseline } from "./screenshot.js";

// ----------------------------------------------------------------
// 定数
// ----------------------------------------------------------------

export const SCREENSHOT_DIR = path.resolve(
  frameworkConfig.paths.screenshotsDir,
);
export const RECORDING_DIR = path.resolve(frameworkConfig.paths.recordingsDir);
export const FRAMES_DIR = path.join(RECORDING_DIR, "frames");
export const BASELINES_DIR = path.resolve(frameworkConfig.paths.baselinesDir);

export const VISUAL_DIFF_THRESHOLD =
  frameworkConfig.visualRegression.mismatchThreshold;

// ----------------------------------------------------------------
// VisualRegressionError
// ----------------------------------------------------------------

export class VisualRegressionError extends Error {
  diffPath: string;
  mismatchRatio: number;
  constructor(diffPath: string, mismatchRatio: number) {
    super(
      `Visual regression detected (${(mismatchRatio * 100).toFixed(1)}% mismatch). Diff: ${diffPath}`,
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

  /** クリック位置とラベルを人間向けに可視化する */
  annotateClick: (x: number, y: number, label?: string) => Promise<void>;

  /** キー押下を人間向けに可視化する */
  annotateKey: (key: string) => Promise<void>;

  /** observe() で要素を探し、単一ハイライト → screenshot → 録画フレーム注入 → ハイライト除去 */
  highlightTarget: (
    instruction: string,
    screenshotName: string,
  ) => Promise<void>;
}

export function createTestContext(
  stagehand: Stagehand,
  page: any,
  recorder: Recorder,
  screenshotFn: ScreenshotFn,
  originUrl: string,
): TestContext {
  let lastComparisonSsPath: string | null = null;

  const ctx: TestContext = {
    stagehand,
    page,
    recorder,
    originUrl,
    screenshot: screenshotFn,

    async actAndWaitForNav(instruction: string, urlPattern: string) {
      const initialPages = new Set(stagehand.context.pages());
      await stagehand.act(instruction);

      // 新タブ or 同一タブ遷移で URL が urlPattern にマッチするまでポーリング
      const deadline = Date.now() + frameworkConfig.navigation.timeoutMs;
      let resultPage: any = null;
      while (Date.now() < deadline) {
        // 新しく開いたページのみチェック
        const newPages = stagehand.context
          .pages()
          .filter((p: any) => !initialPages.has(p));
        const matchedPage = newPages.find((p: any) =>
          p.url().includes(urlPattern),
        );
        if (matchedPage) {
          resultPage = matchedPage;
          break;
        }
        // 同一タブ遷移チェック
        if (page.url().includes(urlPattern)) {
          resultPage = page;
          break;
        }
        await new Promise((r) =>
          setTimeout(r, frameworkConfig.navigation.pollIntervalMs),
        );
      }

      if (!resultPage) {
        throw new Error(
          `Navigation failed: no page matching "${urlPattern}" found`,
        );
      }

      if (resultPage !== page) {
        await resultPage.waitForLoadState("domcontentloaded").catch(() => {});
      }
      return resultPage;
    },

    async assertNoVisualRegression(baselineName: string) {
      const ssPath = path.join(SCREENSHOT_DIR, `${baselineName}.png`);
      recorder.pause();
      try {
        await recorder.captureFrameNow();
        await page.screenshot({ path: ssPath });
        await new Promise((resolve) => setTimeout(resolve, 100));
        await recorder.captureFrameNow();
      } finally {
        recorder.resume();
      }
      lastComparisonSsPath = ssPath;

      const diffPath = path.join(SCREENSHOT_DIR, `${baselineName}-diff.png`);
      const comparison = compareWithBaseline(ssPath, baselineName, {
        baselinesDir: BASELINES_DIR,
        diffPath,
      });

      if (
        !comparison.skipped &&
        comparison.mismatchRatio > VISUAL_DIFF_THRESHOLD
      ) {
        throw new VisualRegressionError(diffPath, comparison.mismatchRatio);
      }
    },

    saveCurrentBaseline(baselineName: string) {
      if (lastComparisonSsPath) {
        saveBaseline(lastComparisonSsPath, baselineName, BASELINES_DIR);
      }
    },

    async highlightObserved(actions: any[], screenshotName: string) {
      await highlightElements(page, actions);
      try {
        await screenshotFn(screenshotName);
        await recorder.injectFrames(
          frameworkConfig.videoRecording.injectFrameCount,
        );
      } finally {
        await removeHighlights(page);
      }
    },

    async annotateClick(x: number, y: number, label?: string) {
      recorder.pause();
      try {
        await recorder.captureFrameNow();
        await annotatePoint(
          page,
          { x, y, label },
          {
            onShown: () => recorder.captureFrameNow(),
          },
        );
        await recorder.captureFrameNow();
      } finally {
        recorder.resume();
      }
    },

    async annotateKey(key: string) {
      recorder.pause();
      try {
        await recorder.captureFrameNow();
        await annotateKeyHelper(page, key, undefined, {
          onShown: () => recorder.captureFrameNow(),
        });
        await recorder.captureFrameNow();
      } finally {
        recorder.resume();
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
          await recorder.injectFrames(
            frameworkConfig.videoRecording.injectFrameCount,
          );
        } finally {
          await removeHighlights(page);
        }
      }
    },
  };

  return ctx;
}
