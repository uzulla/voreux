import { expect } from "vitest";
import { z } from "zod";
import { defineScenarioSuite } from "../../../support/scenario.js";

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

defineScenarioSuite({
  suiteName: "cfe.jp E2E",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "Navigate to page",
      selfHeal: false,
      run: async (ctx) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForLoadState("networkidle");
        await ctx.screenshot("01-page-loaded");
      },
    },
    {
      name: "Extract profile",
      run: async (ctx) => {
        const profile = await ctx.stagehand.extract(
          "Extract the person's name, their job title or description, and a list of their SNS/social media link labels",
          profileSchema
        );
        await ctx.screenshot("02-profile-extracted");
        expect(profile.name.length).toBeGreaterThan(0);
        expect(profile.snsLinks.length).toBeGreaterThan(0);
      },
    },
    {
      name: "Extract books",
      run: async (ctx) => {
        const books = await ctx.stagehand.extract(
          "Extract information about the books (著書) listed on this page, including the title and a short description for each book.",
          booksSchema
        );
        await ctx.screenshot("03-books-extracted");
        expect(books.books.length).toBeGreaterThan(0);
      },
    },
    {
      name: "Observe links",
      run: async (ctx) => {
        const actions = await ctx.stagehand.observe(
          "Find all clickable links on this page"
        );
        await ctx.highlightObserved(actions, "04-links-observed");
        expect(actions.length).toBeGreaterThan(0);
      },
    },
    {
      name: "Click GitHub link",
      run: async (ctx) => {
        await ctx.assertNoVisualRegression("05a-before-click");
        await ctx.highlightTarget("Find the GitHub link", "05a-click-target");

        const navPage = await ctx.actAndWaitForNav(
          "Click the GitHub link",
          "github.com"
        );
        await ctx.screenshot("05b-new-tab", navPage);
        if (process.env.UPDATE_BASELINE) {
          ctx.saveCurrentBaseline("05a-before-click");
          console.log("Baseline updated: 05a-before-click");
        }
      },
    },
  ],
});
