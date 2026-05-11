import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearPointerHover,
  createArtifactPath,
  ensureDir,
  findPreviewIndex,
  findSelectByOptionValues,
  screenshotClipAroundBox,
} from "@uzulla/voreux";

const SHOTS_DIR = process.env.E2E_SCREENSHOTS_DIR
  ? path.resolve(process.cwd(), process.env.E2E_SCREENSHOTS_DIR)
  : fileURLToPath(new URL("../screenshots/", import.meta.url));

ensureDir(SHOTS_DIR);

/**
 * このページには calendar demo が 11 個ある（basic, range, presets など）。
 * 対象を「最初の basic single-date calendar」に固定する。
 *
 * 識別条件:
 * - preview 内に [data-slot="calendar"][data-mode="single"] がある
 * - table[role="grid"] が 1 つだけ（range は 2 つ並ぶ）
 * - dropdown select が存在する（captionLayout="dropdown"）
 *
 * この 3 条件を満たす最初の preview を対象とする。
 * 単なる「最初の preview」ではなく、構造的に basic demo であることを確認している。
 */
export async function getTargetCalendarPreview(
  page: any,
): Promise<{ previewIndex: number }> {
  const previewIndex = await findPreviewIndex(page, (preview) => {
    const cal = preview.querySelector(
      '[data-slot="calendar"][data-mode="single"]',
    ) as HTMLElement | null;
    if (!cal) return false;

    const grids = cal.querySelectorAll('table[role="grid"]');
    if (grids.length !== 1) return false;

    const selects = cal.querySelectorAll("select");
    return selects.length >= 2;
  });

  return { previewIndex };
}

/**
 * 対象 calendar を viewport 中央にスクロールする。
 *
 * hosted docs page では calendar が viewport 外にある場合があり、
 * getBoundingClientRect() の座標がズレて VRT clip や coordinate click が壊れる。
 * 座標を取る/screenshot を撮る前に必ず呼ぶ。
 */
export async function scrollCalendarIntoView(page: any): Promise<void> {
  const { previewIndex } = await getTargetCalendarPreview(page);
  await page.evaluate((pi: number) => {
    const preview = document.querySelectorAll('[data-slot="preview"]')[pi] as
      | HTMLElement
      | undefined;
    const cal = preview?.querySelector('[data-slot="calendar"]');
    cal?.scrollIntoView({ block: "center" });
  }, previewIndex);
  // scroll 完了を待つ
  await page.waitForTimeout(300);
}

/**
 * 対象 calendar 要素の bounding box を返す。
 */
