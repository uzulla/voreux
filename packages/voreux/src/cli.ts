#!/usr/bin/env node
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import {
  stderr as errorOutput,
  stdin as input,
  stdout as output,
} from "process";
import { fileURLToPath } from "url";
import { parseArgs } from "util";
import {
  generateDraftScenarioFromRecorder,
  parseDevToolsRecorderJson,
} from "./scaffold-generation/from-devtools-recorder-json.js";

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

const HELP_TEXT = `Voreux, Stagehand + Vitest E2E testing framework

Usage:
  voreux init [dir] [--force]                                Scaffold a project (default: skips existing files)
  voreux test [pattern] [--include-drafts] [--only-drafts]  Run vitest tests
  voreux run [pattern] [--include-drafts] [--only-drafts]   Alias of test
  voreux scaffold from devtools-recorder-json [file]        Generate a draft scenario from Recorder JSON
  voreux --help                                             Show this help
  voreux --version                                          Show version

Options:
  --force, -f         Overwrite existing files during init
  --include-drafts    Include *.draft.test.ts in test runs
  --only-drafts       Run only *.draft.test.ts

Environment:
  VOREUX_INCLUDE_DRAFTS=1   Include draft scenarios by default
  VOREUX_ONLY_DRAFTS=1      Run only draft scenarios

Examples:
  voreux init my-e2e
  voreux init my-e2e --force
  voreux test
  voreux test login-flow
  voreux test --include-drafts
  voreux test --only-drafts
  VOREUX_INCLUDE_DRAFTS=1 voreux test
  voreux scaffold from devtools-recorder-json recording.json > scaffold.draft.test.ts
  cat recording.json | voreux scaffold from devtools-recorder-json > scaffold.draft.test.ts

For more details, see: https://github.com/uzulla/voreux`;

const INIT_TEMPLATE_FILES: Record<string, string> = {
  "package.json": JSON.stringify(
    {
      name: "my-voreux-project",
      version: "0.1.0",
      type: "module",
      private: true,
      scripts: {
        test: "voreux test",
        "test:self-heal": "cross-env SELF_HEAL=1 voreux test",
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

  "tests/example.test.ts": `import { defineScenarioSuite, TestContext } from "@uzulla/voreux";

const steps = [
  {
    name: "load page",
    selfHeal: false,
    run: async (ctx: TestContext) => {
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

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function collectTestTargets(cwd: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".test.ts")) {
        results.push(path.relative(cwd, fullPath));
      }
    }
  }

  walk(cwd);
  return results.sort();
}

function isDraftScenario(filePath: string): boolean {
  return filePath.endsWith(".draft.test.ts");
}

function matchesPattern(filePath: string, pattern?: string): boolean {
  if (!pattern) return true;
  return filePath.includes(pattern);
}

export interface ScenarioSelectionResult {
  selected: string[];
  excludedDrafts: string[];
}

export function resolveScenarioTargets(
  cwd: string,
  pattern: string | undefined,
  includeDrafts: boolean,
  onlyDrafts: boolean,
): ScenarioSelectionResult {
  const files = collectTestTargets(cwd);
  const selected: string[] = [];
  const excludedDrafts: string[] = [];

  for (const file of files) {
    if (!matchesPattern(file, pattern)) continue;
    const isDraft = isDraftScenario(file);
    if (onlyDrafts) {
      if (isDraft) selected.push(file);
      continue;
    }
    if (includeDrafts) {
      selected.push(file);
      continue;
    }
    if (isDraft) {
      excludedDrafts.push(file);
      continue;
    }
    selected.push(file);
  }

  return { selected, excludedDrafts };
}

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

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function generateDraftScenarioFromRecorderSource(
  source: string,
): Promise<string> {
  const parsed = parseDevToolsRecorderJson(source);
  return generateDraftScenarioFromRecorder(parsed);
}

async function cmdTest(options: {
  pattern?: string;
  includeDrafts?: boolean;
  onlyDrafts?: boolean;
}): Promise<void> {
  const includeDrafts = options.onlyDrafts
    ? false
    : (options.includeDrafts ?? false) ||
      isTruthyEnv(process.env.VOREUX_INCLUDE_DRAFTS);
  const onlyDrafts =
    options.onlyDrafts ?? isTruthyEnv(process.env.VOREUX_ONLY_DRAFTS);

  const { selected, excludedDrafts } = resolveScenarioTargets(
    process.cwd(),
    options.pattern,
    includeDrafts,
    onlyDrafts,
  );

  if (selected.length === 0) {
    const mode = onlyDrafts
      ? "draft scenarios"
      : includeDrafts
        ? "scenarios"
        : "non-draft scenarios";
    console.error(`voreux test: no matching ${mode} found.`);
    process.exit(1);
  }

  const args = ["vitest", "run", ...selected];
  console.log(`Running vitest on ${selected.length} scenario file(s)...`);
  if (!includeDrafts && !onlyDrafts && excludedDrafts.length > 0) {
    console.log(
      `Excluded ${excludedDrafts.length} draft scenario file(s): ${excludedDrafts.join(", ")}`,
    );
  }
  const result = spawnSync("pnpm", args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function cmdScaffold(rest: string[]): Promise<void> {
  if (
    rest.length < 2 ||
    rest[0] !== "from" ||
    rest[1] !== "devtools-recorder-json"
  ) {
    errorOutput.write(
      "voreux scaffold: expected `voreux scaffold from devtools-recorder-json [file]`\n",
    );
    process.exit(1);
  }

  if (rest.length > 3) {
    errorOutput.write(
      "voreux scaffold: too many arguments for `devtools-recorder-json`\n",
    );
    process.exit(1);
  }

  const sourcePath = rest[2];
  if (!sourcePath && input.isTTY) {
    errorOutput.write(
      "voreux scaffold: no input. pass [file] or pipe JSON via stdin.\n",
    );
    process.exit(1);
  }

  const source = sourcePath
    ? fs.readFileSync(sourcePath, "utf8")
    : await readStdin();
  const generated = await generateDraftScenarioFromRecorderSource(source);
  output.write(generated);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      force: { type: "boolean", short: "f" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      "include-drafts": { type: "boolean" },
      "only-drafts": { type: "boolean" },
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
    case "run":
      await cmdTest({
        pattern: rest[0],
        includeDrafts: values["include-drafts"] ?? false,
        onlyDrafts: values["only-drafts"] ?? false,
      });
      break;

    case "scaffold":
      await cmdScaffold(rest);
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

const isDirectCliInvocation =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectCliInvocation) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`voreux: fatal error: ${message}`);
    process.exit(1);
  });
}
