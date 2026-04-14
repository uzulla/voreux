import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "voreux-cli-test-"));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(dir, "tests", "alpha.test.ts"), "// alpha\n");
  fs.writeFileSync(
    path.join(dir, "tests", "beta.draft.test.ts"),
    "// beta draft\n",
  );
  fs.writeFileSync(path.join(dir, "tests", "gamma.test.ts"), "// gamma\n");
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("voreux cli draft scenario selection", () => {
  it("excludes draft scenarios by default", async () => {
    const { resolveScenarioTargets } = await import("../src/cli.js");
    const dir = makeTempProject();
    const result = resolveScenarioTargets(dir, undefined, false, false);
    expect(result.selected).toEqual([
      "tests/alpha.test.ts",
      "tests/gamma.test.ts",
    ]);
    expect(result.excludedDrafts).toEqual(["tests/beta.draft.test.ts"]);
  });

  it("includes draft scenarios when opted in", async () => {
    const { resolveScenarioTargets } = await import("../src/cli.js");
    const dir = makeTempProject();
    const result = resolveScenarioTargets(dir, undefined, true, false);
    expect(result.selected).toEqual([
      "tests/alpha.test.ts",
      "tests/beta.draft.test.ts",
      "tests/gamma.test.ts",
    ]);
    expect(result.excludedDrafts).toEqual([]);
  });

  it("runs only draft scenarios when requested", async () => {
    const { resolveScenarioTargets } = await import("../src/cli.js");
    const dir = makeTempProject();
    const result = resolveScenarioTargets(dir, undefined, false, true);
    expect(result.selected).toEqual(["tests/beta.draft.test.ts"]);
    expect(result.excludedDrafts).toEqual([]);
  });

  it("applies pattern filtering together with draft inclusion", async () => {
    const { resolveScenarioTargets } = await import("../src/cli.js");
    const dir = makeTempProject();
    const result = resolveScenarioTargets(dir, "beta", true, false);
    expect(result.selected).toEqual(["tests/beta.draft.test.ts"]);
    expect(result.excludedDrafts).toEqual([]);
  });
});
