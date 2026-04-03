#!/usr/bin/env node
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "util";

const PKG_VERSION = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "package.json",
    ),
    "utf-8",
  ),
).version;

const HELP_TEXT = `Voreux — Stagehand + Vitest E2E testing framework

Usage:
  voreux init [dir] [--force]  Scaffold a project (default: skips existing files)
  voreux test [pattern]         Run vitest tests (default: all)
  voreux --help                Show this help
  voreux --version             Show version

Options:
  --force, -f   Overwrite existing files during init

Examples:
  voreux init my-e2e
  voreux init my-e2e --force   (overwrites any existing files)
  cd my-e2e
  # add OPENAI_API_KEY to .env
  voreux test

For more details, see: https://github.com/uzulla/voreux`;

const INIT_TEMPLATE_FILES: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "my-voreux-project",
      version: "0.1.0",
      type: "module",
      private: true,
      scripts: {
        test: "vitest run",
        "test:self-heal": "cross-env SELF_HEAL=1 vitest run",
        build: "tsc --noEmit",
      },
      dependencies: {
        "@uzulla/voreux": `^${PKG_VERSION}`,
        zod: "^4.0.0",
      },
      devDependencies: {
        "@types/node": "^25.2.1",
        "cross-env": "^10.1.0",
        typescript: "^5.9.3",
        vitest: "^4.0.18",
      },
    },
    null,
    2,
  ),

  "vitest.config.ts": `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    singleFork: true,
  },
});
`,

  ".env.example": `OPENAI_API_KEY=sk-...`,

  ".gitignore": `node_modules
.env
screenshots
recordings
baselines
*.png
*.mp4
`,

  "tsconfig.json": JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
    },
    null,
    2,
  ),

  "tests/example.test.ts": `import { defineScenarioSuite } from "@uzulla/voreux";

const steps = [
  {
    name: "load page",
    selfHeal: false,
    run: async (ctx) => {
      await ctx.page.goto("https://example.com/");
    },
  },
];

defineScenarioSuite({
  suiteName: "example",
  originUrl: "https://example.com/",
  steps,
});
`,
};

async function cmdInit(targetDir?: string, force?: boolean): Promise<void> {
  const resolved = targetDir ? path.resolve(targetDir) : process.cwd();

  if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) {
    console.error(`voreux init: ${resolved} is a file, not a directory.`);
    process.exit(1);
  }

  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
    console.log(`Created directory: ${resolved}`);
  }

  for (const [relativePath, content] of Object.entries(INIT_TEMPLATE_FILES)) {
    const filePath = path.join(resolved, relativePath);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(filePath)) {
      if (force) {
        fs.writeFileSync(filePath, content, "utf-8");
        console.log(`Overwritten: ${relativePath}`);
      } else {
        console.log(`Skipped (exists): ${relativePath}`);
      }
    } else {
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`Created: ${relativePath}`);
    }
  }

  console.log(
    `\nScaffold complete! Next steps:\n` +
      `  cd ${resolved}\n` +
      `  pnpm install\n` +
      `  cp .env.example .env\n` +
      `  # add OPENAI_API_KEY to .env\n` +
      `  pnpm test\n`,
  );
}

async function cmdTest(pattern?: string): Promise<void> {
  const args = ["vitest", "run"];
  if (pattern) {
    args.push(pattern);
  }
  console.log(`Running vitest...`);
  const result = spawnSync("pnpm", args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      force: { type: "boolean", short: "f" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    return;
  }

  if (values.version) {
    console.log(`voreux ${PKG_VERSION}`);
    return;
  }

  const [command, ...rest] = positionals;

  switch (command) {
    case "init":
      await cmdInit(rest[0], values.force ?? false);
      break;

    case "test":
      await cmdTest(rest[0]);
      break;

    case undefined:
      console.log(HELP_TEXT);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.log(`Run 'voreux --help' for usage.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("voreux: fatal error:", err);
  process.exit(1);
});
