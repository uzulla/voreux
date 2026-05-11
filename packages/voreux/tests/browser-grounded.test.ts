import { describe, expect, it } from "vitest";
import { findPreviewIndex } from "../src/index.js";

type PreviewSpec = {
  selectors?: string[];
  buttonTexts?: string[];
  counts?: Record<string, number>;
};

function createMockElement(spec: PreviewSpec) {
  const element = {
    querySelector(selector: string) {
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
      const count = spec.counts?.[selector] ?? 0;
      return Array.from({ length: count }, () => createMockElement({}));
    },
  };

  return element;
}

function mockPage(previews: PreviewSpec[]) {
  function createPreview(spec: PreviewSpec) {
    return createMockElement(spec);
  }

  return {
    async evaluate(fn: (...args: any[]) => any, arg?: unknown) {
      const fakeDocument = {
        querySelectorAll(selector: string) {
          if (selector === '[data-slot="preview"]') {
            return previews.map(createPreview);
          }
          return [];
        },
      };

      const globals = globalThis as typeof globalThis & {
        document?: unknown;
        Function: typeof Function;
      };
      const originalDocument = globals.document;
      const originalFunction = globals.Function;

      globals.document = fakeDocument;
      // biome-ignore lint/complexity/useArrowFunction: constructable test shim
      globals.Function = function (body: string) {
        const match = body.match(/^return \((.*)\);$/s);
        if (!match) {
          return originalFunction(body);
        }
        // biome-ignore lint/security/noGlobalEval: test-only predicate shim
        return () => eval(`(${match[1]})`);
      } as typeof Function;

      try {
        return arg === undefined ? fn() : fn(arg);
      } finally {
        if (originalDocument === undefined) {
          delete globals.document;
        } else {
          globals.document = originalDocument;
        }
        globals.Function = originalFunction;
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
