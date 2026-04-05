import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";

/**
 * Petstore Swagger UI サンプル
 *
 * 対象: https://petstore.swagger.io/
 * テスト対象 API:
 *   - GET /pet/findByStatus  : status パラメータでペットを検索する
 *   - GET /pet/{petId}       : petId を指定してペットを取得する
 *
 * このサンプルで見せたいこと:
 * - Swagger UI の "Try it out" → パラメータ入力 → Execute という典型的な操作フロー
 * - Playwright の標準ロケーター（selfHeal: false）を使った、シンプルで速い E2E
 * - レスポンスコードと Body の内容を assertion で確認する方法
 */

const ORIGIN_URL = "https://petstore.swagger.io/";

/** 指定したオペレーション ID を持つ Swagger UI セクションを開く */
async function expandOperation(page: any, operationId: string): Promise<void> {
  // Swagger UI は各 endpoint を <section data-path="..." data-tag="..."> などで管理している。
  // 最も安定した方法は、operationId 属性を持つ <div id="operations-..."> を探してクリックすること。
  const sectionId = `operations-pet-${operationId}`;
  const section = page.locator(`#${sectionId}`);
  await section.waitFor({ state: "attached", timeout: 15_000 });

  // すでに展開済みの場合は再クリックしない
  const isOpen = await section
    .locator(".opblock-body")
    .isVisible()
    .catch(() => false);
  if (!isOpen) {
    await section.locator(".opblock-summary").click();
    await section
      .locator(".opblock-body")
      .waitFor({ state: "visible", timeout: 10_000 });
  }
}

/** セクション内の "Try it out" ボタンを押して入力モードにする */
async function clickTryItOut(page: any, operationId: string): Promise<void> {
  const section = page.locator(`#operations-pet-${operationId}`);
  const btn = section.locator("button", { hasText: "Try it out" });
  await btn.waitFor({ state: "visible", timeout: 10_000 });
  await btn.click();
}

/** セクション内の "Execute" ボタンを押してリクエストを送信する */
async function clickExecute(page: any, operationId: string): Promise<void> {
  const section = page.locator(`#operations-pet-${operationId}`);
  const btn = section.locator("button", { hasText: "Execute" });
  await btn.waitFor({ state: "visible", timeout: 10_000 });
  await btn.click();
}

/** レスポンスコードが返ってくるまで待ち、コードと Body を返す */
async function waitForResponse(
  page: any,
  operationId: string,
): Promise<{ code: string; body: string }> {
  const section = page.locator(`#operations-pet-${operationId}`);

  // Swagger UI はレスポンスを .live-responses-wrapper 内に表示する
  const responseWrapper = section.locator(".live-responses-wrapper");
  await responseWrapper.waitFor({ state: "visible", timeout: 30_000 });

  const codeEl = responseWrapper.locator(".response-col_status").first();
  await codeEl.waitFor({ state: "visible", timeout: 30_000 });

  const code = await codeEl.textContent();
  const bodyEl = responseWrapper.locator(".microlight").first();
  const body = await bodyEl.textContent().catch(() => "");

  return { code: (code ?? "").trim(), body: (body ?? "").trim() };
}

