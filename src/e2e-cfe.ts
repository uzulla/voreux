import { z } from "zod";
import { setupTestEnv, teardownTestEnv } from "./helpers/test-runner.js";

/**
 * E2E Test: https://cfe.jp/ (uzulla's profile page)
 *
 * このファイルはテストシナリオ（何をテストするか）だけを記述する。
 * セルフヒール、リトライ、ビジュアルリグレッション比較などの
 * インフラロジックは helpers/test-runner.ts に隠蔽されている。
 *
 * - run(name, fn) でステップを実行。fn 内で throw すれば FAIL。
 *   SELF_HEAL=1 時は自動リトライされるが、シナリオ側はそれを意識しない。
 * - ctx のメソッド群でブラウザ操作を簡潔に書ける。
 * - 各ステップでスクリーンショットを保存し、テスト全体の動画も recordings/ に保存。
 */

const profileSchema = z.object({
  name: z.string().describe("The person's name"),
  description: z
    .string()
    .describe("Job title or short description shown on the page"),
  snsLinks: z
    .array(z.string())
    .describe("List of SNS/social link labels displayed on the page"),
});

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

async function main() {
  const { ctx, recorder, run, results } = await setupTestEnv("https://cfe.jp/");

  try {
    // --------------------------------------------------
    // Test 1: Navigate to the page
    // --------------------------------------------------
    await run("Navigate to page", async () => {
      await ctx.page.goto("https://cfe.jp/");
      await ctx.page.waitForLoadState("networkidle");
      await ctx.screenshot("01-page-loaded");
    });

    // --------------------------------------------------
    // Test 2: Extract profile information
    // --------------------------------------------------
    await run("Extract profile", async () => {
      const profile = await ctx.stagehand.extract(
        "Extract the person's name, their job title or description, and a list of their SNS/social media link labels",
        profileSchema
      );
      await ctx.screenshot("02-profile-extracted");
      if (profile.name.length === 0 || profile.snsLinks.length === 0) {
        throw new Error("Profile extraction incomplete");
      }
    });

    // --------------------------------------------------
    // Test 3: Extract book (著書) information
    // --------------------------------------------------
    await run("Extract books", async () => {
      const books = await ctx.stagehand.extract(
        "Extract information about the books (著書) listed on this page, including the title and a short description for each book.",
        booksSchema
      );
      await ctx.screenshot("03-books-extracted");
      if (books.books.length === 0) {
        throw new Error("No books extracted");
      }
    });

    // --------------------------------------------------
    // Test 4: Observe clickable links on the page
    // --------------------------------------------------
    await run("Observe links", async () => {
      const actions = await ctx.stagehand.observe(
        "Find all clickable links on this page"
      );
      await ctx.highlightObserved(actions, "04-links-observed");
      if (actions.length === 0) {
        throw new Error("No links observed");
      }
    });

    // --------------------------------------------------
    // Test 5: Click a link using act() + assert destination
    // --------------------------------------------------
    await run("Click GitHub link", async () => {
      await ctx.assertNoVisualRegression("05a-before-click");
      await ctx.highlightTarget("Find the GitHub link", "05a-click-target");

      const navPage = await ctx.actAndWaitForNav(
        "Click the GitHub link",
        "github.com"
      );
      await ctx.screenshot("05b-new-tab", navPage);
      ctx.saveCurrentBaseline("05a-before-click");
    });
  } catch (error) {
    try {
      await ctx.screenshot("error-crash");
    } catch {}
    console.error("Test failed with error:", error);
    process.exitCode = 1;
  } finally {
    await teardownTestEnv(ctx, recorder, results);
  }
}

main();
