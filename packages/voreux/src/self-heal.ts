import path from "path";
import fs from "fs";
import type { TestContext } from "./context.js";
import { VisualRegressionError } from "./context.js";
import { frameworkConfig } from "./config.js";

/**
 * セルフヒール回復処理:
 * 1. 余分なタブを閉じる
 * 2. Stagehand キャッシュを削除して LLM に再推論させる
 * 3. テスト対象ページをリロードしてクリーンな状態に戻す
 */
async function performSelfHeal(ctx: TestContext): Promise<void> {
  // 余分なタブを閉じる
  const extraPages = ctx.stagehand.context
    .pages()
    .filter((p: any) => p !== ctx.page);
  for (const ep of extraPages) {
    try {
      await ep.close();
    } catch {}
  }

  // キャッシュを削除
  const cacheDir = path.resolve(frameworkConfig.stagehand.cacheDir);
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // ページを再読み込み
  await ctx.page.goto(ctx.originUrl);
  await ctx.page.waitForLoadState("networkidle");
}

/**
 * テスト本体をセルフヒール付きで実行するラッパー。
 *
 * SELF_HEAL=1 かつエラーが VisualRegressionError でない場合、
 * performSelfHeal() で回復を試み fn() を再実行する。
 */
export async function withSelfHeal(
  ctx: TestContext,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof VisualRegressionError) throw err;
    if (process.env.SELF_HEAL !== "1") throw err;

    console.log("  [self-heal] Test failed, performing recovery and retrying...");
    await performSelfHeal(ctx);
    await fn();
  }
}
