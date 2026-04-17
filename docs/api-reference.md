# Voreux / Stagehand API リファレンス

このドキュメントは、Voreux でシナリオを書くときに参照しやすいよう、
**最小ひながた**、**Voreux 側の API / helper**、**よく使う Stagehand API** をまとめた実用リファレンスです。

網羅的な概念説明ではなく、"どの API があるか" と "どう使うか" を引きやすくすることを主眼にしています。

## ひながた

最小構成の例です。

```ts
import { expect } from "vitest";
import { z } from "zod";
import { defineScenarioSuite } from "@uzulla/voreux";

const ORIGIN_URL = "https://example.com/";

const pageSchema = z.object({
  title: z.string(),
});

defineScenarioSuite({
  suiteName: "example.com E2E",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "Navigate to page",
      selfHeal: false,
      run: async (ctx) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForLoadState("networkidle");
        await ctx.screenshot("01-page-loaded");
      },
    },
    {
      name: "Extract title",
      run: async (ctx) => {
        const data = await ctx.stagehand.extract(
          "Extract the page title",
          pageSchema,
        );
        expect(data.title.length).toBeGreaterThan(0);
      },
    },
  ],
});
```

基本パターン:
- `defineScenarioSuite()` に `suiteName`, `originUrl`, `steps` を渡す
- 初期遷移は `selfHeal: false` にすることが多い
- `run(ctx)` の中で `ctx.page` / `ctx.stagehand` / Voreux helper を使う

## Voreux の API / helper 一覧

## exports from `@uzulla/voreux`

### `defineScenarioSuite(options)`
シナリオ全体を定義するエントリポイントです。

シグネチャ:

```ts
function defineScenarioSuite(options: ScenarioSuiteOptions): void
```

主な引数:
- `suiteName: string`
- `originUrl: string`
- `steps: ScenarioStep[]`

例:

```ts
defineScenarioSuite({
  suiteName: "top page smoke",
  originUrl: "https://example.com/",
  steps: [
    {
      name: "open",
      selfHeal: false,
      run: async (ctx) => {
        await ctx.page.goto("https://example.com/");
      },
    },
  ],
});
```

注意:
- `selfHeal` を省略すると self-heal ラッパーが適用されます
- 初回 `goto()` のような初期化ステップは `selfHeal: false` が向いています

---

### `ScenarioStep`
1つの step を表す型です。

シグネチャ:

```ts
interface ScenarioStep {
  name: string;
  run: (ctx: TestContext) => Promise<void>;
  selfHeal?: boolean;
}
```

---

### `ScenarioSuiteOptions`
`defineScenarioSuite()` に渡すオプション型です。

シグネチャ:

```ts
interface ScenarioSuiteOptions {
  suiteName: string;
  originUrl: string;
  steps: ScenarioStep[];
}
```

---

### `TestContext`
`run(ctx)` に渡されるコンテキスト型です。

主なプロパティ:
- `ctx.stagehand`
- `ctx.page`
- `ctx.screenshot()`
- `ctx.actAndWaitForNav()`
- `ctx.highlightObserved()`
- `ctx.highlightTarget()`
- `ctx.assertNoVisualRegression()`
- `ctx.saveCurrentBaseline()`
- `ctx.annotateClick()`
- `ctx.annotateKey()`
- `ctx.annotateHover()`

以下で主要メソッドを列挙します。

---

## `ctx.*` helper

### `ctx.screenshot(name, targetPage?)`
スクリーンショットを保存します。

シグネチャ:

```ts
ctx.screenshot(name: string, targetPage?: any): Promise<void>
```

例:

```ts
await ctx.screenshot("02-after-login");
await ctx.screenshot("03-new-tab", nextPage);
```

用途:
- 各 step の状態記録
- 失敗調査
- 新タブ遷移後の確認

---

### `ctx.actAndWaitForNav(instruction, urlPattern)`
`act()` 実行後に、新タブまたは同一タブの遷移を待ってページを返します。

シグネチャ:

```ts
ctx.actAndWaitForNav(instruction: string, urlPattern: string): Promise<any>
```

例:

```ts
const nextPage = await ctx.actAndWaitForNav(
  "Click the GitHub link",
  "github.com",
);
await ctx.screenshot("github-opened", nextPage);
```

