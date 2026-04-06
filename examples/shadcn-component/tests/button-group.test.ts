import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";
import {
  clickCheckedLabelOption,
  clickOverflowButton,
  getButtonVisualState,
  getCheckedLabelState,
  getMenuState,
  getSubmenuState,
  hoverButtonByText,
  hoverMenuItem,
  waitForMenusHidden,
  waitForMenuVisible,
  waitForSubmenuVisible,
} from "./button-group-helpers.js";

const ORIGIN_URL = "https://ui.shadcn.com/docs/components/radix/button-group";

defineScenarioSuite({
  suiteName: "shadcn-component E2E (button-group)",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "button-group の hover / dropdown / submenu / checked state を確認する",
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="preview"]', {
          timeout: 30_000,
        });
        await ctx.page.waitForTimeout(3000);

        const beforeHover = await getButtonVisualState(ctx.page, "Archive");
        await hoverButtonByText(ctx.page, "Archive");
        await ctx.page.waitForTimeout(300);
        const afterHover = await getButtonVisualState(ctx.page, "Archive");

        expect(afterHover.backgroundColor).not.toBe(
          beforeHover.backgroundColor,
        );

        await clickOverflowButton(ctx.page);
        await waitForMenuVisible(ctx.page);
        const menu = await getMenuState(ctx.page);
        expect(menu.visible).toBe(true);
        expect(menu.items.some((item) => item.includes("Label As"))).toBe(true);

        await hoverMenuItem(ctx.page, "Label As...");
        await waitForSubmenuVisible(ctx.page);
        const submenuBefore = await getSubmenuState(ctx.page);
        expect(submenuBefore.visible).toBe(true);
        expect(
          submenuBefore.items.some((item) => item.includes("Personal")),
        ).toBe(true);
        expect(submenuBefore.items.some((item) => item.includes("Work"))).toBe(
          true,
        );

        const checkedBefore = await getCheckedLabelState(ctx.page);
        expect(checkedBefore.checkedLabel).toContain("Personal");

        await clickCheckedLabelOption(ctx.page, "Work");
        await waitForMenusHidden(ctx.page);

        await clickOverflowButton(ctx.page);
        await waitForMenuVisible(ctx.page);
        await hoverMenuItem(ctx.page, "Label As...");
        await waitForSubmenuVisible(ctx.page);

        const checkedAfter = await getCheckedLabelState(ctx.page);
        expect(checkedAfter.checkedLabel).toContain("Work");
      },
    },
  ],
});
