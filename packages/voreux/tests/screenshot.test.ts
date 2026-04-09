import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ArtifactNameCollisionError,
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

  it("throws ArtifactNameCollisionError when the sanitized path already exists", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "voreux-shots-"));
    tempDirs.push(dir);

    const screenshot = vi.fn(async ({ path: filePath }: { path: string }) => {
      fs.writeFileSync(filePath, "png");
    });
    const page = { screenshot };

    const helper = createScreenshotHelper(page, dir);
    await helper("step-one");

    await expect(helper("step-one")).rejects.toThrow(
      ArtifactNameCollisionError,
    );
    // screenshot should not have been called a second time
    expect(screenshot).toHaveBeenCalledOnce();
  });

  it("releases reservation on failure so the name can be retried", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "voreux-shots-"));
    tempDirs.push(dir);

    let callCount = 0;
    const screenshot = vi.fn(async ({ path: filePath }: { path: string }) => {
      callCount += 1;
      // 最初の2呼び出し（fullPage あり・なし両方）は失敗させる
      if (callCount <= 2) throw new Error("screenshot failed");
      fs.writeFileSync(filePath, "png");
    });
    const page = { screenshot };

    const helper = createScreenshotHelper(page, dir);

    // 1回目は失敗する → 予約が解放されるはず
    await expect(helper("step-one")).rejects.toThrow("screenshot failed");

    // 2回目は成功できる（ArtifactNameCollisionError にならない）
    const filePath = await helper("step-one");
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