用途:
- 外部リンク遷移確認
- 新タブオープン確認

注意:
- `urlPattern` は部分一致で判定されます
- 遷移先確認を伴う `act()` では素の `act()` よりこちらが安全です

---

### `ctx.highlightObserved(actions, screenshotName)`
`observe()` 結果をハイライトして撮影します。

シグネチャ:

```ts
ctx.highlightObserved(actions: any[], screenshotName: string): Promise<void>
```

例:

```ts
const actions = await ctx.stagehand.observe("Find clickable links");
await ctx.highlightObserved(actions, "04-links");
```

用途:
- `observe()` 結果の可視化
- デバッグ
- ドキュメント用アーティファクト生成

---

### `ctx.highlightTarget(instruction, screenshotName)`
指定 instruction に対応するターゲット候補を探し、単一ハイライトして撮影します。

シグネチャ:

```ts
ctx.highlightTarget(instruction: string, screenshotName: string): Promise<void>
```

例:

```ts
await ctx.highlightTarget("Find the login button", "05-login-target");
```

用途:
- クリック前の対象可視化
- 人間レビュー用の補助

---

### `ctx.assertNoVisualRegression(baselineName)`
現在画面を baseline と比較し、大きな差分があれば fail します。

シグネチャ:

```ts
ctx.assertNoVisualRegression(baselineName: string): Promise<void>
```

例:

```ts
await ctx.assertNoVisualRegression("before-submit");
```

用途:
- VRT
- 見た目崩れの検知

注意:
- 初回 baseline 未作成時は比較スキップ扱いになるケースがあります
- mismatch 閾値は framework 側設定に依存します

---

### `ctx.saveCurrentBaseline(baselineName)`
直前比較に使った screenshot を baseline として保存します。

シグネチャ:

```ts
ctx.saveCurrentBaseline(baselineName: string): void
```

例:

```ts
if (process.env.UPDATE_BASELINE) {
  ctx.saveCurrentBaseline("before-submit");
}
```

用途:
- baseline 更新
- 初回比較後の保存

注意:
- 比較前に呼んでも保存対象がありません
- 通常は `assertNoVisualRegression()` の後に使います

---

### `ctx.annotateClick(x, y, label?)`
録画上でクリック位置を人間向けに見やすく可視化します。

シグネチャ:

```ts
ctx.annotateClick(x: number, y: number, label?: string): Promise<void>
```

例:

```ts
await ctx.annotateClick(420, 380, "Click: Continue");
await ctx.page.click(420, 380);
```

用途:
- demo / recording の視認性向上
- click の意図表示

---

### `ctx.annotateKey(key)`
録画上でキー操作を可視化します。

シグネチャ:

```ts
ctx.annotateKey(key: string): Promise<void>
```

例:

```ts
await ctx.annotateKey("Escape");
```

---

### `ctx.annotateHover(x, y, label?)`
録画上で hover 対象位置を可視化します。

シグネチャ:

```ts
ctx.annotateHover(x: number, y: number, label?: string): Promise<void>
```

例:

```ts
await ctx.annotateHover(300, 220, "Hover: Tooltip target");
```

---

## `@uzulla/voreux` から直接 export される browser-grounded helper

以下は `@uzulla/voreux` から直接 import できます。

### `waitUntil(fn, options?)`
条件が満たされるまで待つ汎用 helper です。

### `humanHover(page, point, options?)`
人間っぽい hover を意識した helper です。

### `movePointerToSafeCorner(page, options?)`
hover 状態の解消などに使える pointer 移動 helper です。

### `clearPointerHover(page, options?)`
hover ノイズを消したいときに使います。

### `isPerceivablyVisible(...)`
「人間に見えているとみなせるか」を補助的に判定したいときの helper です。

### `findSelectByOptionValues(...)`
select 候補探索の補助 helper です。

### `getCenterPoint(...)`, `getClosestToContainerCenter(...)`
座標計算の補助 helper です。

### `screenshotClip(...)`, `screenshotClipAroundBox(...)`
画面全体ではなく一部領域を screenshot / VRT 対象にしたい時の helper です。

### `createArtifactPath(...)`, `ensureDir(...)`
artifact path 作成・ディレクトリ作成補助です。

