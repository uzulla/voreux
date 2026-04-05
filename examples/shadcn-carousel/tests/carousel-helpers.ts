const SHOTS_DIR = new URL("../screenshots/", import.meta.url).pathname;

export async function pollUntil(
  page: any,
  fn: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 100,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await page.waitForTimeout(intervalMs);
  }
  return false;
}

/**
 * このページは carousel サンプルが複数ありノイジーなので、
 * ページ最上部の basic carousel だけを対象に固定する。
 */
export async function getTargetCarousel(_page: any): Promise<number> {
  return 0;
}

export async function getTargetCarouselBox(
  page: any,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const index = await getTargetCarousel(page);
  const box = await page.evaluate((i: number) => {
    const el = document.querySelectorAll('[data-slot="carousel"]')[i] as
      | HTMLElement
      | undefined;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, index);
  if (!box) throw new Error("target carousel not found");
  return box;
}

/**
 * 現在 viewport 中央に最も近い item を「現在表示中のセル」とみなす。
 *
 * 実 DOM 観察の結果、transform そのものを見るよりも、item の矩形位置から
 * 中央に最も近いものを選ぶ方が教材としても分かりやすく、安定していた。
 */
export async function getCenteredItem(
  page: any,
): Promise<{ text: string; left: number; right: number }> {
  const index = await getTargetCarousel(page);
  const result = await page.evaluate((i: number) => {
    const carousel = document.querySelectorAll('[data-slot="carousel"]')[i] as
      | HTMLElement
      | undefined;
    const content = carousel?.querySelector(
      '[data-slot="carousel-content"]',
    ) as HTMLElement | null;
    if (!carousel || !content) return null;
    const contentRect = content.getBoundingClientRect();
    const centerX = contentRect.left + contentRect.width / 2;
    const items = Array.from(
      carousel.querySelectorAll('[data-slot="carousel-item"]'),
    ).map((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const itemCenter = r.left + r.width / 2;
      return {
        text: (el.textContent || "").trim(),
        left: r.left,
        right: r.right,
        dist: Math.abs(itemCenter - centerX),
      };
    });
    items.sort((a, b) => a.dist - b.dist);
    return items[0] ?? null;
  }, index);
  if (!result) throw new Error("centered item not found");
  return result;
}

export async function clickCarouselButton(
  page: any,
  slot: "carousel-next" | "carousel-previous",
) {
  const index = await getTargetCarousel(page);
  const box = await page.evaluate(
    (args: { i: number; slot: string }) => {
      const carousel = document.querySelectorAll('[data-slot="carousel"]')[
        args.i
      ] as HTMLElement | undefined;
      const button = carousel?.querySelector(
        `[data-slot="${args.slot}"]`,
      ) as HTMLElement | null;
      if (!button) return null;
      const r = button.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },
    { i: index, slot },
  );
  if (!box) throw new Error(`button not found: ${slot}`);
  await page.click(
    Math.round(box.x + box.width / 2),
    Math.round(box.y + box.height / 2),
  );
}

/**
 * アニメーション終了待ち:
 * ボタンクリック後、現在中央の item が期待値へ変わるまで待つ。
 */
export async function waitForCenteredItem(
  page: any,
  expectedText: string,
): Promise<void> {
  const ok = await pollUntil(
    page,
    async () => {
      const item = await getCenteredItem(page);
      return item.text === expectedText;
    },
    5000,
    100,
  );
  if (!ok) throw new Error(`centered item did not become ${expectedText}`);
}

/**
 * 期待セルに着くまで next を進める。
 *
 * fixed sleep の回数決め打ちはフレーキーなので、
 * 各クリックごとに「中央セルが変わったか」を観測する。
 */
export async function advanceUntilCenteredItem(
  page: any,
  expectedText: string,
  maxSteps = 10,
): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const current = await getCenteredItem(page);
    if (current.text === expectedText) return;

    const nextState = await getButtonVisualState(page, "carousel-next");
    if (nextState.disabled) break;

    await clickCarouselButton(page, "carousel-next");
    const moved = await pollUntil(
      page,
      async () => (await getCenteredItem(page)).text !== current.text,
      3000,
      100,
    );
    if (!moved) {
      throw new Error("carousel did not progress after next click");
    }
  }
  throw new Error(`failed to advance carousel until ${expectedText}`);
}

export async function getButtonVisualState(
  page: any,
  slot: "carousel-next" | "carousel-previous",
): Promise<{ disabled: boolean; opacity: string; pointerEvents: string }> {
  const index = await getTargetCarousel(page);
  const state = await page.evaluate(
    (args: { i: number; slot: string }) => {
      const carousel = document.querySelectorAll('[data-slot="carousel"]')[
        args.i
      ] as HTMLElement | undefined;
      const button = carousel?.querySelector(
        `[data-slot="${args.slot}"]`,
      ) as HTMLButtonElement | null;
      if (!button) return null;
      const cs = getComputedStyle(button);
      return {
        disabled: button.hasAttribute("disabled"),
        opacity: cs.opacity,
        pointerEvents: cs.pointerEvents,
      };
    },
    { i: index, slot },
  );
  if (!state) throw new Error(`button state not found: ${slot}`);
  return state;
}

/**
 * carousel 領域だけを clip screenshot する。
 *
 * この sample では「人間が見て変化を知覚できるか」を重視したいので、
 * ページ全体ではなく対象 carousel の部分画像だけを撮る。
 */
export async function screenshotCarouselClip(
  page: any,
  name: string,
): Promise<string> {
  const box = await getTargetCarouselBox(page);
  const filePath = `${SHOTS_DIR}${name}.png`;
  await page.screenshot({
    path: filePath,
    clip: {
      x: Math.max(0, Math.round(box.x - 24)),
      y: Math.max(0, Math.round(box.y - 24)),
      width: Math.round(box.width + 48),
      height: Math.round(box.height + 48),
    },
  });
  return filePath;
}
