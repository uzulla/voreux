import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    sequence: { concurrent: false },
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    testTimeout: 120_000,
    // hookTimeout を長めにしている理由:
    // - Stagehand が headless browser runtime を使うことによる browser/context/page cleanup
    // - Stagehand wrapper / session の後始末
    // - screenshots / recordings の flush
    // - 複数 sample / 複数 step を 1 package にまとめた teardown 集中
    //
    // 原因はまだ未特定だが、現時点では teardown cost が既定 hookTimeout を超えやすいため、
    // 開発時の filter 実行を前提にしつつ長め設定を採用している。
    hookTimeout: 720_000,
    watch: false,
    reporters: ["verbose"],
  },
});
