import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    sequence: { concurrent: false },
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    testTimeout: 120_000,
    // Stagehand の browser teardown がこの sample では重く、
    // screenshots と複数 step を含むと既定の hookTimeout を超えやすかったため長めにしている。
    hookTimeout: 420_000,
    watch: false,
    reporters: ["verbose"],
  },
});
