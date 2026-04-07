import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TestContext } from "@uzulla/voreux";
import { defineScenarioSuite } from "@uzulla/voreux";
import { expect } from "vitest";
import {
  changeCalendarMonth,
  clearCalendarHover,
  getCurrentMonth,
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

// VRT 撮影前に必ず hover をクリアする共通 setup。
// shadcn calendar は :hover で薄いグレー丸背景をセルに付けるため、
// click 後にマウスが残っていると hover 状態が VRT に混入する。
// persistent browser observation で確認済み。
async function setupPage(ctx: TestContext): Promise<void> {
  await ctx.page.goto(ORIGIN_URL);
  await ctx.page.waitForSelector('[data-slot="preview"]', {
    timeout: 30_000,
  });
  // hosted docs の hydration 完了を待つ（既存 sample 共通パターン）
  await ctx.page.waitForTimeout(3000);
  await scrollCalendarIntoView(ctx.page);
}

// VRT 撮影前に hover をクリアしてから clip screenshot を撮る。
// selection 状態だけを純粋に比較するための共通パターン。
async function vrtScreenshot(ctx: TestContext, name: string): Promise<string> {
  await clearCalendarHover(ctx.page);
  return screenshotCalendarRegion(ctx.page, name);
}

defineScenarioSuite({
  suiteName: "shadcn-component E2E (calendar)",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "日付をクリックすると選択の黒丸が移動する",
      selfHeal: false,
      // human-visible 判断: persistent browser observation (2026-04-08) で確認済み。
      // 初期状態では today が selected（黒丸 + [aria-selected="true"]）。
      // 別の日をクリックすると selected が移動し、today は輪郭リングのみに変わる。
      // 2 箇所の視覚変化（旧=黒丸消失、新=黒丸出現）は human-visible。
      // hover をクリアしてから VRT を撮ることで、:hover 由来のグレー丸を除外し、
      // 純粋な selection 変化だけを検出する。
      run: async (ctx: TestContext) => {
        await setupPage(ctx);

        // recording: 初期状態
        await ctx.screenshot("calendar-01-initial");

        // 選択前（today が selected）を VRT baseline として撮影
        const beforeShot = await vrtScreenshot(ctx, "calendar-before-select");
        saveBaseline(beforeShot, "calendar-before-select", BASELINES_DIR);

        // today でも現在選択でもない安全な日を選ぶ
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

        // recording: click 後
        await ctx.screenshot("calendar-01-after-select");

        // hover をクリアしてから撮影し、VRT で黒丸の移動を検出
        const afterShot = await vrtScreenshot(ctx, "calendar-after-select");
        const diff = compareWithBaseline(afterShot, "calendar-before-select", {
          baselinesDir: BASELINES_DIR,
          diffPath: `${BASELINES_DIR}/calendar-select-diff.png`,
        });
        expect(diff.skipped).toBe(false);
        // today の黒丸が消えて別の日に移動するため、2 箇所が変化する。
        // hover をクリアしているので、mismatch は純粋な selection 変化のみ。
        expect(diff.mismatchRatio).toBeGreaterThan(0.001);
      },
    },
    {
      name: "月を切り替えるとカレンダーの日付グリッドが全面的に変わる",
      selfHeal: false,
      // human-visible 判断: persistent browser observation で確認済み。
      // select で月を変更すると日付グリッド全体が切り替わる。
      // これは全シナリオ中で最も顕著な視覚変化であり、human-visible の
      // 観点で疑いの余地がない。
      run: async (ctx: TestContext) => {
        await setupPage(ctx);

        // recording: 初期状態（当月）
        await ctx.screenshot("calendar-02-initial");

        // 当月の状態を baseline として撮影
        const currentMonth = await getCurrentMonth(ctx.page);
        const beforeShot = await vrtScreenshot(
          ctx,
          "calendar-before-month-change",
        );
        saveBaseline(beforeShot, "calendar-before-month-change", BASELINES_DIR);

        // 前月に切り替える
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        await changeCalendarMonth(ctx.page, prevMonth);

        // recording: 月変更後
        await ctx.screenshot("calendar-02-after-month-change");

        // VRT でグリッド全体の変化を検出
        const afterShot = await vrtScreenshot(
          ctx,
          "calendar-after-month-change",
        );
        const diff = compareWithBaseline(
          afterShot,
          "calendar-before-month-change",
          {
            baselinesDir: BASELINES_DIR,
            diffPath: `${BASELINES_DIR}/calendar-month-change-diff.png`,
          },
        );
        expect(diff.skipped).toBe(false);
        // 月ヘッダーと日付グリッドの大部分が変わる。
        // clip 領域にはパディングや曜日ヘッダー（変化しない部分）も含むため、
        // mismatch は clip 全体に対して約 2% 程度。0.01 を下限とする。
        expect(diff.mismatchRatio).toBeGreaterThan(0.01);
      },
    },
    {
      name: "別の月で日を選んでから元の月に戻ると today の黒丸が消えている",
      selfHeal: false,
      // human-visible 判断: persistent browser observation (2026-04-08) で確認済み。
      // 別の月で日を選択すると、その日付が React state で selected になる。
      // 元の月に戻ったとき、selected date は前月にあるため当月グリッドには
      // [aria-selected] を持つセルが存在しない。結果として today は
      // 「selected でない today」（薄い輪郭リングのみ）として表示される。
      // 初期状態（today = selected = 黒丸）との視覚差は human-visible。
      // NOTE: selection 自体は失われていない（前月に戻れば 15 日が selected）。
      //       当月ビューに selected が「見えない」だけ。
      run: async (ctx: TestContext) => {
        await setupPage(ctx);

        // recording: 初期状態
        await ctx.screenshot("calendar-03-initial");

        // 初期状態（today selected）を baseline
        const currentMonth = await getCurrentMonth(ctx.page);
        const beforeShot = await vrtScreenshot(
          ctx,
          "calendar-cross-month-before",
        );
        saveBaseline(beforeShot, "calendar-cross-month-before", BASELINES_DIR);

        // 前月に移動
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        await changeCalendarMonth(ctx.page, prevMonth);

        // 前月で日をクリック
        const clickPoint = await getDateCellClickPoint(ctx.page, 15);
        await ctx.annotateClick(
          clickPoint.x,
          clickPoint.y,
          "Click: Day 15 (prev month)",
        );
        await ctx.page.click(clickPoint.x, clickPoint.y);
        await ctx.page.waitForTimeout(500);

        // recording: 前月でクリック後
        await ctx.screenshot("calendar-03-prev-month-selected");

        // 元の月に戻る
        await changeCalendarMonth(ctx.page, currentMonth);

        // recording: 元の月に戻った状態
        await ctx.screenshot("calendar-03-returned");

        // VRT で初期状態との差を検出
        // selected date は前月にあるため当月には selected セルがない。
        // today は黒丸（selected）からリングのみ（非 selected today）に変化する。
        const afterShot = await vrtScreenshot(
          ctx,
          "calendar-cross-month-after",
        );
        const diff = compareWithBaseline(
          afterShot,
          "calendar-cross-month-before",
          {
            baselinesDir: BASELINES_DIR,
            diffPath: `${BASELINES_DIR}/calendar-cross-month-diff.png`,
          },
        );
        expect(diff.skipped).toBe(false);
        // today が selected → 非 selected に変わり、黒丸 → 輪郭リングになるため差分が出る。
        expect(diff.mismatchRatio).toBeGreaterThan(0.001);
      },
    },
    {
      name: "同月内で日を変えて戻すと見た目が初期状態に近い",
      selfHeal: false,
      // human-visible 判断: persistent browser observation で確認済み。
      // today → 別の日 → today の round-trip で、initial と returned が
      // 視覚的にほぼ同一であることを確認済み。
      // hover をクリアすることで、round-trip 比較の精度が向上する。
      run: async (ctx: TestContext) => {
        await setupPage(ctx);

        // recording: 初期状態
        await ctx.screenshot("calendar-04-initial");

        // hover をクリアして初期状態を baseline として撮影
        const initialShot = await vrtScreenshot(
          ctx,
          "calendar-roundtrip-initial",
        );
        saveBaseline(initialShot, "calendar-roundtrip-initial", BASELINES_DIR);

        // 初期選択日（today）を記憶
        const originalDay = await getSelectedDay(ctx.page);
        expect(originalDay).not.toBeNull();
        if (originalDay == null) {
          throw new Error("original selected day not found");
        }

        // 別の日をクリック
        const safeDays = await getSafeDaysToClick(ctx.page);
        const awayPoint = await getDateCellClickPoint(ctx.page, safeDays.first);
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
        const backPoint = await getDateCellClickPoint(ctx.page, originalDay);
        await ctx.annotateClick(
          backPoint.x,
          backPoint.y,
          `Click: Day ${originalDay} (return)`,
        );
        await ctx.page.click(backPoint.x, backPoint.y);
        await ctx.page.waitForTimeout(500);

        // recording: 元に戻った状態
        await ctx.screenshot("calendar-04-returned");

        // hover をクリアして撮影し、初期状態との VRT 比較
        const returnedShot = await vrtScreenshot(
          ctx,
          "calendar-roundtrip-returned",
        );
        const diff = compareWithBaseline(
          returnedShot,
          "calendar-roundtrip-initial",
          {
            baselinesDir: BASELINES_DIR,
            diffPath: `${BASELINES_DIR}/calendar-roundtrip-diff.png`,
          },
        );
        expect(diff.skipped).toBe(false);
        // 同じ日に戻ったので、見た目はほぼ同じはず。
        // hover をクリアしているため、前回より精度が高い。
        // NOTE: today marker の描画は anti-aliasing やサブピクセルシフトの影響を受け、
        // 同一日を再選択しても ~1.2% の pixel 差が生じる場合がある（browser observation 確認済み）。
        // 0.02 はこの揺らぎを許容しつつ、実質的な selection 変化（~2% 以上）を検出する閾値。
        expect(diff.mismatchRatio).toBeLessThan(0.02);
      },
    },
  ],
});
