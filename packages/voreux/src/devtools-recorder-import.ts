type RecorderStep = {
  type: string;
  [key: string]: unknown;
};

export interface DevToolsRecorderDocument {
  title?: string;
  steps: RecorderStep[];
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid or missing string field: ${field}`);
  }
  return value;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid or missing numeric field: ${field}`);
  }
  return value;
}

function asStringArrayMatrix(value: unknown, field: string): string[][] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid or missing selector matrix: ${field}`);
  }
  return value.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      throw new Error(`Invalid selector row at ${field}[${rowIndex}]`);
    }
    return row.map((entry, colIndex) => {
      if (typeof entry !== "string") {
        throw new Error(
          `Invalid selector entry at ${field}[${rowIndex}][${colIndex}]`,
        );
      }
      return entry;
    });
  });
}

export function parseDevToolsRecorderJson(
  input: string,
): DevToolsRecorderDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new Error(
      `Failed to parse DevTools Recorder JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Recorder JSON must be an object");
  }

  const doc = parsed as { title?: unknown; steps?: unknown };
  if (!Array.isArray(doc.steps)) {
    throw new Error("Recorder JSON must contain a steps array");
  }

  return {
    title: typeof doc.title === "string" ? doc.title : undefined,
    steps: doc.steps.map((step, index) => {
      if (!step || typeof step !== "object") {
        throw new Error(`Invalid step at index ${index}`);
      }
      const typedStep = step as RecorderStep;
      if (typeof typedStep.type !== "string" || typedStep.type.length === 0) {
        throw new Error(`Invalid step.type at index ${index}`);
      }
      return typedStep;
    }),
  };
}

function escapeText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("${", "\\${");
}

function toJsString(value: string): string {
  return JSON.stringify(value);
}

function sanitizeName(value: string): string {
  const compact = value.trim().replace(/\s+/g, " ");
  return compact.length > 0 ? compact : "Generated scenario";
}

function titleToSuiteName(
  title: string | undefined,
  originUrl: string,
): string {
  if (title && title.trim().length > 0) {
    return sanitizeName(title);
  }
  try {
    const url = new URL(originUrl);
    return sanitizeName(`${url.hostname} imported scenario`);
  } catch {
    return "Imported DevTools Recorder scenario";
  }
}

function choosePrimarySelector(selectors: string[][]): string {
  const flat = selectors.flat();
  if (flat.length === 0) {
    throw new Error("No selectors found for step");
  }
  return flat[0];
}

function selectorsComment(selectors: string[][]): string[] {
  return selectors
    .flat()
    .map((selector) => `      // - ${escapeText(selector)}`);
}

function buildSelectorLocator(selector: string): string {
  if (selector.startsWith("aria/")) {
    return `ctx.page.getByLabel(${toJsString(selector.slice(5))})`;
  }
  if (selector.startsWith("xpath//")) {
    return `ctx.page.locator(${toJsString(`xpath=${selector.slice(5)}`)})`;
  }
  if (selector.startsWith("xpath/")) {
    return `ctx.page.locator(${toJsString(`xpath=${selector.slice(6)}`)})`;
  }
  if (selector.startsWith("pierce/")) {
    return `ctx.page.locator(${toJsString(selector.slice(7))})`;
  }
  return `ctx.page.locator(${toJsString(selector)})`;
}

