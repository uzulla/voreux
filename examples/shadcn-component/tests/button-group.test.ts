import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";
import {
  clickOverflowButton,
  getButtonVisualState,
  getCheckedLabelState,
  getLabelOptionClickPoint,
  getMenuState,
  getOverflowButtonClickPoint,
  getSubmenuState,
  hoverButtonByText,
  hoverMenuItem,
  pollUntil,
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

        const archiveReady = await pollUntil(
          ctx.page,
          async () => {
            try {
              await getButtonVisualState(ctx.page, "Archive");
              return true;
            } catch {
              return false;
            }
          },
          5000,
          100,
        );
        if (!archiveReady) {
          throw new Error("Archive button did not become ready");
        }

        const beforeHover = await getButtonVisualState(ctx.page, "Archive");
        await hoverButtonByText(ctx.page, "Archive");
        const hoverApplied = await pollUntil(
          ctx.page,
          async () => {
            const afterHover = await getButtonVisualState(ctx.page, "Archive");
            return afterHover.backgroundColor !== beforeHover.backgroundColor;
          },
          2000,
          100,
        );
        expect(hoverApplied).toBe(true);

        const overflowPoint = await getOverflowButtonClickPoint(ctx.page);
        await ctx.annotateClick(
          overflowPoint.x,
          overflowPoint.y,
          "Click: Overflow menu",
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

        const workPoint = await getLabelOptionClickPoint(ctx.page, "Work");
        await ctx.annotateClick(workPoint.x, workPoint.y, "Click: Work");
        await ctx.page.click(workPoint.x, workPoint.y);
        await waitForMenusHidden(ctx.page);

        const secondOverflowPoint = await getOverflowButtonClickPoint(ctx.page);
        await ctx.annotateClick(
          secondOverflowPoint.x,
          secondOverflowPoint.y,
          "Click: Overflow menu",
        );
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
