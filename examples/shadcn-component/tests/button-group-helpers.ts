import { getCenterPoint, waitUntil } from "@uzulla/voreux";

const HOVER_MARKER_DURATION_MS = 700;

async function showHoverMarker(
  page: any,
  x: number,
  y: number,
  label: string,
): Promise<void> {
  await page.evaluate(
    (point: { x: number; y: number; label: string; durationMs: number }) => {
      const marker = document.createElement("div");
      marker.setAttribute("data-voreux-hover-marker", "true");
      marker.style.position = "fixed";
      marker.style.left = `${point.x - 14}px`;
      marker.style.top = `${point.y - 14}px`;
      marker.style.width = "28px";
      marker.style.height = "28px";
      marker.style.borderRadius = "9999px";
      marker.style.background = "rgba(59, 130, 246, 0.92)";
      marker.style.border = "3px solid white";
      marker.style.boxShadow = "0 0 0 6px rgba(59, 130, 246, 0.24)";
      marker.style.zIndex = "2147483647";
      marker.style.pointerEvents = "none";

      const pill = document.createElement("div");
      pill.textContent = point.label;
      pill.style.position = "fixed";
      pill.style.left = "50%";
      pill.style.bottom = "32px";
      pill.style.transform = "translateX(-50%)";
      pill.style.padding = "10px 14px";
      pill.style.borderRadius = "9999px";
      pill.style.background = "rgba(59, 130, 246, 0.95)";
      pill.style.color = "white";
      pill.style.fontSize = "18px";
      pill.style.fontWeight = "800";
      pill.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
      pill.style.zIndex = "2147483647";
      pill.style.pointerEvents = "none";
      pill.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.25)";

      document.body.appendChild(marker);
      document.body.appendChild(pill);
      setTimeout(() => {
        marker.remove();
        pill.remove();
      }, point.durationMs);
    },
    { x, y, label, durationMs: HOVER_MARKER_DURATION_MS },
  );
  await page.waitForTimeout(HOVER_MARKER_DURATION_MS);
}

/**
 * docs ページ内には複数サンプルがあるため、最上部 preview の button-group を対象に固定する。
 */
export async function getPrimaryButtonGroupButtons(page: any): Promise<
  Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    ariaHaspopup: string | null;
    ariaControls: string | null;
  }>
> {
  const buttons = await page.evaluate(() => {
    const previews = Array.from(
      document.querySelectorAll('[data-slot="preview"]'),
    ) as HTMLElement[];
    const preview = previews.find((candidate) => {
      const group = candidate.querySelector(
        '[data-slot="button-group"]',
      ) as HTMLElement | null;
      if (!group) return false;
      const texts = Array.from(group.querySelectorAll("button")).map((el) =>
        (el.textContent || "").trim(),
      );
      return (
        texts.includes("Archive") &&
        texts.includes("Report") &&
        texts.includes("Snooze")
      );
    }) as HTMLElement | undefined;
    const group = preview?.querySelector(
      '[data-slot="button-group"]',
    ) as HTMLElement | null;
    if (!group) return [];
    return Array.from(group.querySelectorAll("button")).map((el) => {
      const target = el as HTMLElement;
      const r = target.getBoundingClientRect();
      return {
        text: (target.textContent || "").trim(),
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        ariaHaspopup: target.getAttribute("aria-haspopup"),
        ariaControls: target.getAttribute("aria-controls"),
      };
    });
  });
  return buttons;
}

export async function getButtonClickPoint(
  page: any,
  matcher: (text: string) => boolean,
): Promise<{ x: number; y: number }> {
  const buttons = await getPrimaryButtonGroupButtons(page);
  const button = buttons.find((entry) => matcher(entry.text));
  if (!button) throw new Error("button in primary button group not found");
  return getCenterPoint(button);
}