async function getTargetCalendarBox(
  page: any,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const { previewIndex } = await getTargetCalendarPreview(page);
  const box = await page.evaluate((pi: number) => {
    const preview = document.querySelectorAll('[data-slot="preview"]')[pi] as
      | HTMLElement
      | undefined;
    const cal = preview?.querySelector(
      '[data-slot="calendar"]',
    ) as HTMLElement | null;
    if (!cal) return null;
    const r = cal.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, previewIndex);
  if (!box) throw new Error("calendar element not found in target preview");
  return box;
}

/**
 * 指定した日のセルのクリック座標を返す。
 *
 * 実 DOM 構造 (react-day-picker v9 + shadcn):
 * - <td role="gridcell" class="rdp-day" data-day="2026-04-15">
 *     <button data-slot="button" class="rdp-day rdp-day_button">15</button>
 *   </td>
 * - outside days: <td data-outside="true" class="rdp-day rdp-outside">
 *
 * outside days を除外し、当月の日付セルだけを対象にする。
 */
export async function getDateCellClickPoint(
  page: any,
  dayNumber: number,
): Promise<{ x: number; y: number }> {
  const { previewIndex } = await getTargetCalendarPreview(page);
  const box = await page.evaluate(
    (args: { pi: number; day: number }) => {
      const preview = document.querySelectorAll('[data-slot="preview"]')[
        args.pi
      ] as HTMLElement | undefined;
      const cal = preview?.querySelector(
        '[data-slot="calendar"]',
      ) as HTMLElement | null;
      if (!cal) return null;

      // td.rdp-day で outside でないセルから探す
      const cells = Array.from(cal.querySelectorAll("td.rdp-day"));
      for (const td of cells) {
        const el = td as HTMLElement;
        if (
          el.dataset.outside === "true" ||
          el.classList.contains("rdp-outside")
        ) {
          continue;
        }
        const btn = el.querySelector("button");
        if (!btn) continue;
        if ((btn.textContent || "").trim() === String(args.day)) {
          const r = btn.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }
      }
      return null;
    },
    { pi: previewIndex, day: dayNumber },
  );
  if (!box) throw new Error(`date cell not found for day ${dayNumber}`);
  return {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
}

/**
 * 現在選択中でもなく today でもない「安全な」日番号を 2 つ返す。
 *
 * テストで date click が確実に「状態変化」を起こすことを保証する。
 * 2 つの日は VRT で差分が見えやすいよう、離れた位置を選ぶ。
 *
 * 実 DOM 確認済み:
 * - selected 状態: <td> に data-selected="true" / class rdp-selected
 * - today 状態:    <td> に data-today="true" / class rdp-today
 * - これらは <button> ではなく <td> に付く
 */
export async function getSafeDaysToClick(
  page: any,
): Promise<{ first: number; second: number }> {
  const { previewIndex } = await getTargetCalendarPreview(page);
  const result = await page.evaluate((pi: number) => {
    const preview = document.querySelectorAll('[data-slot="preview"]')[pi] as
      | HTMLElement
      | undefined;
    const cal = preview?.querySelector(
      '[data-slot="calendar"]',
    ) as HTMLElement | null;
    if (!cal) return null;

    const cells = Array.from(cal.querySelectorAll("td.rdp-day"));
    const available: number[] = [];

    for (const td of cells) {
      const el = td as HTMLElement;
      // outside days を除外
      if (
        el.dataset.outside === "true" ||
        el.classList.contains("rdp-outside")
      ) {
        continue;
      }
      // selected / today は td に付く
      const isSelected =
        el.dataset.selected === "true" || el.classList.contains("rdp-selected");
      const isToday =
        el.dataset.today === "true" || el.classList.contains("rdp-today");
      if (isSelected || isToday) continue;

      const btn = el.querySelector("button");
      if (!btn) continue;
      const dayNum = Number.parseInt((btn.textContent || "").trim(), 10);
      if (!Number.isNaN(dayNum)) {
        available.push(dayNum);
      }
    }

    if (available.length < 2) return null;
    // 離れた 2 つの日を選ぶ（VRT で差分が見えやすいように）
    const first = available[0];
    const second = available[Math.min(available.length - 1, 7)];
    return { first, second: second === first ? available[1] : second };
  }, previewIndex);
  if (!result) {
    throw new Error("could not find two safe (non-selected, non-today) days");
  }
  return result;
}

/**
 * 現在選択中（today / 初期選択）の日番号を返す。
 *
 * 初期状態では today が選択されている。
 * round-trip テスト（別の日を選んでから元の日に戻る）で使う。
 */
export async function getSelectedDay(page: any): Promise<number | null> {
  const { previewIndex } = await getTargetCalendarPreview(page);
  return page.evaluate((pi: number) => {
    const preview = document.querySelectorAll('[data-slot="preview"]')[pi] as
      | HTMLElement
      | undefined;
    const cal = preview?.querySelector(
      '[data-slot="calendar"]',
    ) as HTMLElement | null;
    if (!cal) return null;

    const selected = cal.querySelector(
      "td.rdp-day.rdp-selected:not(.rdp-outside)",
    ) as HTMLElement | null;
    if (!selected) return null;

    const btn = selected.querySelector("button");
    return btn ? Number.parseInt((btn.textContent || "").trim(), 10) : null;
  }, previewIndex);
}

/**
 * hover 状態をクリアする。
 *
 * VRT 撮影前に呼ぶことで、マウスカーソル位置由来の :hover スタイルが
 * スクリーンショットに混入するのを防ぐ。
 *
 * shadcn calendar では hover 時に薄いグレー丸背景がセルに付く。
 * click 後にマウスがセル上に残っていると、selection 状態と hover 状態が
 * 重なり、VRT の mismatch に hover 由来のノイズが含まれてしまう。
 */
export async function clearCalendarHover(page: any): Promise<void> {
  // カレンダー外の左上にマウスを移動し、hover を解除する。
  // tooltip-helpers.ts の既存パターンに合わせて (10, 10) を使用。
  await clearPointerHover(page, 200);
}

/**
 * 月を select 要素で切り替える。
 *
 * shadcn calendar (captionLayout="dropdown") は月と年の select を持つ。
 * monthValue は 0-indexed (0=Jan, 1=Feb, ..., 11=Dec)。
 *
 * react-day-picker v9 の select は React の合成イベントで制御されているため、
 * value の直接書き換え + change イベントの dispatch で月を切り替える。
 */
export async function changeCalendarMonth(
  page: any,
  monthValue: number,
): Promise<void> {
  const { previewIndex } = await getTargetCalendarPreview(page);
  const changed = await page.evaluate(
    (args: { pi: number; month: number }) => {
      const preview = document.querySelectorAll('[data-slot="preview"]')[
        args.pi
      ] as HTMLElement | undefined;
      const cal = preview?.querySelector(
        '[data-slot="calendar"]',
      ) as HTMLElement | null;
      if (!cal) return false;

      const selects = Array.from(cal.querySelectorAll("select"));
      if (selects.length < 2) return false;

      const monthSelectIndex = selects.findIndex((select) => {
        const values = Array.from((select as HTMLSelectElement).options).map(
          (option) => option.value,
        );
        return (
          values.length >= 12 && values.includes("0") && values.includes("11")
        );
      });
      if (monthSelectIndex < 0) return false;
      const monthSelect = selects[monthSelectIndex] as HTMLSelectElement;

      // React の制御下にある select は nativeInputValueSetter で値を変更し、
      // input + change イベントを発火する必要がある。
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(monthSelect, String(args.month));
      } else {
        monthSelect.value = String(args.month);
      }
      monthSelect.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { pi: previewIndex, month: monthValue },
  );
  if (!changed) {
    throw new Error(`failed to change month to ${monthValue}`);
  }
  // 月切り替え後のレンダリングを待つ
  await page.waitForTimeout(500);
}

/**
 * 現在表示中の月の value (0-indexed) を返す。
 */
export async function getCurrentMonth(page: any): Promise<number> {
  const { previewIndex } = await getTargetCalendarPreview(page);
  const rootSelector = await page.evaluate((pi: number) => {
    const preview = document.querySelectorAll('[data-slot="preview"]')[pi] as
      | HTMLElement
      | undefined;
    const cal = preview?.querySelector(
      '[data-slot="calendar"]',
    ) as HTMLElement | null;
    if (!cal) return null;
    cal.setAttribute("data-voreux-calendar-target", "true");
    return '[data-voreux-calendar-target="true"]';
  }, previewIndex);
  if (!rootSelector) throw new Error("could not locate calendar root");
  const monthIndex = await findSelectByOptionValues(page, {
    rootSelector,
    requiredValues: [0, 11],
    minOptions: 12,
  });
  if (monthIndex === null || monthIndex < 0) {
    throw new Error("could not read current month");
  }
  const month = await page.evaluate(
    (args: { rootSelector: string; index: number }) => {
      const root = document.querySelector(
        args.rootSelector,
      ) as HTMLElement | null;
      if (!root) return null;
      const select = root.querySelectorAll("select")[args.index] as
        | HTMLSelectElement
        | undefined;
      if (!select) return null;
      return Number.parseInt(select.value, 10);
    },
    { rootSelector, index: monthIndex },
  );
  if (month === null) throw new Error("could not read current month");
  return month;
}

/**
 * calendar 領域だけを clip screenshot する。
 *
 * 内部で scrollCalendarIntoView() を呼ぶため、呼び出し前のスクロール状態は問わない。
 * VRT の比較精度を上げるため、対象 calendar の矩形 + padding だけを撮る。
 * padding を含めるのは、calendar の影やボーダーの変化も知覚対象にするため。
 */
export async function screenshotCalendarRegion(
  page: any,
  name: string,
): Promise<string> {
  // スクロール位置が変わっていても正しい領域を撮れるよう、
  // 毎回 calendar を viewport 中央にスクロールする。
  await scrollCalendarIntoView(page);
  const box = await getTargetCalendarBox(page);
  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const pad = 16;
  const x = Math.max(0, Math.round(box.x - pad));
  const y = Math.max(0, Math.round(box.y - pad));
  const width = Math.max(
    1,
    Math.min(Math.round(box.width + pad * 2), viewport.width - x),
  );
  const height = Math.max(
    1,
    Math.min(Math.round(box.height + pad * 2), viewport.height - y),
  );

  const filePath = createArtifactPath(SHOTS_DIR, name);
  return screenshotClipAroundBox(
    page,
    filePath,
    { x, y, width, height },
    { viewport, padding: 0 },
  );
}
