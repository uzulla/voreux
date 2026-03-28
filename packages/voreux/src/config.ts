export interface E2EFrameworkConfig {
  stagehand: {
    model: string;
    cacheDir: string;
  };
  browser: {
    headless: boolean;
    viewport: {
      width: number;
      height: number;
    };
  };
  videoRecording: {
    frameIntervalMs: number;
    injectFrameCount: number;
  };
  navigation: {
    timeoutMs: number;
    pollIntervalMs: number;
  };
  visualRegression: {
    mismatchThreshold: number;
  };
}

const toInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFloat = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  return fallback;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * フレームワーク共通設定。
 * 環境変数でオーバーライド可能にして、各プロジェクトで再利用しやすくする。
 */
export const frameworkConfig: E2EFrameworkConfig = {
  stagehand: {
    model: process.env.STAGEHAND_MODEL ?? "openai/gpt-4o",
    cacheDir: process.env.STAGEHAND_CACHE_DIR ?? ".cache/stagehand-e2e",
  },
  browser: {
    headless: toBool(process.env.E2E_HEADLESS, false),
    viewport: {
      width: toInt(process.env.E2E_VIEWPORT_WIDTH, 1280),
      height: toInt(process.env.E2E_VIEWPORT_HEIGHT, 720),
    },
  },
  videoRecording: {
    frameIntervalMs: Math.max(1, toInt(process.env.E2E_FRAME_INTERVAL_MS, 500)),
    injectFrameCount: Math.max(1, toInt(process.env.E2E_INJECT_FRAME_COUNT, 3)),
  },
  navigation: {
    timeoutMs: Math.max(1, toInt(process.env.E2E_NAV_TIMEOUT_MS, 10000)),
    pollIntervalMs: Math.max(
      1,
      toInt(process.env.E2E_NAV_POLL_INTERVAL_MS, 300),
    ),
  },
  visualRegression: {
    mismatchThreshold: clamp(
      toFloat(process.env.E2E_VISUAL_DIFF_THRESHOLD, 0.1),
      0,
      1,
    ),
  },
};