> これらは低レベル寄りの helper です。まずは `ctx.*` と scenario ベースで書き、必要なときに使うのが無難です。

## 典型的に利用する Stagehand のメソッド

Voreux では主に `ctx.stagehand` 経由で Stagehand API を使います。

## `ctx.stagehand.act(instruction)`
自然言語で操作を指示します。

例:

```ts
await ctx.stagehand.act("Click the login button");
```

用途:
- click
- input
- 遷移操作

Stagehand docs:
- https://docs.stagehand.dev/

注意:
- `act()` の結果を鵜呑みにせず、URL / screenshot / text などで確認を入れる
- 遷移確認込みなら `ctx.actAndWaitForNav()` を優先すると安全

---

## `ctx.stagehand.extract(instruction, schema)`
ページ内容を構造化抽出します。

例:

```ts
const schema = z.object({ title: z.string() });
const data = await ctx.stagehand.extract("Extract the page title", schema);
```

用途:
- タイトルや一覧情報の抽出
- assertion 用データの整形

Stagehand docs:
- https://docs.stagehand.dev/

注意:
- Voreux / Stagehand v3 では位置引数スタイルを使う前提で考えると安全です
- object 形式で書くと期待通り動かないケースがあります

---

## `ctx.stagehand.observe(instruction)`
操作候補の要素を見つけます。

例:

```ts
const actions = await ctx.stagehand.observe("Find all clickable links");
await ctx.highlightObserved(actions, "links");
```

用途:
- 何が押せるかの把握
- act 前の補助
- ハイライト撮影

Stagehand docs:
- https://docs.stagehand.dev/

注意:
- 返ってきた候補数だけで成功判定せず、人間に意味のある候補か確認する

---

## `ctx.page.goto(url)`
ページへ遷移します。

例:

```ts
await ctx.page.goto("https://example.com/");
```

用途:
- 初期遷移
- smoke step

注意:
- 初期遷移 step は `selfHeal: false` にすることが多いです

---

## `ctx.page.waitForLoadState(state)`
ロード状態待ちです。

例:

```ts
await ctx.page.waitForLoadState("networkidle");
```

用途:
- 初期表示待ち
- 遷移直後の安定化

---

## `ctx.page.waitForSelector(selector)`
要素出現待ちです。

例:

```ts
await ctx.page.waitForSelector("button");
```

用途:
- 表示完了待ち
- locator 代替の基本手段

---

## `ctx.page.evaluate(fn)`
DOM 状態観察やテキスト抽出に使います。

例:

```ts
const title = await ctx.page.evaluate(() => document.title);
```

用途:
- DOM 観察
- innerText / textContent 確認
- 複雑UIの状態把握

注意:
- Voreux では Playwright locator より `waitForSelector() + evaluate()` が安定する場面が多いです

---

## `ctx.page.type(text)`
入力に使います。

例:

```ts
await ctx.page.type("hello world");
```

用途:
- text input
- editor への入力

---

## `ctx.page.click(x, y)`
Voreux / Stagehand 文脈では、selector 指定 click ではなく **座標 click** として扱う前提で考えるのが安全です。

例:

```ts
await ctx.page.click(320, 240);
```

注意:
- Playwright の `click(selector, options)` 感覚で使わない
- 座標 click が必要な UI では、`evaluate()` で座標を求めてから使う

## Playwright 的直感との違いでハマりやすい点

Voreux の `ctx.page` は Playwright の full API と完全互換ではありません。

特に次は前提にしない方が安全です。
- `ctx.page.locator(...).waitFor()`
- `ctx.page.locator(...).isVisible()`
- `ctx.page.getByRole(...)`
- `ctx.page.click(selector, options)`

代わりにまず検討するもの:
- `ctx.page.waitForSelector(...)`
- `ctx.page.evaluate(...)`
- `ctx.stagehand.observe(...)`
- `ctx.stagehand.extract(...)`
- `ctx.actAndWaitForNav(...)`

## 参考

- Stagehand docs: https://docs.stagehand.dev/
- シナリオ作成手順: [./how-to-write-e2e-scenarios.md](./how-to-write-e2e-scenarios.md)
- Agent 向け行動指針: [./agent-behavior-for-scenario-authoring.md](./agent-behavior-for-scenario-authoring.md)
