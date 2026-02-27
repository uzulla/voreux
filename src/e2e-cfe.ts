import { z } from "zod";
import path from "path";
import fs from "fs";
import {
  setupTestEnv,
  teardownTestEnv,
  TestResult,
  SCREENSHOT_DIR,
  BASELINES_DIR,
  VISUAL_DIFF_THRESHOLD,
} from "./helpers/test-runner.js";
import { compareWithBaseline, saveBaseline } from "./helpers/screenshot.js";
import { highlightElement, highlightElements, removeHighlights } from "./helpers/highlight.js";

/**
 * E2E Test: https://cfe.jp/ (uzulla's profile page)
 *
 * 各ステップでスクリーンショットを保存し、失敗時にどのステップで
 * 何が起きたかを視覚的に確認できるようにする。
 * テスト全体の動画も recordings/ に保存する。
 */

async function main() {
  const { ctx, recorder } = await setupTestEnv();
  const results: TestResult[] = [];

  try {
    // --------------------------------------------------
    // Test 1: Navigate to the page
    // --------------------------------------------------
    await ctx.page.goto("https://cfe.jp/");
    await ctx.page.waitForLoadState("networkidle");
    const ss1 = await ctx.screenshot("01-page-loaded");
    results.push({ step: "Test 1: Page navigation", passed: true, screenshot: ss1 });

    // --------------------------------------------------
    // Test 2: Extract profile information
    // --------------------------------------------------
    const profileSchema = z.object({
      name: z.string().describe("The person's name"),
      description: z
        .string()
        .describe("Job title or short description shown on the page"),
      snsLinks: z
        .array(z.string())
        .describe("List of SNS/social link labels displayed on the page"),
    });
    const profile = await ctx.stagehand.extract(
      "Extract the person's name, their job title or description, and a list of their SNS/social media link labels (e.g., Twitter, GitHub, etc.)",
      profileSchema
    );
    const ss2 = await ctx.screenshot("02-profile-extracted");
    const test2Passed = profile.name.length > 0 && profile.snsLinks.length > 0;
    results.push({ step: "Test 2: Profile extraction", passed: test2Passed, screenshot: ss2 });

    // --------------------------------------------------
    // Test 3: Extract book (著書) information
    // --------------------------------------------------
    const booksSchema = z.object({
      books: z.array(
        z.object({
          title: z.string().describe("Book title"),
          description: z
            .string()
            .describe("Short description or summary of the book"),
        })
      ),
    });
    const books = await ctx.stagehand.extract(
      "Extract information about the books (著書) listed on this page, including the title and a short description for each book.",
      booksSchema
    );
    const ss3 = await ctx.screenshot("03-books-extracted");
    const test3Passed = books.books.length > 0;
    results.push({ step: "Test 3: Book extraction", passed: test3Passed, screenshot: ss3 });

    // --------------------------------------------------
    // Test 4: Observe clickable links on the page
    // --------------------------------------------------
    const actions = await ctx.stagehand.observe(
      "Find all clickable links on this page"
    );

    await highlightElements(ctx.page, actions);
    const ss4 = await ctx.screenshot("04-links-observed");
    await recorder.injectFrames(3);
    await removeHighlights(ctx.page);
    const test4Passed = actions.length > 0;
    results.push({ step: "Test 4: Link observation", passed: test4Passed, screenshot: ss4 });

    // --------------------------------------------------
    // Test 5: Click a link using act() + assert destination
    //         (ビジュアルリグレッション検知 + セルフヒール付き)
    // --------------------------------------------------
    // ビューポートサイズのスクリーンショット (fullPage なし) でベースライン比較
    const comparisonSsPath = path.join(SCREENSHOT_DIR, "05a-before-click.png");
    await ctx.page.screenshot({ path: comparisonSsPath });

    // ベースラインとの比較
    const diffPath = path.join(SCREENSHOT_DIR, "05a-diff.png");
    const comparison = compareWithBaseline(comparisonSsPath, "05a-before-click", {
      baselinesDir: BASELINES_DIR,
      diffPath,
    });

    let pageVisuallyBroken = false;
    if (!comparison.skipped && comparison.mismatchRatio > VISUAL_DIFF_THRESHOLD) {
      pageVisuallyBroken = true;
    }

    // クリック対象を可視化したスクリーンショット（ベースライン比較とは別）
    const targetActions = await ctx.stagehand.observe("Find the GitHub link");
    if (targetActions.length > 0) {
      await highlightElement(ctx.page, targetActions[0].selector, {
        showCursor: true,
        label: "Click target",
      });
      await ctx.screenshot("05a-click-target");
      await recorder.injectFrames(3);
      await removeHighlights(ctx.page);
    }

    if (pageVisuallyBroken) {
      // ページが崩壊している → セルフヒールせず即 FAIL
      results.push({
        step: "Test 5: Click GitHub link",
        passed: false,
        screenshot: diffPath,
      });
    } else {
      // act() 実行 + アサーション (セルフヒール付き)
      const actAndAssert = async (): Promise<{
        success: boolean;
        githubPage: any;
        allPages: any[];
      }> => {
        const pagesBefore = ctx.stagehand.context.pages().length;
        await ctx.stagehand.act("Click the GitHub link");

        // 新タブが開くのを待つ（最大5秒ポーリング）
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          const current = ctx.stagehand.context.pages();
          if (current.length > pagesBefore) break;
          await new Promise((r) => setTimeout(r, 300));
        }
        // 少し待って URL が確定するのを待つ
        await new Promise((r) => setTimeout(r, 1000));

        const allPages = ctx.stagehand.context.pages();
        // 新タブで開いた場合 or 同じタブで遷移した場合の両方を検出
        const githubPage = allPages.find((p: any) => p.url().includes("github.com"));
        const navigatedInPlace = ctx.page.url().includes("github.com");
        return {
          success: !!githubPage || navigatedInPlace,
          githubPage: githubPage || (navigatedInPlace ? ctx.page : null),
          allPages,
        };
      };

      let attempt = await actAndAssert();

      const selfHealEnabled = process.env.SELF_HEAL === "1";

      if (!attempt.success && selfHealEnabled) {
        // アサーション失敗 → セルフヒール: キャッシュ削除して再試行
        // 間違って開いたタブを閉じる
        const extraPages = attempt.allPages.filter((p: any) => p !== ctx.page);
        for (const ep of extraPages) {
          try { await ep.close(); } catch {}
        }

        // キャッシュを削除
        const cacheDir = path.resolve(".cache/cfe-test");
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { recursive: true });
          fs.mkdirSync(cacheDir, { recursive: true });
        }

        // ページを再読み込みして再試行
        await ctx.page.goto("https://cfe.jp/");
        await ctx.page.waitForLoadState("networkidle");

        attempt = await actAndAssert();
      }

      // 新しく開いたタブのスクリーンショット
      const newTab = attempt.allPages[attempt.allPages.length - 1];
      if (newTab !== ctx.page) {
        await newTab.waitForLoadState("domcontentloaded").catch(() => {});
        await ctx.screenshot("05b-new-tab", newTab);
      }

      if (attempt.success) {
        results.push({
          step: "Test 5: Click GitHub link",
          passed: true,
          screenshot: path.join(SCREENSHOT_DIR, "05b-new-tab.png"),
        });

        // 成功時: 現在のスクリーンショットをベースラインとして保存
        saveBaseline(comparisonSsPath, "05a-before-click", BASELINES_DIR);
      } else {
        results.push({
          step: "Test 5: Click GitHub link",
          passed: false,
          screenshot: path.join(SCREENSHOT_DIR, "05b-new-tab.png"),
        });
      }
    }
  } catch (error) {
    try {
      await ctx.page.screenshot({
        path: path.join(SCREENSHOT_DIR, "error-crash.png"),
        fullPage: true,
      });
      console.error(`\nCrash screenshot saved: ${SCREENSHOT_DIR}/error-crash.png`);
    } catch {}
    console.error("Test failed with error:", error);
    process.exitCode = 1;
  } finally {
    await teardownTestEnv(ctx, recorder, results);
  }
}

main();
