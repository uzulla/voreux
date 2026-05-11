import { describe, expect, it } from "vitest";
import { findPreviewIndex, readElementVisualState } from "../src/index.js";

type ElementSpec = {
  selectors?: string[];
  buttonTexts?: string[];
  counts?: Record<string, number>;
  children?: Record<string, ElementSpec>;
  computedStyle?: Record<string, string>;
  attributes?: Record<string, string | null>;
  matches?: Record<string, boolean>;
  rect?: { width: number; height: number };
};

function createMockElement(spec: ElementSpec) {
  const element = {
    __spec: spec,
    querySelector(selector: string) {
      if (spec.children?.[selector]) {
        return createMockElement(spec.children[selector]);
      }
      return spec.selectors?.includes(selector)
        ? createMockElement(spec)
        : null;
    },
    querySelectorAll(selector: string) {
      if (selector === "button") {
        return (spec.buttonTexts ?? []).map((text) => ({
          textContent: text,
        }));
      }
      if (spec.children?.[selector]) {
        return [createMockElement(spec.children[selector])];
      }
      const count = spec.counts?.[selector] ?? 0;
      return Array.from({ length: count }, () => createMockElement({}));
    },
    getBoundingClientRect() {
      return {
        width: spec.rect?.width ?? 10,
        height: spec.rect?.height ?? 10,
      };
    },
    getAttribute(name: string) {
      return spec.attributes?.[name] ?? null;
    },
    matches(selector: string) {
      return spec.matches?.[selector] ?? false;
    },
  };

  return element;
}

function mockPage(previews: ElementSpec[]) {
  return {
    async evaluate(fn: (...args: any[]) => any, arg?: unknown) {
      const fakeDocument = {
        querySelectorAll(selector: string) {
          if (selector === '[data-slot="preview"]') {
            return previews.map((preview) => createMockElement(preview));
          }
          return [];
        },
        querySelector(selector: string) {
          return selector === '[data-slot="standalone"]'
            ? createMockElement({
                computedStyle: {
                  display: "block",
                  visibility: "visible",
                  opacity: "1",
                  color: "rgb(1, 2, 3)",
                },
                rect: { width: 20, height: 20 },
              })
            : null;
        },
      };

      const globals = globalThis as typeof globalThis & {
        document?: unknown;
        getComputedStyle?: (element: { __spec?: ElementSpec }) => {
          display: string;
          visibility: string;
          opacity: string;
          getPropertyValue: (name: string) => string;
        };
      };
      const originalDocument = globals.document;
      const originalGetComputedStyle = globalThis.getComputedStyle;

      globals.document = fakeDocument;
      globalThis.getComputedStyle = ((element: { __spec?: ElementSpec }) => {
        const computed = element.__spec?.computedStyle ?? {};
        return {
          display: computed.display ?? "block",
          visibility: computed.visibility ?? "visible",
          opacity: computed.opacity ?? "1",
          getPropertyValue(name: string) {
            return computed[name] ?? "";
          },
        };
      }) as typeof globalThis.getComputedStyle;

      try {
        return arg === undefined ? fn() : fn(arg);
      } finally {
        if (originalDocument === undefined) {
          delete globals.document;
        } else {
          globals.document = originalDocument;
        }
        globalThis.getComputedStyle = originalGetComputedStyle;
      }
    },
  };
}

describe("findPreviewIndex", () => {
  it("returns index of first preview containing the selector", async () => {
    const page = mockPage([
      { selectors: ['[data-slot="tooltip"]'] },
      { selectors: ['[data-slot="calendar"]'] },
      { selectors: ['[data-slot="calendar"]'] },
    ]);

    await expect(
      findPreviewIndex(page, '[data-slot="calendar"]'),
    ).resolves.toBe(1);
  });

  it("returns index of first preview matching structured criteria", async () => {
    const page = mockPage([
      { selectors: ['[data-slot="button-group"]'], buttonTexts: ["Other"] },
      {
        selectors: ['[data-slot="button-group"]'],
        buttonTexts: ["Archive", "Report", "Snooze"],
      },
    ]);

    await expect(
      findPreviewIndex(page, {
        targetSelector: '[data-slot="button-group"]',
        buttonTextsAll: ["Archive", "Report", "Snooze"],
      }),
    ).resolves.toBe(1);
  });

  it("supports selector count constraints", async () => {
    const page = mockPage([
      {
        selectors: ['[data-slot="calendar"][data-mode="single"]'],
        counts: { 'table[role="grid"]': 2, select: 2 },
      },
      {
        selectors: ['[data-slot="calendar"][data-mode="single"]'],
        counts: { 'table[role="grid"]': 1, select: 2 },
      },
    ]);

    await expect(
      findPreviewIndex(page, {
        targetSelector: '[data-slot="calendar"][data-mode="single"]',
        selectorCounts: [
          { selector: 'table[role="grid"]', equals: 1 },
          { selector: "select", atLeast: 2 },
        ],
      }),
    ).resolves.toBe(1);
  });

  it("throws when no preview matches", async () => {
    const page = mockPage([{ selectors: ['[data-slot="tooltip"]'] }]);

    await expect(
      findPreviewIndex(page, '[data-slot="calendar"]'),
    ).rejects.toThrow('No [data-slot="preview"] matched');
  });
});

describe("readElementVisualState", () => {
  it("reads css, attributes, matches, and visibility inside a preview root", async () => {
    const page = mockPage([
      {},
      {
        children: {
          '[data-slot="button-group"]': {
            children: {
              'button[data-test="archive"]': {
                computedStyle: {
                  display: "block",
                  visibility: "visible",
                  opacity: "0.5",
                  "background-color": "rgb(0, 0, 0)",
                  color: "rgb(255, 255, 255)",
                },
                attributes: { disabled: "" },
                matches: { ":hover": true },
                rect: { width: 24, height: 24 },
              },
            },
          },
          'button[data-test="archive"]': {
            computedStyle: {
              display: "block",
              visibility: "visible",
              opacity: "0.5",
              "background-color": "rgb(0, 0, 0)",
              color: "rgb(255, 255, 255)",
            },
            attributes: { disabled: "" },
            matches: { ":hover": true },
            rect: { width: 24, height: 24 },
          },
        },
      },
    ]);

    const state = await readElementVisualState(page, {
      rootSelector: '[data-slot="preview"]',
      rootIndex: 1,
      selector: 'button[data-test="archive"]',
      css: ["background-color", "color", "opacity"],
      attributes: ["disabled"],
      matches: [":hover"],
    });

    expect(state.found).toBe(true);
    expect(state.visible).toBe(true);
    expect(state.css["background-color"]).toBe("rgb(0, 0, 0)");
    expect(state.css.color).toBe("rgb(255, 255, 255)");
    expect(state.css.opacity).toBe("0.5");
    expect(state.attributes.disabled).toBe("");
    expect(state.matches[":hover"]).toBe(true);
  });

  it("returns not found state when target is missing", async () => {
    const page = mockPage([{}]);

    const state = await readElementVisualState(page, {
      rootSelector: '[data-slot="preview"]',
      rootIndex: 0,
      selector: '[data-slot="missing"]',
      css: ["color"],
      attributes: ["disabled"],
      matches: [":hover"],
    });

    expect(state.found).toBe(false);
    expect(state.visible).toBe(false);
    expect(state.css).toEqual({});
    expect(state.attributes).toEqual({});
    expect(state.matches).toEqual({});
  });
});
