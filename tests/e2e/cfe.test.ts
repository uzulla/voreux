import { describe, test, beforeAll, afterAll, afterEach, expect } from "vitest";
import { z } from "zod";
import { initStagehand, closeStagehand } from "../../support/stagehand.js";
import type { TestContext } from "../../support/context.js";
import type { Recorder } from "../../support/recording.js";
import { withSelfHeal } from "../../support/self-heal.js";

/**
 * E2E Test: https://cfe.jp/ (uzulla's profile page)
 *
 * テストシナリオ（何をテストするか）だけを記述する。
 * セルフヒール、リトライ、ビジュアルリグレッション比較などの
 * インフラロジックは support/ に隠蔽されている。
 */

const ORIGIN_URL = "https://cfe.jp/";

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

describe("cfe.jp E2E", () => {
  let ctx: TestContext | undefined;
  let recorder: Recorder | undefined;

  beforeAll(async () => {
    ({ ctx, recorder } = await initStagehand(ORIGIN_URL));
  });

  afterAll(async () => {
    if (ctx && recorder) {
      await closeStagehand(ctx, recorder).catch((e) =>
        console.error("closeStagehand error:", e)
      );
    }
  });

  afterEach(async (testCtx) => {
    // テスト失敗時にスクリーンショットを自動保存
    if (ctx && testCtx.task.result?.state === "fail") {
      try {
        const name = `error-${testCtx.task.name.replace(/\s+/g, "-")}`;
        await ctx.screenshot(name);
      } catch (err) {
        console.warn(`Failed to capture error screenshot "${name}":`, err);
      }
    }
  });

  // --------------------------------------------------
  // Test 1: Navigate to the page
  // --------------------------------------------------
  test("Navigate to page", async () => {
    await ctx.page.goto(ORIGIN_URL);
    await ctx.page.waitForLoadState("networkidle");
    await ctx.screenshot("01-page-loaded");
  });

  // --------------------------------------------------
  // Test 2: Extract profile information
  // --------------------------------------------------
  test("Extract profile", async () => {
    await withSelfHeal(ctx, async () => {
      const profile = await ctx.stagehand.extract(
        "Extract the person's name, their job title or description, and a list of their SNS/social media link labels",
        profileSchema
      );
      await ctx.screenshot("02-profile-extracted");
      expect(profile.name.length).toBeGreaterThan(0);
      expect(profile.snsLinks.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------
  // Test 3: Extract book (著書) information
  // --------------------------------------------------
  test("Extract books", async () => {
    await withSelfHeal(ctx, async () => {
      const books = await ctx.stagehand.extract(
        "Extract information about the books (著書) listed on this page, including the title and a short description for each book.",
        booksSchema
      );
      await ctx.screenshot("03-books-extracted");
      expect(books.books.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------
  // Test 4: Observe clickable links on the page
  // --------------------------------------------------
  test("Observe links", async () => {
    await withSelfHeal(ctx, async () => {
      const actions = await ctx.stagehand.observe(
        "Find all clickable links on this page"
      );
      await ctx.highlightObserved(actions, "04-links-observed");
      expect(actions.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------
  // Test 5: Click a link using act() + assert destination
  // --------------------------------------------------
  test("Click GitHub link", async () => {
    await withSelfHeal(ctx, async () => {
      await ctx.assertNoVisualRegression("05a-before-click");
      await ctx.highlightTarget("Find the GitHub link", "05a-click-target");

      const navPage = await ctx.actAndWaitForNav(
        "Click the GitHub link",
        "github.com"
      );
      await ctx.screenshot("05b-new-tab", navPage);
      ctx.saveCurrentBaseline("05a-before-click");
    });
  });
});
