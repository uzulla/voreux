import { Stagehand } from "@browserbasehq/stagehand";
import fs from "fs";
import {
  SCREENSHOT_DIR,
  RECORDING_DIR,
  FRAMES_DIR,
  createTestContext,
  type TestContext,
} from "./context.js";
import { createScreenshotHelper } from "./screenshot.js";
import {
  startRecording,
  framesToVideo,
  hasFfmpegCommand,
  createNoopRecorder,
  type Recorder,
} from "./recording.js";

const FRAME_INTERVAL_MS = 500;

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
  const recorder = ffmpegAvailable
    ? startRecording(page, FRAMES_DIR, FRAME_INTERVAL_MS)
    : createNoopRecorder();

  const ctx = createTestContext(stagehand, page, recorder, screenshotFn, originUrl);

  return { ctx, recorder };
}

/**
 * 録画を停止し、ブラウザを閉じ、動画を生成する。
 * afterAll() から呼び出す。
 */
export async function closeStagehand(
  ctx: TestContext,
  recorder: Recorder
): Promise<void> {
  const totalFrames = await recorder.stop();
  await ctx.stagehand.close();

  if (totalFrames > 0) {
    const fps = Math.round(1000 / FRAME_INTERVAL_MS);
    framesToVideo(FRAMES_DIR, RECORDING_DIR, fps);
  }
}
