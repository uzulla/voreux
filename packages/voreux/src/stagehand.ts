import { Stagehand } from "@browserbasehq/stagehand";
import fs from "fs";
import os from "os";
import { frameworkConfig } from "./config.js";
import {
  createTestContext,
  FRAMES_DIR,
  RECORDING_DIR,
  SCREENSHOT_DIR,
  type TestContext,
} from "./context.js";
import {
  createNoopRecorder,
  framesToVideo,
  hasFfmpegCommand,
  type Recorder,
  startRecording,
} from "./recording.js";
import { createScreenshotHelper } from "./screenshot.js";

/**
 * WSL2 環境かどうかを判定する。
 * カーネルバージョン文字列に "microsoft" が含まれる場合を WSL2 とみなす。
 */
function isWsl2(): boolean {
  if (os.platform() !== "linux") return false;
  try {
    const version = fs.readFileSync("/proc/version", "utf-8");
    return version.toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

/**
 * Stagehand を初期化し、テスト実行に必要な環境を準備する。
 * beforeAll() から呼び出す。
 */
export async function initStagehand(originUrl: string): Promise<{
  ctx: TestContext;
  recorder: Recorder;
}> {
  // 出力ディレクトリを準備（前回分をクリア）
  for (const dir of [SCREENSHOT_DIR, RECORDING_DIR]) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  const ffmpegAvailable = hasFfmpegCommand();
  if (ffmpegAvailable) {
    fs.mkdirSync(FRAMES_DIR, { recursive: true });
  } else {
    console.info("ffmpeg not found: skip frame capture and video conversion");
  }

  const stagehand = new Stagehand({
    env: "LOCAL",
    model: frameworkConfig.stagehand.model,
    cacheDir: frameworkConfig.stagehand.cacheDir,
    localBrowserLaunchOptions: {
      headless: frameworkConfig.browser.headless,
      viewport: frameworkConfig.browser.viewport,
      // WSL2 ではカーネルの制約により Chrome のサンドボックスが使えないため無効化する。
      // 他の環境では sandbox を有効なままにする。
      ...(isWsl2()
        ? { args: ["--no-sandbox", "--disable-setuid-sandbox"] }
        : {}),
    },
  });
  await stagehand.init();
  const page = stagehand.context.pages()[0];

  const recorder = ffmpegAvailable
    ? startRecording(
        page,
        FRAMES_DIR,
        frameworkConfig.videoRecording.frameIntervalMs,
      )
    : createNoopRecorder();
  const screenshotFn = createScreenshotHelper(page, SCREENSHOT_DIR, recorder);

  const ctx = createTestContext(
    stagehand,
    page,
    recorder,
    screenshotFn,
    originUrl,
  );

  return { ctx, recorder };
}

/**
 * 録画を停止し、ブラウザを閉じ、動画を生成する。
 * afterAll() から呼び出す。
 */
export async function closeStagehand(
  ctx: TestContext,
  recorder: Recorder,
): Promise<void> {
  const totalFrames = await recorder.stop();
  await ctx.stagehand.close();

  if (totalFrames > 0) {
    const safeInterval = Math.max(
      frameworkConfig.videoRecording.frameIntervalMs,
      1,
    );
    const fps = Math.round(1000 / safeInterval);
    framesToVideo(FRAMES_DIR, RECORDING_DIR, fps);
  }
}
