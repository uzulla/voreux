import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";

/**
 * Petstore Swagger UI サンプル
 *
 * 対象: https://petstore.swagger.io/
 * テスト対象 API:
 *   - GET /pet/findByStatus
 *   - GET /pet/{petId}
 *
 * 重要:
 * - ctx.page は Stagehand 経由の page オブジェクトであり、Playwright full API とは異なる
 * - このサンプルでは、Swagger UI を「普通のフォーム」ではなく
 *   DOM 観察 + 座標 click + type で扱う
 * - cookie banner を閉じないと opblock クリックが通らないことがある
 * - response を取るときも、思い込みで wrapper を決めず、実際に現れる DOM を観察して待機条件を決める
 */

const ORIGIN_URL = "https://petstore.swagger.io/";

async function pollUntil(
  page: any,
  fn: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 300,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await page.waitForTimeout(intervalMs);
  }
  return false;
}

async function getPageText(page: any): Promise<string> {
  return page.evaluate(() => document.body.innerText ?? "");
}

async function dismissCookieBanner(page: any): Promise<void> {
  const box = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").toLowerCase().includes("allow all cookies"),
    ) as HTMLElement | undefined;
    if (!button) return null;
    const r = button.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  if (!box) return;

  await page.click(
    Math.round(box.x + box.width / 2),
    Math.round(box.y + box.height / 2),
  );
  await page.waitForTimeout(1000);
}

async function waitForSwaggerPetstore(page: any): Promise<void> {
  const ok = await pollUntil(
    page,
    async () => {
      const text = await getPageText(page);
      return text.includes("Swagger Petstore");
    },
    30_000,
    500,
  );
  if (!ok) throw new Error("Swagger Petstore UI did not become ready in time");
}