export async function hoverButtonByText(
  page: any,
  label: string,
): Promise<void> {
  const point = await getButtonClickPoint(page, (text) => text === label);
  await showHoverMarker(page, point.x, point.y, `Hover: ${label}`);
  await page.hover(point.x, point.y);
  await page.evaluate((targetLabel: string) => {
    const previews = Array.from(
      document.querySelectorAll('[data-slot="preview"]'),
    ) as HTMLElement[];
    const preview = previews.find((candidate) => {
      const group = candidate.querySelector(
        '[data-slot="button-group"]',
      ) as HTMLElement | null;
      if (!group) return false;
      const texts = Array.from(group.querySelectorAll("button")).map((el) =>
        (el.textContent || "").trim(),
      );
      return (
        texts.includes("Archive") &&
        texts.includes("Report") &&
        texts.includes("Snooze")
      );
    });
    const group = preview?.querySelector(
      '[data-slot="button-group"]',
    ) as HTMLElement | null;
    const button = Array.from(group?.querySelectorAll("button") ?? []).find(
      (el) => (el.textContent || "").trim() === targetLabel,
    ) as HTMLElement | undefined;
    if (!button) return;
    for (const type of [
      "pointerenter",
      "mouseenter",
      "mouseover",
      "pointermove",
      "mousemove",
    ]) {
      button.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    }
  }, label);
}

export async function getOverflowButtonClickPoint(
  page: any,
): Promise<{ x: number; y: number }> {
  const buttons = await getPrimaryButtonGroupButtons(page);
  const overflow =
    buttons.find((entry) => entry.ariaHaspopup === "menu") ??
    buttons.find((entry) => Boolean(entry.ariaControls)) ??
    buttons
      .filter((entry) => entry.text === "")
      .sort((a, b) => a.x - b.x)
      .at(-1);

  if (!overflow) throw new Error("overflow button not found");
  return getCenterPoint(overflow);
}

export async function clickOverflowButton(page: any): Promise<void> {
  const point = await getOverflowButtonClickPoint(page);
  await page.click(point.x, point.y);
}

export async function getButtonVisualState(
  page: any,
  label: string,
): Promise<{
  backgroundColor: string;
  color: string;
  matchesHover: boolean;
}> {
  return page.evaluate((targetLabel: string) => {
    const preview = document.querySelector(
      '[data-slot="preview"]',
    ) as HTMLElement | null;
    const group = preview?.querySelector(
      '[data-slot="button-group"]',
    ) as HTMLElement | null;
    const button = Array.from(group?.querySelectorAll("button") ?? []).find(
      (el) => (el.textContent || "").trim() === targetLabel,
    ) as HTMLElement | undefined;
    if (!button) throw new Error(`button not found: ${targetLabel}`);
    const cs = getComputedStyle(button);
    return {
      backgroundColor: cs.backgroundColor,
      color: cs.color,
      matchesHover: button.matches(":hover"),
    };
  }, label);
}

export async function waitForMenuVisible(page: any): Promise<void> {
  await waitUntil(
    page,
    async () => {
      const state = await getMenuState(page);
      return state.visible;
    },
    {
      timeoutMs: 5000,
      intervalMs: 100,
      message: "button group menu did not become visible",
    },
  );
}

export async function waitForSubmenuVisible(page: any): Promise<void> {
  await waitUntil(
    page,
    async () => {
      const state = await getSubmenuState(page);
      return state.visible;
    },
    {
      timeoutMs: 5000,
      intervalMs: 100,
      message: "button group submenu did not become visible",
    },
  );
}

export async function waitForMenusHidden(page: any): Promise<void> {
  await waitUntil(
    page,
    async () => {
      const menu = await getMenuState(page);
      const submenu = await getSubmenuState(page);
      return !menu.visible && !submenu.visible;
    },
    {
      timeoutMs: 5000,
      intervalMs: 100,
      message: "button group menus did not become hidden",
    },
  );
}

