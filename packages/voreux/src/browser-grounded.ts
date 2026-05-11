import fs from "fs";
import path from "path";
import type { TestContext } from "./context.js";
import { sanitizeArtifactName } from "./screenshot.js";

export async function waitUntil(
  page: any,
  fn: () => Promise<boolean>,
  opts: {
    timeoutMs: number;
    intervalMs?: number;
    message?: string;
  },
): Promise<void> {
  const deadline = Date.now() + opts.timeoutMs;
  const intervalMs = opts.intervalMs ?? 100;

  while (Date.now() < deadline) {
    if (await fn()) return;
    await page.waitForTimeout(intervalMs);
  }

  throw new Error(
    opts.message ?? `Condition not met within ${opts.timeoutMs}ms`,
  );
}

export function getCenterPoint(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number } {
  return {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
}

export async function movePointerToSafeCorner(page: any): Promise<void> {
  await page.hover(10, 10);
}

export async function clearPointerHover(
  page: any,
  settleMs = 200,
): Promise<void> {
  await movePointerToSafeCorner(page);
  await page.waitForTimeout(settleMs);
}

export async function screenshotClip(
  page: any,
  outputPath: string,
  clip: { x: number; y: number; width: number; height: number },
): Promise<string> {
  await page.screenshot({ path: outputPath, clip });
  return outputPath;
}

export async function screenshotClipAroundBox(
  page: any,
  outputPath: string,
  box: { x: number; y: number; width: number; height: number },
  opts?: {
    padding?: number;
    paddingX?: number;
    paddingY?: number;
    viewport?: { width: number; height: number };
  },
): Promise<string> {
  const paddingX = opts?.paddingX ?? opts?.padding ?? 0;
  const paddingY = opts?.paddingY ?? opts?.padding ?? 0;
  const viewport =
    opts?.viewport ??
    (await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    })));

  const x = Math.max(0, Math.floor(box.x - paddingX));
  const y = Math.max(0, Math.floor(box.y - paddingY));
  const width = Math.max(
    1,
    Math.min(
      Math.ceil(box.x + box.width + paddingX - x),
      Math.max(1, viewport.width - x),
    ),
  );
  const height = Math.max(
    1,
    Math.min(
      Math.ceil(box.y + box.height + paddingY - y),
      Math.max(1, viewport.height - y),
    ),
  );

  return screenshotClip(page, outputPath, { x, y, width, height });
}

export async function isPerceivablyVisible(
  page: any,
  selector: string,
): Promise<boolean> {
  return page.evaluate((targetSelector: string) => {
    const el = document.querySelector(targetSelector) as HTMLElement | null;
    if (!el) return false;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
      cs.display !== "none" &&
      cs.visibility !== "hidden" &&
      cs.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }, selector);
}

export async function readElementVisualState(
  page: any,
  opts: {
    selector: string;
    rootSelector?: string;
    rootIndex?: number;
    css?: string[];
    attributes?: string[];
    matches?: string[];
  },
): Promise<{
  found: boolean;
  visible: boolean;
  css: Record<string, string>;
  attributes: Record<string, string | null>;
  matches: Record<string, boolean>;
}> {
  return page.evaluate(
    (args: {
      selector: string;
      rootSelector?: string;
      rootIndex?: number;
      css: string[];
      attributes: string[];
      matches: string[];
    }) => {
      const root = args.rootSelector
        ? ((document.querySelectorAll(args.rootSelector)[args.rootIndex ?? 0] as
            | HTMLElement
            | undefined) ?? null)
        : document;
      const target = root?.querySelector(args.selector) as HTMLElement | null;
      if (!target) {
        return {
          found: false,
          visible: false,
          css: {},
          attributes: {},
          matches: {},
        };
      }

      const computed = getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      const visible =
        computed.display !== "none" &&
        computed.visibility !== "hidden" &&
        computed.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0;

      const css = Object.fromEntries(
        args.css.map((name) => [name, computed.getPropertyValue(name)]),
      );
      const attributes = Object.fromEntries(
        args.attributes.map((name) => [name, target.getAttribute(name)]),
      );
      const matches = Object.fromEntries(
        args.matches.map((selector) => [selector, target.matches(selector)]),
      );

      return {
        found: true,
        visible,
        css,
        attributes,
        matches,
      };
    },
    {
      selector: opts.selector,
      rootSelector: opts.rootSelector,
      rootIndex: opts.rootIndex,
      css: opts.css ?? [],
      attributes: opts.attributes ?? [],
      matches: opts.matches ?? [],
    },
  );
}

