import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    sequence: { concurrent: false },
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
    watch: false,
    reporters: ["verbose"],
  },
});
