import { Stagehand } from "@browserbasehq/stagehand";
import path from "path";
import fs from "fs";
import { startRecording, framesToVideo, Recorder } from "./recording.js";
import {
  createScreenshotHelper,
  ScreenshotFn,
  compareWithBaseline,
  saveBaseline,
} from "./screenshot.js";
import {
  highlightElement,
  highlightElements,
  removeHighlights,
} from "./highlight.js";

export const SCREENSHOT_DIR = path.resolve("screenshots");
export const RECORDING_DIR = path.resolve("recordings");
export const FRAMES_DIR = path.join(RECORDING_DIR, "frames");
export const BASELINES_DIR = path.resolve("baselines");

export const VISUAL_DIFF_THRESHOLD = 0.1; // 10%
const FRAME_INTERVAL_MS = 500;

export interface TestResult {
  step: string;
  passed: boolean;
  screenshot?: string;
}

export type StepFn = () => Promise<void>;
export type RunFn = (name: string, fn: StepFn) => Promise<void>;

// ----------------------------------------------------------------
// TestContext — ブラウザ操作の抽象化
// ----------------------------------------------------------------
// シナリオ側(e2e-cfe.ts)から呼ぶ高レベルメソッドを提供する。
// 新タブ検出のポーリングやハイライトの注入・除去など、
// ステップ内で繰り返し書きたくない定型処理をここにまとめている。
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

function createTestContext(
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

      // 新タブが開くのを待つ（最大 5 秒ポーリング）
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const current = stagehand.context.pages();
        if (current.length > pagesBefore) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      // URL が確定するのを待つ
      await new Promise((r) => setTimeout(r, 1000));

      const allPages = stagehand.context.pages();
      const matchedPage = allPages.find((p: any) =>
        p.url().includes(urlPattern)
      );
      const navigatedInPlace = page.url().includes(urlPattern);

      if (!matchedPage && !navigatedInPlace) {
        throw new Error(
          `Navigation failed: no page matching "${urlPattern}" found`
        );
      }

      const resultPage = matchedPage || page;
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
      await screenshotFn(screenshotName);
      await recorder.injectFrames(3);
      await removeHighlights(page);
    },

    async highlightTarget(instruction: string, screenshotName: string) {
      const targets = await stagehand.observe(instruction);
      if (targets.length > 0) {
        await highlightElement(page, targets[0].selector, {
          showCursor: true,
          label: "Click target",
        });
        await screenshotFn(screenshotName);
        await recorder.injectFrames(3);
        await removeHighlights(page);
      }
    },
  };

  return ctx;
}

// ----------------------------------------------------------------
// VisualRegressionError
// ----------------------------------------------------------------
// ページの見た目が壊れている場合に throw される。
// ステップランナーはこのエラーを特別扱いし、セルフヒール対象外とする。
// （ページ崩壊はキャッシュ削除+リトライで直るものではないため）
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
// Self-heal
// ----------------------------------------------------------------
// SELF_HEAL=1 のときにステップランナーから呼ばれる回復処理。
//   1. 間違って開いた余分なタブを閉じる
//   2. Stagehand のキャッシュ(.cache/cfe-test)を削除して LLM に再推論させる
//   3. テスト対象ページをリロードしてクリーンな状態に戻す
// この後、同じステップ関数(fn)がもう一度実行される。
// ----------------------------------------------------------------

async function selfHeal(ctx: TestContext): Promise<void> {
  // 余分なタブを閉じる
  const extraPages = ctx.stagehand.context
    .pages()
    .filter((p: any) => p !== ctx.page);
  for (const ep of extraPages) {
    try {
      await ep.close();
    } catch {}
  }

  // キャッシュを削除
  const cacheDir = path.resolve(".cache/cfe-test");
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // ページを再読み込み
  await ctx.page.goto(ctx.originUrl);
  await ctx.page.waitForLoadState("networkidle");
}

// ----------------------------------------------------------------
// ステップランナー
// ----------------------------------------------------------------
// シナリオの各ステップを run(name, fn) で実行する。
//
// 動作フロー:
//   1. fn() を実行 → 成功すれば passed: true で記録
//   2. fn() が throw した場合:
//      a. VisualRegressionError → セルフヒール不可、即 FAIL
//      b. SELF_HEAL=1 → selfHeal() で回復を試み fn() を再実行
//      c. それ以外 or リトライも失敗 → passed: false で記録
//
// シナリオ側は「失敗したら throw する」だけでよく、
// リトライやキャッシュ削除の存在を意識する必要がない。
// ----------------------------------------------------------------

function createStepRunner(ctx: TestContext): { run: RunFn; results: TestResult[] } {
  const results: TestResult[] = [];

  async function run(name: string, fn: StepFn): Promise<void> {
    try {
      await fn();
      results.push({ step: name, passed: true });
    } catch (err) {
      if (err instanceof VisualRegressionError) {
        // ビジュアルリグレッションはセルフヒール対象外 → 即 FAIL
        results.push({ step: name, passed: false });
        return;
      }

      if (process.env.SELF_HEAL === "1") {
        console.log(`  [self-heal] "${name}" failed, retrying...`);
        await selfHeal(ctx);
        try {
          await fn();
          results.push({ step: name, passed: true });
          return;
        } catch {
          // リトライも失敗
        }
      }

      results.push({ step: name, passed: false });
    }
  }

  return { run, results };
}

// ----------------------------------------------------------------
// Setup / Teardown
// ----------------------------------------------------------------
// setupTestEnv() は ctx, recorder に加え、run() と results を返す。
// シナリオ側は以下のように使う:
//
//   const { ctx, recorder, run, results } = await setupTestEnv("https://...");
//   await run("Step name", async () => { ... });
//   await teardownTestEnv(ctx, recorder, results);
// ----------------------------------------------------------------

export async function setupTestEnv(originUrl: string): Promise<{
  ctx: TestContext;
  recorder: Recorder;
  run: RunFn;
  results: TestResult[];
}> {
  // 出力ディレクトリを準備（前回分をクリア）
  for (const dir of [SCREENSHOT_DIR, RECORDING_DIR]) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: "openai/gpt-4o",
    cacheDir: ".cache/cfe-test",
    localBrowserLaunchOptions: {
      headless: false,
      viewport: { width: 1280, height: 720 },
    },
  });
  await stagehand.init();
  const page = stagehand.context.pages()[0];

  const screenshotFn = createScreenshotHelper(page, SCREENSHOT_DIR);
  const recorder = startRecording(page, FRAMES_DIR, FRAME_INTERVAL_MS);

  const ctx = createTestContext(stagehand, page, recorder, screenshotFn, originUrl);
  const { run, results } = createStepRunner(ctx);

  return { ctx, recorder, run, results };
}

export async function teardownTestEnv(
  ctx: TestContext,
  recorder: Recorder,
  results: TestResult[]
): Promise<void> {
  reportResults(results);

  const totalFrames = await recorder.stop();
  await ctx.stagehand.close();

  if (totalFrames > 0) {
    const fps = Math.round(1000 / FRAME_INTERVAL_MS);
    framesToVideo(FRAMES_DIR, RECORDING_DIR, fps);
  }
}

function reportResults(results: TestResult[]): void {
  const failed = results.filter((r) => !r.passed);

  if (failed.length > 0) {
    console.error(`${failed.length} test(s) FAILED:`);
    for (const f of failed) {
      console.error(`  FAIL  ${f.step}`);
    }
    process.exitCode = 1;
  }
}