export async function getClosestToContainerCenter(
  page: any,
  opts: {
    containerSelector: string;
    itemSelector: string;
    textFrom?: "textContent" | "innerText";
  },
): Promise<{ text: string; left: number; right: number } | null> {
  return page.evaluate(
    (args: {
      containerSelector: string;
      itemSelector: string;
      textFrom: "textContent" | "innerText";
    }) => {
      const container = document.querySelector(
        args.containerSelector,
      ) as HTMLElement | null;
      if (!container) return null;
      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.left + containerRect.width / 2;
      const items = Array.from(
        container.querySelectorAll(args.itemSelector),
      ) as HTMLElement[];
      if (items.length === 0) return null;

      const candidates = items.map((el) => {
        const r = el.getBoundingClientRect();
        const itemCenter = r.left + r.width / 2;
        const text =
          args.textFrom === "innerText"
            ? (el.innerText || "").trim()
            : (el.textContent || "").trim();
        return {
          text,
          left: r.left,
          right: r.right,
          dist: Math.abs(itemCenter - centerX),
        };
      });
      candidates.sort((a, b) => a.dist - b.dist);
      const best = candidates[0];
      return {
        text: best.text,
        left: best.left,
        right: best.right,
      };
    },
    {
      containerSelector: opts.containerSelector,
      itemSelector: opts.itemSelector,
      textFrom: opts.textFrom ?? "textContent",
    },
  );
}

export async function findSelectByOptionValues(
  page: any,
  opts: {
    rootSelector: string;
    requiredValues: Array<string | number>;
    minOptions?: number;
  },
): Promise<number | null> {
  return page.evaluate(
    (args: {
      rootSelector: string;
      requiredValues: string[];
      minOptions: number;
    }) => {
      const root = document.querySelector(
        args.rootSelector,
      ) as HTMLElement | null;
      if (!root) return null;
      const selects = Array.from(root.querySelectorAll("select"));
      return selects.findIndex((select) => {
        const values = Array.from((select as HTMLSelectElement).options).map(
          (option) => option.value,
        );
        return (
          values.length >= args.minOptions &&
          args.requiredValues.every((value) => values.includes(value))
        );
      });
    },
    {
      rootSelector: opts.rootSelector,
      requiredValues: opts.requiredValues.map(String),
      minOptions: opts.minOptions ?? opts.requiredValues.length,
    },
  );
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function createArtifactPath(dir: string, name: string): string {
  ensureDir(dir);
  return path.join(dir, `${sanitizeArtifactName(name)}.png`);
}

type PreviewMatch =
  | string
  | {
      targetSelector: string;
      buttonTextsAll?: string[];
      selectorCounts?: Array<{
        selector: string;
        equals?: number;
        atLeast?: number;
      }>;
    };

/**
 * Find the 0-based index of the first `[data-slot="preview"]` element
 * matching the given criteria.
 *
 * `match` may be either:
 * - a CSS selector that must exist inside the preview, or
 * - a small serializable matcher object scoped by `targetSelector`.
 */
export async function findPreviewIndex(
  page: any,
  match: PreviewMatch,
): Promise<number> {
  const index: number | null =
    typeof match === "string"
      ? await page.evaluate((selector: string) => {
          const previews = Array.from(
            document.querySelectorAll('[data-slot="preview"]'),
          );
          for (let i = 0; i < previews.length; i++) {
            if (previews[i].querySelector(selector)) return i;
          }
          return null;
        }, match)
      : await page.evaluate((criteria: Exclude<PreviewMatch, string>) => {
          const previews = Array.from(
            document.querySelectorAll('[data-slot="preview"]'),
          );
          for (let i = 0; i < previews.length; i++) {
            const target = previews[i].querySelector(criteria.targetSelector);
            if (!target) continue;

            if (criteria.buttonTextsAll && criteria.buttonTextsAll.length > 0) {
              const texts = Array.from(target.querySelectorAll("button")).map(
                (el) => (el.textContent || "").trim(),
              );
              if (
                !criteria.buttonTextsAll.every((text) => texts.includes(text))
              ) {
                continue;
              }
            }

            if (criteria.selectorCounts) {
              const countsSatisfied = criteria.selectorCounts.every((entry) => {
                const count = target.querySelectorAll(entry.selector).length;
                if (entry.equals !== undefined && count !== entry.equals) {
                  return false;
                }
                if (entry.atLeast !== undefined && count < entry.atLeast) {
                  return false;
                }
                return true;
              });
              if (!countsSatisfied) continue;
            }

            return i;
          }
          return null;
        }, match);

  if (index === null) {
    const hint =
      typeof match === "string"
        ? `innerSelector: ${match}`
        : `targetSelector: ${match.targetSelector}`;
    throw new Error(`No [data-slot="preview"] matched — ${hint}`);
  }

  return index;
}

export async function humanHover(
  ctx: TestContext,
  point: { x: number; y: number },
  opts?: {
    label?: string;
    settleMs?: number;
    reinforce?: () => Promise<void>;
  },
): Promise<void> {
  await ctx.annotateHover(point.x, point.y, opts?.label);
  await ctx.page.hover(point.x, point.y);
  await opts?.reinforce?.();
  if ((opts?.settleMs ?? 0) > 0) {
    await ctx.page.waitForTimeout(opts?.settleMs ?? 0);
  }
}