function buildStepCode(step: RecorderStep, index: number): string {
  const stepNo = String(index + 1).padStart(2, "0");

  switch (step.type) {
    case "setViewport": {
      const width = asNumber(step.width, "width");
      const height = asNumber(step.height, "height");
      return `    {
      name: ${toJsString(`${stepNo}. Set viewport`)},
      selfHeal: false,
      run: async (ctx) => {
        await ctx.page.setViewportSize({ width: ${width}, height: ${height} });
        // TODO: adjust viewport strategy if this scenario should run responsively.
      },
    }`;
    }
    case "navigate": {
      const url = asString(step.url, "url");
      return `    {
      name: ${toJsString(`${stepNo}. Navigate to page`)},
      selfHeal: false,
      run: async (ctx) => {
        await ctx.page.goto(${toJsString(url)});
        await ctx.page.waitForLoadState("networkidle");
        await ctx.screenshot(${toJsString(`${stepNo}-navigate`)});
        // TODO: add assertions for the expected happy-path landing state.
      },
    }`;
    }
    case "click": {
      const selectors = asStringArrayMatrix(step.selectors, "selectors");
      const primarySelector = choosePrimarySelector(selectors);
      const locator = buildSelectorLocator(primarySelector);
      const comments = selectorsComment(selectors).join("\n");
      return `    {
      name: ${toJsString(`${stepNo}. Click recorded target`)},
      run: async (ctx) => {
${comments}
        await ${locator}.click();
        await ctx.page.waitForLoadState("networkidle").catch(() => {});
        await ctx.screenshot(${toJsString(`${stepNo}-click`)});
        // TODO: confirm where this click is supposed to navigate or what should change.
      },
    }`;
    }
    case "change":
    case "type": {
      const selectors = asStringArrayMatrix(step.selectors, "selectors");
      const primarySelector = choosePrimarySelector(selectors);
      const locator = buildSelectorLocator(primarySelector);
      const value =
        typeof step.value === "string"
          ? step.value
          : asString(step.text, "text");
      const comments = selectorsComment(selectors).join("\n");
      return `    {
      name: ${toJsString(`${stepNo}. Fill recorded input`)},
      run: async (ctx) => {
${comments}
        await ${locator}.fill(${toJsString(value)});
        await ctx.screenshot(${toJsString(`${stepNo}-fill`)});
        // TODO: confirm this input value and any validation state that should appear.
      },
    }`;
    }
    case "select": {
      const selectors = asStringArrayMatrix(step.selectors, "selectors");
      const primarySelector = choosePrimarySelector(selectors);
      const locator = buildSelectorLocator(primarySelector);
      const value = asString(step.value, "value");
      const comments = selectorsComment(selectors).join("\n");
      return `    {
      name: ${toJsString(`${stepNo}. Select recorded option`)},
      run: async (ctx) => {
${comments}
        await ${locator}.selectOption(${toJsString(value)});
        await ctx.screenshot(${toJsString(`${stepNo}-select`)});
        // TODO: confirm the selected state or resulting navigation.
      },
    }`;
    }
    case "waitForElement": {
      const selectors = asStringArrayMatrix(step.selectors, "selectors");
      const primarySelector = choosePrimarySelector(selectors);
      const locator = buildSelectorLocator(primarySelector);
      const comments = selectorsComment(selectors).join("\n");
      return `    {
      name: ${toJsString(`${stepNo}. Wait for recorded element`)},
      run: async (ctx) => {
${comments}
        await ${locator}.waitFor();
        await ctx.screenshot(${toJsString(`${stepNo}-wait`)});
        // TODO: decide whether this wait should become an assertion instead.
      },
    }`;
    }
    default:
      throw new Error(`Unsupported DevTools Recorder step type: ${step.type}`);
  }
}

export function generateDraftScenarioFromRecorder(
  doc: DevToolsRecorderDocument,
): string {
  if (doc.steps.length === 0) {
    throw new Error("Recorder JSON does not contain any steps");
  }

  const navigateStep = doc.steps.find((step) => step.type === "navigate");
  if (!navigateStep) {
    throw new Error("Recorder JSON must contain at least one navigate step");
  }

  const originUrl = asString(navigateStep.url, "navigate.url");
  const suiteName = titleToSuiteName(doc.title, originUrl);
  const steps = doc.steps
    .map((step, index) => buildStepCode(step, index))
    .join(",\n\n");

  return `import { defineScenarioSuite } from "@uzulla/voreux";

const ORIGIN_URL = ${toJsString(originUrl)};

// Generated from Chrome DevTools Recorder JSON.
// Purpose: create a happy-path E2E draft scaffold that humans or agents can refine.
// This scaffold captures recorded browser actions, but assertions and observation points
// still need to be added explicitly.

defineScenarioSuite({
  suiteName: ${toJsString(suiteName)},
  originUrl: ORIGIN_URL,
  steps: [
${steps}
  ],
});
`;
}
