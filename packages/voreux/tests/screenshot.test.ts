import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createScreenshotHelper,
  sanitizeArtifactName,
} from "../src/screenshot.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("screenshot helpers", () => {
  it("sanitizes path-breaking characters in artifact names", () => {
    expect(
      sanitizeArtifactName(
        "error-button-group の hover / dropdown / submenu / checked state を確認する",
      ),
    ).toBe(
      "error-button-group-の-hover-dropdown-submenu-checked-state-を確認する",
    );
  });

  it("writes screenshots using the sanitized filename", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "voreux-shots-"));
    tempDirs.push(dir);

    const screenshot = vi.fn(async ({ path: filePath }: { path: string }) => {
      fs.writeFileSync(filePath, "png");
    });
    const page = { screenshot };

    const helper = createScreenshotHelper(page, dir);
    const actualPath = await helper("error hover / submenu");

    expect(actualPath).toBe(path.join(dir, "error-hover-submenu.png"));
    expect(screenshot).toHaveBeenCalledOnce();
    expect(fs.existsSync(actualPath)).toBe(true);
  });
});
