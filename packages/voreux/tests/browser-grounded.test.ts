import { describe, expect, it } from "vitest";
import { findPreviewIndex } from "../src/index.js";

type PreviewSpec = {
  selectors?: string[];
  buttonTexts?: string[];
};

function mockPage(previews: PreviewSpec[]) {
  function createPreview(spec: PreviewSpec) {
    const preview = {
      querySelector(selector: string) {
        return spec.selectors?.includes(selector) ? preview : null;
      },
      querySelectorAll(selector: string) {
        if (selector === "button") {
          return (spec.buttonTexts ?? []).map((text) => ({
            textContent: text,
          }));
        }
        return [];
      },
    };

    return preview;
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

  it("returns index of first preview passing predicate", async () => {
    const page = mockPage([
      { selectors: ['[data-slot="button-group"]'], buttonTexts: ["Other"] },
      {
        selectors: ['[data-slot="button-group"]'],
        buttonTexts: ["Archive", "Report", "Snooze"],
      },
    ]);

    await expect(
      findPreviewIndex(page, (preview) => {
        const group = preview.querySelector(
          '[data-slot="button-group"]',
        ) as Element | null;
        if (!group) return false;
        const texts = Array.from(group.querySelectorAll("button")).map((el) =>
          (el.textContent || "").trim(),
        );
        return (
          texts.includes("Archive") &&
          texts.includes("Report") &&
          texts.includes("Snooze")
        );
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
