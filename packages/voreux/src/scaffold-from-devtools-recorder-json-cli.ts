#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  stderr as errorOutput,
  exit,
  stdin as input,
  stdout as output,
} from "node:process";
import {
  generateDraftScenarioFromRecorder,
  parseDevToolsRecorderJson,
} from "./scaffold-generation-from-devtools-recorder-json.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function printUsage() {
  errorOutput.write(`Usage:
  voreux scaffold from devtools-recorder-json < recording.json > scaffold.draft.test.ts
  voreux scaffold from devtools-recorder-json path/to/recording.json > scaffold.draft.test.ts

Scenario scaffold generation from DevTools Recorder JSON.
Current entrypoint for the Scenario scaffold generation feature.
`);
}

async function main() {
  const arg = process.argv[2];
  if (arg === "--help" || arg === "-h") {
    printUsage();
    return;
  }

  try {
    const source = arg ? readFileSync(arg, "utf8") : await readStdin();
    const parsed = parseDevToolsRecorderJson(source);
    const generated = generateDraftScenarioFromRecorder(parsed);
    output.write(generated);
  } catch (error) {
    errorOutput.write(
      `voreux-scaffold-from-devtools-recorder-json: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    exit(1);
  }
}

await main();
