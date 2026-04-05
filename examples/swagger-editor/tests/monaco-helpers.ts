/**
 * Monaco editor helper utilities for the swagger-editor sample.
 *
 * Why this file exists:
 * - Monaco is not a plain <input> / <textarea> UI.
 * - Stagehand's Page API is Playwright-like in some places, but not identical.
 * - To make this sample readable and reusable as documentation, we isolate the
 *   "special handling" for Monaco here instead of scattering it in the test body.
 *
 * Notes learned during investigation:
 * - `ctx.page.click()` in Stagehand is a coordinate click API, not
 *   `page.click(selector, options)` like Playwright.
 * - For Monaco, we first locate the editor box in the DOM, then convert a
 *   relative click target into page coordinates.
 * - For this hosted swagger editor, clicking near the title line and then using
 *   `page.type()` is enough to insert text into Monaco in a human-like way.
 */

export async function ensureMonacoIsVisible(page: any): Promise<void> {
  await page.waitForSelector(".monaco-editor", { timeout: 20_000 });
}

/**
 * Returns the Monaco editor bounding box in viewport coordinates.
 *
 * We use page.evaluate() because Stagehand's Page API does not expose the same
 * locator bounding-box API shape we would normally rely on in Playwright code.
 */
export async function getMonacoBox(
  page: any,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.evaluate(() => {
    const el = document.querySelector(".monaco-editor") as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  if (!box) {
    throw new Error("Monaco editor not found");
  }

  return box;
}

/**
 * Click near the title line inside Monaco.
 *
 * This is intentionally coordinate-based and a bit "special":
 * during investigation we found that a click around this location reliably puts
 * the caret into the title line area on the hosted swagger editor sample.
 *
 * The important thing for future readers:
 * - This is not a universal Monaco trick.
 * - It is a pragmatic, human-like click position for this concrete sample page.
 */
export async function placeCaretNearSwaggerTitleLine(page: any): Promise<void> {
  const box = await getMonacoBox(page);
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  const clickX = clamp(box.x + 180, box.x, box.x + box.width - 1);
  const clickY = clamp(box.y + 55, box.y, box.y + box.height - 1);

  await page.click(Math.round(clickX), Math.round(clickY));
}

/**
 * Human-like Monaco edit for this sample.
 *
 * We deliberately avoid DOM value rewriting or model.setValue()-style shortcuts.
 * The goal is to demonstrate that Voreux/Stagehand can drive a non-standard
 * editor widget in an E2E-ish way.
 */
export async function appendTextIntoMonacoAtCurrentCaret(
  page: any,
  text: string,
): Promise<void> {
  await page.type(text, { delay: 50 });
}

/**
 * Probe helper used for assertions.
 *
 * `document.body.innerText` is useful as a high-level "did the UI visibly
 * change?" signal, while `.view-lines` is Monaco-specific and tells us whether
 * the editor rendering itself changed.
 */
export async function readMonacoProbe(
  page: any,
  expectedText: string,
  containerSelector = ".view-lines",
): Promise<{
  bodyHasInsertedText: boolean;
  viewText: string;
}> {
  return page.evaluate(
    (args: { selector: string; text: string }) => {
      const container = document.querySelector(args.selector);
      const containerText = (container?.textContent || "").slice(0, 500);
      return {
        bodyHasInsertedText: (document.body.innerText || "").includes(
          args.text,
        ),
        viewText: containerText,
      };
    },
    { selector: containerSelector, text: expectedText },
  );
}
