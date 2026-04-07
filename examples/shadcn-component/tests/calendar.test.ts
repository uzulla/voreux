import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";
import {
  getDateCellClickPoint,
  getSafeDaysToClick,
  getSelectedDay,
  screenshotCalendarRegion,
  scrollCalendarIntoView,
} from "./calendar-helpers.js";
import {
  compareWithBaseline,
  saveBaseline,
} from "./calendar-visual-compare.js";

// カスタム VRT（calendar-visual-compare.ts）を使う理由:
// ctx.assertNoVisualRegression() は full-page スクリーンショットを前提とするが、
// hosted docs ページは calendar 以外にも多数のデモがあり、full-page 比較では
// 無関係な領域の変化がノイズになる。calendar 要素だけを clip した部分スクリーンショットで
// 比較する必要があるため、screenshotCalendarRegion() + compareWithBaseline() を使用。
const ORIGIN_URL = "https://ui.shadcn.com/docs/components/radix/calendar";
const BASELINES_DIR = process.env.E2E_BASELINES_DIR
  ? path.resolve(process.cwd(), process.env.E2E_BASELINES_DIR)
  : fileURLToPath(new URL("../baselines/", import.meta.url));

defineScenarioSuite({
  suiteName: "shadcn-component E2E (calendar)",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "日付をクリックするとカレンダーの見た目が変わる",
      selfHeal: false,
      // human-visible 判断: クリックした日にグレー丸背景が出現する。
      // subtle だが静止画で確認済み（薄いグレーリング）。
      // annotateClick のマーカーと合わせれば、録画でも変化箇所を追える。
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="preview"]', {
          timeout: 30_000,
        });
        // hosted docs の hydration 完了を待つ（既存 sample 共通パターン）
        await ctx.page.waitForTimeout(3000);
        await scrollCalendarIntoView(ctx.page);

        // recording: 初期状態を full-page で記録
        await ctx.screenshot("calendar-01-initial");

        // 選択前の状態を VRT baseline として撮影
        const beforeShot = await screenshotCalendarRegion(
          ctx.page,
          "calendar-before-select",
        );
        saveBaseline(beforeShot, "calendar-before-select", BASELINES_DIR);

        // today でも現在選択でもない安全な日を選ぶ
        const safeDays = await getSafeDaysToClick(ctx.page);
        const clickPoint = await getDateCellClickPoint(
          ctx.page,
          safeDays.first,
        );
        // recording: annotation で click 位置を見せる（3-step boundary 自動）
        await ctx.annotateClick(
          clickPoint.x,
          clickPoint.y,
          `Click: Day ${safeDays.first}`,
        );
        await ctx.page.click(clickPoint.x, clickPoint.y);
        await ctx.page.waitForTimeout(500);

        // recording: click 後の状態を full-page で記録
        await ctx.screenshot("calendar-01-after-select");

        // 選択後を撮影し、VRT で「見た目が変わった」ことを証明する
        const afterShot = await screenshotCalendarRegion(
          ctx.page,
          "calendar-after-select",
        );
        const diff = compareWithBaseline(
          afterShot,
          "calendar-before-select",
          {
            baselinesDir: BASELINES_DIR,
            diffPath: `${BASELINES_DIR}/calendar-select-diff.png`,
          },
        );
        expect(diff.skipped).toBe(false);
        // selection highlight は subtle（薄いグレーリング）だが、
        // calendar clip 内でセル 1 個分の背景色変化として検出される。
        // 0.001 は clip 全体に対して十分な変化量の下限。
        expect(diff.mismatchRatio).toBeGreaterThan(0.001);
      },
    },
    {
      name: "別の日付をクリックすると選択ハイライトが移動して見える",
      selfHeal: false,
      // human-visible 判断: グレー背景が消える箇所と出現する箇所の 2 点が同時に変わる。
      // 1 箇所だけの変化（シナリオ 1）より空間的に分散しており、録画で追いやすい。
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="preview"]', {
          timeout: 30_000,
        });
        await ctx.page.waitForTimeout(3000);
        await scrollCalendarIntoView(ctx.page);

        const safeDays = await getSafeDaysToClick(ctx.page);

        // recording: 初期状態
        await ctx.screenshot("calendar-02-initial");

        // 1 回目のクリック
        const firstPoint = await getDateCellClickPoint(
          ctx.page,
          safeDays.first,
        );
        await ctx.annotateClick(
          firstPoint.x,
          firstPoint.y,
          `Click: Day ${safeDays.first}`,
        );
        await ctx.page.click(firstPoint.x, firstPoint.y);
        await ctx.page.waitForTimeout(500);

        // recording: 1 回目のクリック後
        await ctx.screenshot("calendar-02-after-first");

        // 1 回目選択後を baseline として保存
        const afterFirstShot = await screenshotCalendarRegion(
          ctx.page,
          "calendar-after-first-select",
        );
        saveBaseline(
          afterFirstShot,
          "calendar-after-first-select",
          BASELINES_DIR,
        );

        // 2 回目のクリック（別の日）
        const secondPoint = await getDateCellClickPoint(
          ctx.page,
          safeDays.second,
        );
        await ctx.annotateClick(
          secondPoint.x,
          secondPoint.y,
          `Click: Day ${safeDays.second}`,
        );
        await ctx.page.click(secondPoint.x, secondPoint.y);
        await ctx.page.waitForTimeout(500);

        // recording: 2 回目のクリック後（ハイライトが移動した状態）
        await ctx.screenshot("calendar-02-after-second");

        // 2 回目選択後を撮影し、「ハイライトが移動した」ことを VRT で証明
        const afterSecondShot = await screenshotCalendarRegion(
          ctx.page,
          "calendar-after-second-select",
        );
        const diff = compareWithBaseline(
          afterSecondShot,
          "calendar-after-first-select",
          {
            baselinesDir: BASELINES_DIR,
            diffPath: `${BASELINES_DIR}/calendar-select-move-diff.png`,
          },
        );
        expect(diff.skipped).toBe(false);
        // 2 箇所（旧選択 + 新選択）が変わるため、シナリオ 1 より mismatch が大きい。
        expect(diff.mismatchRatio).toBeGreaterThan(0.001);
      },
    },
    {
      name: "別の日を選ぶと today の選択状態が外れて見た目が変わる",
      selfHeal: false,
      // human-visible 判断: スクリーンショット確認の結果、today「6」の黒丸スタイル
      // （today 表示）は選択解除後も維持される。実際に変わるのは別の日にグレー背景が
      // 付くこと。旧テスト名「today セルと通常セルの見た目が異なる」は実際の変化と
      // 乖離していたため修正。
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="preview"]', {
          timeout: 30_000,
        });
        await ctx.page.waitForTimeout(3000);
        await scrollCalendarIntoView(ctx.page);

        // recording: today selected 状態
        await ctx.screenshot("calendar-03-today-selected");

        // 初期状態を撮影（today が selected 状態で表示される）
        const initialShot = await screenshotCalendarRegion(
          ctx.page,
          "calendar-with-today",
        );
        saveBaseline(initialShot, "calendar-with-today", BASELINES_DIR);

        // 別の日を選択して today の selected 状態を外す
        const safeDays = await getSafeDaysToClick(ctx.page);
        const clickPoint = await getDateCellClickPoint(
          ctx.page,
          safeDays.first,
        );
        await ctx.annotateClick(
          clickPoint.x,
          clickPoint.y,
          `Click: Day ${safeDays.first}`,
        );
        await ctx.page.click(clickPoint.x, clickPoint.y);
        await ctx.page.waitForTimeout(500);

        // recording: today deselected 状態
        await ctx.screenshot("calendar-03-today-deselected");

        // today の selected が外れた状態を撮影
        const afterShot = await screenshotCalendarRegion(
          ctx.page,
          "calendar-today-deselected",
        );
        const diff = compareWithBaseline(
          afterShot,
          "calendar-with-today",
          {
            baselinesDir: BASELINES_DIR,
            diffPath: `${BASELINES_DIR}/calendar-today-diff.png`,
          },
        );
        expect(diff.skipped).toBe(false);
        expect(diff.mismatchRatio).toBeGreaterThan(0.001);
      },
    },
    {
      name: "元の日に戻ると見た目が初期状態に近い",
      selfHeal: false,
      // human-visible 判断: round-trip テスト。スクリーンショットで initial と
      // returned が視覚的に同一であることを確認済み。diff 画像もほぼ白。
      run: async (ctx: TestContext) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForSelector('[data-slot="preview"]', {
          timeout: 30_000,
        });
        await ctx.page.waitForTimeout(3000);
        await scrollCalendarIntoView(ctx.page);

        // recording: 初期状態
        await ctx.screenshot("calendar-04-initial");

        // 初期状態を baseline として撮影
        const initialShot = await screenshotCalendarRegion(
          ctx.page,
          "calendar-initial-state",
        );
        saveBaseline(initialShot, "calendar-initial-state", BASELINES_DIR);

        // 初期選択日（today）を記憶
        const originalDay = await getSelectedDay(ctx.page);
        expect(originalDay).not.toBeNull();

        // 別の日をクリック（選択が移動する）
        const safeDays = await getSafeDaysToClick(ctx.page);
        const awayPoint = await getDateCellClickPoint(
          ctx.page,
          safeDays.first,
        );
        await ctx.annotateClick(
          awayPoint.x,
          awayPoint.y,
          `Click: Day ${safeDays.first}`,
        );
        await ctx.page.click(awayPoint.x, awayPoint.y);
        await ctx.page.waitForTimeout(500);

        // recording: 選択移動後
        await ctx.screenshot("calendar-04-away");

        // 元の日（today）に戻る
        const backPoint = await getDateCellClickPoint(
          ctx.page,
          originalDay!,
        );
        await ctx.annotateClick(
          backPoint.x,
          backPoint.y,
          `Click: Day ${originalDay} (return)`,
        );
        await ctx.page.click(backPoint.x, backPoint.y);
        await ctx.page.waitForTimeout(500);

        // recording: 元に戻った状態
        await ctx.screenshot("calendar-04-returned");

        // 戻った後を撮影し、VRT で「初期状態に近い」ことを証明
        const returnedShot = await screenshotCalendarRegion(
          ctx.page,
          "calendar-returned-state",
        );
        const diff = compareWithBaseline(
          returnedShot,
          "calendar-initial-state",
          {
            baselinesDir: BASELINES_DIR,
            diffPath: `${BASELINES_DIR}/calendar-roundtrip-diff.png`,
          },
        );
        expect(diff.skipped).toBe(false);
        // 同じ日に戻ったので、見た目はほぼ同じはず。
        expect(diff.mismatchRatio).toBeLessThan(0.01);
      },
    },
  ],
});