async function getSummaryBox(
  page: any,
  operationId: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.evaluate((id: string) => {
    const el = document.querySelector(
      `#operations-pet-${id} .opblock-summary`,
    ) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, operationId);

  if (!box) {
    throw new Error(`summary box not found for operation: ${operationId}`);
  }

  return box;
}

async function isOperationOpen(
  page: any,
  operationId: string,
): Promise<boolean> {
  return page.evaluate((id: string) => {
    const section = document.querySelector(`#operations-pet-${id}`);
    return section?.classList.contains("is-open") ?? false;
  }, operationId);
}

/**
 * Swagger UI の opblock を開く。
 *
 * ここでの教訓:
 * - `.opblock-body` の存在だけでは開閉判定に使えない
 * - このサイトでは `is-open` class の方が信頼できた
 * - summary 要素は座標 click の方が安定した
 */
async function expandOperation(page: any, operationId: string): Promise<void> {
  const exists = await pollUntil(
    page,
    () =>
      page.evaluate(
        (id: string) => !!document.querySelector(`#operations-pet-${id}`),
        operationId,
      ),
    15_000,
  );
  if (!exists) throw new Error(`operation not found: ${operationId}`);

  if (await isOperationOpen(page, operationId)) return;

  await page.evaluate((id: string) => {
    document
      .querySelector(`#operations-pet-${id}`)
      ?.scrollIntoView({ block: "center", behavior: "instant" });
  }, operationId);
  await page.waitForTimeout(500);

  const box = await getSummaryBox(page, operationId);
  await page.click(
    Math.round(box.x + box.width / 2),
    Math.round(box.y + box.height / 2),
  );

  const opened = await pollUntil(
    page,
    () => isOperationOpen(page, operationId),
    10_000,
  );
  if (!opened) throw new Error(`operation did not open: ${operationId}`);
}

async function getButtonBox(
  page: any,
  operationId: string,
  textNeedle: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.evaluate(
    (args: { id: string; text: string }) => {
      const section = document.querySelector(`#operations-pet-${args.id}`);
      const button = Array.from(section?.querySelectorAll("button") ?? []).find(
        (b) =>
          (b.textContent ?? "").toLowerCase().includes(args.text.toLowerCase()),
      ) as HTMLElement | undefined;
      if (!button) return null;
      const r = button.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },
    { id: operationId, text: textNeedle },
  );

  if (!box) {
    throw new Error(`button not found: ${textNeedle} for ${operationId}`);
  }

  return box;
}

async function clickButton(
  page: any,
  operationId: string,
  textNeedle: string,
): Promise<void> {
  const box = await getButtonBox(page, operationId, textNeedle);
  await page.click(
    Math.round(box.x + box.width / 2),
    Math.round(box.y + box.height / 2),
  );
  await page.waitForTimeout(500);
}

async function setFindByStatusAvailable(page: any): Promise<void> {
  const ok = await page.evaluate(() => {
    const section = document.querySelector("#operations-pet-findPetsByStatus");
    const select = section?.querySelector("select") as HTMLSelectElement | null;
    if (select) {
      select.value = "available";
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  });

  if (!ok) {
    throw new Error("status select not found for findPetsByStatus");
  }
}

async function setPetId(page: any, petId: string): Promise<void> {
  const box = await page.evaluate(() => {
    const input = document.querySelector(
      "#operations-pet-getPetById input[placeholder='petId']",
    ) as HTMLElement | null;
    if (!input) return null;
    const r = input.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  if (!box) {
    throw new Error("petId input not found");
  }

  await page.click(
    Math.round(box.x + box.width / 2),
    Math.round(box.y + box.height / 2),
  );
  await page.type(petId);
  await page.waitForTimeout(300);
}

/**
 * Execute 後のレスポンスを待つ。
 *
 * 初期実装では `.live-responses-wrapper` を前提にしていたが、
 * 現物観察では `.response-col_status` / `.microlight` の方が安定して取得できた。
 * そのため、この helper では「実際に観測できた DOM」を待機条件にしている。
 */
async function waitForResponse(
  page: any,
  operationId: string,
): Promise<{ code: string; body: string }> {
  const ok = await pollUntil(
    page,
    () =>
      page.evaluate((id: string) => {
        const section = document.querySelector(`#operations-pet-${id}`);
        const codes = Array.from(
          section?.querySelectorAll(".response-col_status") ?? [],
        )
          .map((el) => (el.textContent ?? "").trim())
          .filter(Boolean)
          .filter((text) => text !== "Code");
        return codes.length > 0;
      }, operationId),
    30_000,
    500,
  );

  if (!ok) {
    throw new Error(`response did not appear for operation: ${operationId}`);
  }

  return page.evaluate((id: string) => {
    const section = document.querySelector(`#operations-pet-${id}`);
    const codes = Array.from(
      section?.querySelectorAll(".response-col_status") ?? [],
    )
      .map((el) => (el.textContent ?? "").trim())
      .filter(Boolean)
      .filter((text) => text !== "Code");
    const bodies = Array.from(section?.querySelectorAll(".microlight") ?? [])
      .map((el) => (el.textContent ?? "").trim())
      .filter(Boolean);

    return {
      code: codes[0] ?? "",
      body:
        bodies.find((text) => text.startsWith("[") || text.startsWith("{")) ??
        "",
    };
  }, operationId);
}

defineScenarioSuite({
  suiteName: "petstore-swagger-ui E2E",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "ページを開いて Swagger UI が表示されることを確認する",
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector(".swagger-ui", { timeout: 30_000 });
        await ctx.page.waitForTimeout(3000);
        await dismissCookieBanner(ctx.page);
        await waitForSwaggerPetstore(ctx.page);
        await ctx.screenshot("01-page-loaded");

        const title = await ctx.page.title();
        expect(title).toContain("Swagger");

        const pageText = await getPageText(ctx.page);
        expect(pageText).toContain("Swagger Petstore");
        expect(pageText).toContain("/pet/findByStatus");
        expect(pageText).toContain("Finds Pets by status");
        expect(pageText).toContain("/pet/{petId}");
        expect(pageText).toContain("Find pet by ID");
      },
    },
    {
      name: "findByStatus を status=available で実行して 200 を確認する",
      run: async (ctx: TestContext) => {
        await expandOperation(ctx.page, "findPetsByStatus");
        await ctx.screenshot("02a-findByStatus-expanded");

        await clickButton(ctx.page, "findPetsByStatus", "Try it out");
        await setFindByStatusAvailable(ctx.page);
        await ctx.screenshot("02b-findByStatus-params-set");

        await clickButton(ctx.page, "findPetsByStatus", "Execute");
        const { code, body } = await waitForResponse(
          ctx.page,
          "findPetsByStatus",
        );
        await ctx.screenshot("02c-findByStatus-response");

        expect(code).toBe("200");
        expect(body.startsWith("[")).toBe(true);
        expect(body).toContain("status");
      },
    },
    {
      name: "getPetById に petId=1 を入力してレスポンスを確認する",
      run: async (ctx: TestContext) => {
        await expandOperation(ctx.page, "getPetById");
        await ctx.screenshot("03a-getPetById-expanded");

        await clickButton(ctx.page, "getPetById", "Try it out");
        await setPetId(ctx.page, "1");
        await ctx.screenshot("03b-getPetById-params-set");

        await clickButton(ctx.page, "getPetById", "Execute");
        const { code, body } = await waitForResponse(ctx.page, "getPetById");
        await ctx.screenshot("03c-getPetById-response");

        expect(["200", "404"]).toContain(code);
        if (code === "200") {
          expect(body.startsWith("{")).toBe(true);
          expect(body).toContain('"id"');
        } else {
          expect(body.toLowerCase()).toContain("not found");
        }
      },
    },
  ],
});
