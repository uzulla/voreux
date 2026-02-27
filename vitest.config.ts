import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    sequence: { concurrent: false },
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    testTimeout: 120_000,
    hookTimeout: 60_000,
    watch: false,
    reporters: ["verbose"],
  },
});
