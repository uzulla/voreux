import { defineScenarioSuite } from "@uzulla/voreux";

const ORIGIN_URL = "https://cfe.jp/";

// Generated from Chrome DevTools Recorder JSON.
// Purpose: create a happy-path E2E draft scaffold that humans or agents can refine.
// This scaffold captures recorded browser actions, but assertions and observation points
// still need to be added explicitly.

defineScenarioSuite({
  suiteName: "GitHub link happy path",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "01. Set viewport",
      selfHeal: false,
      run: async (ctx) => {
        await ctx.page.setViewportSize({ width: 1280, height: 720 });
        // TODO: adjust viewport strategy if this scenario should run responsively.
      },
    },

    {
      name: "02. Navigate to page",
      selfHeal: false,
      run: async (ctx) => {
        await ctx.page.goto("https://cfe.jp/");
        await ctx.page.waitForLoadState("networkidle");
        await ctx.screenshot("02-navigate");
        // TODO: add assertions for the expected happy-path landing state.
      },
    },

    {
      name: "03. Click recorded target",
      run: async (ctx) => {
        // - aria/GitHub
        // - a.github
        // - xpath//html/body/div[1]/div/section[1]/div/a[2]
        // - pierce/a.github
        await ctx.page.getByLabel("GitHub").click();
        await ctx.page.waitForLoadState("networkidle").catch(() => {});
        await ctx.screenshot("03-click");
        // TODO: confirm where this click is supposed to navigate or what should change.
      },
    },
  ],
});
