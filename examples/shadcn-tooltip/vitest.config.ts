import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    sequence: { concurrent: false },
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    testTimeout: 120_000,
    // Stagehand の browser teardown が screenshots を含む sample では重くなりやすいため長めにしている。
    hookTimeout: 420_000,
    watch: false,
    reporters: ["verbose"],
  },
});