defineScenarioSuite({
  suiteName: "petstore-swagger-ui E2E",
  originUrl: ORIGIN_URL,
  steps: [
    // ------------------------------------------------------------------
    // Step 1: ページ読み込みと基本確認
    // ------------------------------------------------------------------
    {
      name: "ページを開いて Swagger UI が表示されることを確認する",
      selfHeal: false,
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        // Swagger UI の初期化が終わるまで待つ
        await ctx.page.waitForSelector(".swagger-ui", { timeout: 30_000 });
        await ctx.screenshot("01-page-loaded");

        const title = await ctx.page.title();
        expect(title).toContain("Swagger");

        // ページ上に "Swagger Petstore" という見出しが表示されることを確認
        const pageText = await ctx.page.evaluate(
          () => document.body.innerText ?? "",
        );
        expect(pageText).toContain("Swagger Petstore");
      },
    },

    // ------------------------------------------------------------------
    // Step 2: GET /pet/findByStatus を Try it out で実行する
    //
    // Swagger UI での操作フロー:
    //   1. エンドポイントのセクションを展開する
    //   2. "Try it out" をクリックして入力可能な状態にする
    //   3. status のチェックボックス/select で "available" を選ぶ
    //   4. "Execute" を押してリクエストを送信する
    //   5. レスポンスコードが 200 であることを確認する
    //   6. レスポンス Body が JSON 配列であることを確認する
    // ------------------------------------------------------------------
    {
      name: "GET /pet/findByStatus で status=available を検索して 200 を確認する",
      selfHeal: false,
      run: async (ctx: TestContext) => {
        await expandOperation(ctx.page, "findPetsByStatus");
        await ctx.screenshot("02a-findByStatus-expanded");

        await clickTryItOut(ctx.page, "findPetsByStatus");
        await ctx.screenshot("02b-findByStatus-try-it-out");

        // Swagger UI の findByStatus は <select> で status を選ぶ
        // (古いバージョンはチェックボックス、新しいバージョンは select)
        const section = ctx.page.locator("#operations-pet-findPetsByStatus");

        // select があれば "available" を選択する
        const select = section.locator("select").first();
        const hasSelect = await select.isVisible().catch(() => false);
        if (hasSelect) {
          await select.selectOption("available");
        } else {
          // チェックボックス形式の場合: まず全チェックを外し "available" だけ付ける
          const checkboxes = section.locator("input[type='checkbox']");
          const count = await checkboxes.count();
          for (let i = 0; i < count; i++) {
            const cb = checkboxes.nth(i);
            const checked = await cb.isChecked();
            const label = await cb
              .locator("..")
              .textContent()
              .catch(() => "");
            if (label.includes("available") && !checked) {
              await cb.check();
            } else if (!label.includes("available") && checked) {
              await cb.uncheck();
            }
          }
        }

        await ctx.screenshot("02c-findByStatus-params-set");

        await clickExecute(ctx.page, "findPetsByStatus");
        await ctx.screenshot("02d-findByStatus-executed");

        const { code, body } = await waitForResponse(
          ctx.page,
          "findPetsByStatus",
        );
        await ctx.screenshot("02e-findByStatus-response");

        // HTTP 200 が返ること
        expect(code).toBe("200");

        // Body が JSON 配列の形式であること（"[" で始まる）
        expect(body.startsWith("[")).toBe(true);
      },
    },

    // ------------------------------------------------------------------
    // Step 3: GET /pet/{petId} に petId=1 を入力して実行する
    //
    // Swagger UI での操作フロー:
    //   1. エンドポイントのセクションを展開する
    //   2. "Try it out" をクリック
    //   3. petId の input に "1" を入力する
    //   4. "Execute" を押す
    //   5. レスポンスコードが 200 または 404 であることを確認する
    //      (petId=1 はサーバーの状態によって存在しないこともある)
    //   6. Body が JSON オブジェクトの形式であること、または "Pet not found" メッセージを確認する
    // ------------------------------------------------------------------
    {
      name: "GET /pet/{petId} に petId=1 を入力してレスポンスを確認する",
      selfHeal: false,
      run: async (ctx: TestContext) => {
        const PET_ID = "1";

        await expandOperation(ctx.page, "getPetById");
        await ctx.screenshot("03a-getPetById-expanded");

        await clickTryItOut(ctx.page, "getPetById");
        await ctx.screenshot("03b-getPetById-try-it-out");

        // petId の入力欄を探して入力する
        const section = ctx.page.locator("#operations-pet-getPetById");
        const petIdInput = section.locator("input[placeholder='petId']");
        await petIdInput.waitFor({ state: "visible", timeout: 10_000 });
        await petIdInput.fill(PET_ID);
        await ctx.screenshot("03c-getPetById-params-set");

        await clickExecute(ctx.page, "getPetById");
        await ctx.screenshot("03d-getPetById-executed");

        const { code, body } = await waitForResponse(ctx.page, "getPetById");
        await ctx.screenshot("03e-getPetById-response");

        // petId=1 はサーバーの状態によって 200 / 404 どちらもあり得る
        expect(["200", "404"]).toContain(code);

        if (code === "200") {
          // 200 の場合: JSON オブジェクトが返り、id フィールドを含む
          expect(body.startsWith("{")).toBe(true);
          expect(body).toContain('"id"');
        } else {
          // 404 の場合: "Pet not found" メッセージが含まれる
          expect(body.toLowerCase()).toContain("not found");
        }
      },
    },
  ],
});