export async function getMenuState(
  page: any,
): Promise<{ visible: boolean; items: string[] }> {
  return page.evaluate(() => {
    const visibleContents = (
      Array.from(
        document.querySelectorAll('[data-slot="dropdown-menu-content"]'),
      ) as HTMLElement[]
    ).filter((target) => {
      const cs = getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        cs.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    if (visibleContents.length === 0) return { visible: false, items: [] };
    if (visibleContents.length > 1) {
      throw new Error(
        `multiple visible dropdown-menu-content found: ${visibleContents.length}`,
      );
    }
    const content = visibleContents[0];
    const items = Array.from(
      content.querySelectorAll(
        '[role="menuitem"], [role="menuitemcheckbox"], [data-slot="dropdown-menu-sub-trigger"]',
      ),
    )
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean);
    return { visible: true, items };
  });
}

export async function getSubmenuState(
  page: any,
): Promise<{ visible: boolean; items: string[] }> {
  return page.evaluate(() => {
    const visibleContents = (
      Array.from(
        document.querySelectorAll('[data-slot="dropdown-menu-sub-content"]'),
      ) as HTMLElement[]
    ).filter((target) => {
      const cs = getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        cs.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    if (visibleContents.length === 0) return { visible: false, items: [] };
    if (visibleContents.length > 1) {
      throw new Error(
        `multiple visible dropdown-menu-sub-content found: ${visibleContents.length}`,
      );
    }
    const content = visibleContents[0];
    const items = Array.from(content.querySelectorAll('[role="menuitemradio"]'))
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean);
    return { visible: true, items };
  });
}

export async function hoverMenuItem(page: any, label: string): Promise<void> {
  const point = await page.evaluate((targetLabel: string) => {
    const visibleContents = (
      Array.from(
        document.querySelectorAll('[data-slot="dropdown-menu-content"]'),
      ) as HTMLElement[]
    ).filter((target) => {
      const cs = getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        cs.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    if (visibleContents.length > 1) {
      throw new Error(
        `multiple visible dropdown-menu-content found: ${visibleContents.length}`,
      );
    }
    const content = visibleContents[0];
    const item = Array.from(
      content?.querySelectorAll('[data-slot="dropdown-menu-sub-trigger"]') ??
        [],
    ).find((el) => (el.textContent || "").trim() === targetLabel) as
      | HTMLElement
      | undefined;
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return {
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
    };
  }, label);
  if (!point) throw new Error(`menu item not found: ${label}`);
  await showHoverMarker(page, point.x, point.y, `Hover: ${label}`);
  await page.hover(point.x, point.y);
  await page.evaluate((targetLabel: string) => {
    const visibleContents = (
      Array.from(
        document.querySelectorAll('[data-slot="dropdown-menu-content"]'),
      ) as HTMLElement[]
    ).filter((target) => {
      const cs = getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        cs.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    const content = visibleContents[0];
    const item = Array.from(
      content?.querySelectorAll('[data-slot="dropdown-menu-sub-trigger"]') ??
        [],
    ).find((el) => (el.textContent || "").trim() === targetLabel) as
      | HTMLElement
      | undefined;
    if (!item) return;
    for (const type of [
      "pointerenter",
      "mouseenter",
      "mouseover",
      "pointermove",
      "mousemove",
    ]) {
      item.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    }
  }, label);
}

export async function getCheckedLabelState(page: any): Promise<{
  checkedLabel: string | null;
}> {
  return page.evaluate(() => {
    const visibleContents = (
      Array.from(
        document.querySelectorAll('[data-slot="dropdown-menu-sub-content"]'),
      ) as HTMLElement[]
    ).filter((target) => {
      const cs = getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        cs.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    if (visibleContents.length > 1) {
      throw new Error(
        `multiple visible dropdown-menu-sub-content found: ${visibleContents.length}`,
      );
    }
    const content = visibleContents[0];
    if (!content) return { checkedLabel: null };
    const checked = Array.from(
      content.querySelectorAll('[role="menuitemradio"]'),
    ).find((el) => {
      const target = el as HTMLElement;
      return (
        target.getAttribute("data-state") === "checked" ||
        target.getAttribute("aria-checked") === "true"
      );
    }) as HTMLElement | undefined;
    return {
      checkedLabel: checked ? (checked.textContent || "").trim() : null,
    };
  });
}

export async function getLabelOptionClickPoint(
  page: any,
  label: string,
): Promise<{ x: number; y: number }> {
  const point = await page.evaluate((targetLabel: string) => {
    const visibleContents = (
      Array.from(
        document.querySelectorAll('[data-slot="dropdown-menu-sub-content"]'),
      ) as HTMLElement[]
    ).filter((target) => {
      const cs = getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      return (
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        cs.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    if (visibleContents.length > 1) {
      throw new Error(
        `multiple visible dropdown-menu-sub-content found: ${visibleContents.length}`,
      );
    }
    const content = visibleContents[0];
    const item = Array.from(
      content?.querySelectorAll('[role="menuitemradio"]') ?? [],
    ).find((el) => (el.textContent || "").trim() === targetLabel) as
      | HTMLElement
      | undefined;
    if (!item) return null;
    const r = item.getBoundingClientRect();
    return {
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
    };
  }, label);
  if (!point) throw new Error(`submenu option not found: ${label}`);
  return point;
}
