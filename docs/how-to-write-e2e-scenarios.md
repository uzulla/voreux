# Voreux で E2E テストシナリオを書く方法

このドキュメントは、**Voreux を使って新しい E2E テストシナリオを作る手順**を説明します。

対象読者:
- Voreux を使って新しい対象サイトのシナリオを追加したい人
- `examples/` にサンプルを増やしたい人
- `defineScenarioSuite()` と `steps` の書き方を知りたい人

---

## 1. 全体像

Voreux では、E2E シナリオを次のように書きます。

1. テスト対象 URL を決める
2. `defineScenarioSuite()` を呼ぶ
3. `steps` 配列に手順を並べる
4. 各 step の `run(ctx)` の中で Stagehand / page API を使う

基本形:

```ts
import { defineScenarioSuite } from "voreux";

defineScenarioSuite({
  suiteName: "example.com E2E",
  originUrl: "https://example.com/",
  steps: [
    {
      name: "Navigate to page",
      selfHeal: false,
      run: async (ctx) => {
        await ctx.page.goto("https://example.com/");
        await ctx.page.waitForLoadState("networkidle");
        await ctx.screenshot("01-page-loaded");
      },
    },
  ],
});
```

---

## 2. どこにファイルを置くか

この repo では、サンプルや利用例は `examples/` の下に置きます。

たとえば新しいサンプルを追加するなら、こんな構成です。

```text
examples/
  my-site/
    package.json
    tsconfig.json
    vitest.config.ts
    tests/
      my-site.test.ts
```

既存サンプル:
- `examples/cfe-jp/tests/cfe.test.ts`

まずはこのファイルをコピーして調整するのが一番早いです。

---

## 3. 最小構成のシナリオ

もっとも小さいシナリオは「開いて、1枚スクリーンショットを撮る」だけです。

```ts
import { defineScenarioSuite } from "voreux";

const ORIGIN_URL = "https://example.com/";

defineScenarioSuite({
  suiteName: "example.com smoke",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "Open top page",
      selfHeal: false,
      run: async (ctx) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForLoadState("networkidle");
        await ctx.screenshot("01-top");
      },
    },
  ],
});
```

これだけでも:
- ブラウザ起動
- ページ表示
- スクリーンショット保存

まで確認できます。

---

## 4. `defineScenarioSuite()` の意味

`defineScenarioSuite()` は、Vitest の `describe()` / `test()`、Stagehand 初期化、終了処理、失敗時スクリーンショットなどをまとめて面倒見ます。

受け取る主な項目:

- `suiteName`
  - テストスイート名
- `originUrl`
  - self-heal 時に戻る基準URL
- `steps`
  - テスト手順の配列

各 step は以下の形です。

```ts
{
  name: "step name",
  selfHeal?: boolean,
  run: async (ctx) => { ... }
}
```

---

## 5. `selfHeal` の使い分け

### `selfHeal: false` を付けるべき場面

初回遷移のように、
- ページを開く
- 初期状態を作る
- リトライしても意味が薄い

という手順は `selfHeal: false` が向いています。

例:

```ts
{
  name: "Navigate to page",
  selfHeal: false,
  run: async (ctx) => {
    await ctx.page.goto(ORIGIN_URL);
    await ctx.page.waitForLoadState("networkidle");
  },
}
```

### 省略時

省略すると self-heal ラッパーが適用されます。

向いている場面:
- `act()` を使う操作
- キャッシュずれが起きうる操作
- 再試行に意味があるステップ

---

## 6. `ctx` で使えるもの

`run(ctx)` の `ctx` には、シナリオを書く上で便利な API が入っています。


### `ctx.page`

Playwright ライクなページオブジェクトです。

例:

```ts
await ctx.page.goto("https://example.com/");
await ctx.page.waitForLoadState("networkidle");
```


### `ctx.stagehand`

Stagehand 本体です。

例:

```ts
const data = await ctx.stagehand.extract("Extract the title", schema);
await ctx.stagehand.act("Click the login button");
const actions = await ctx.stagehand.observe("Find clickable links");
```


### `ctx.screenshot(name, targetPage?)`

スクリーンショットを保存します。
通常は現在ページを撮りますが、`targetPage` を渡すと別ページ（新しいタブなど）も撮影できます。

```ts
await ctx.screenshot("02-after-login");
```

```ts
await ctx.screenshot("new-tab", newPage);
```

補足:
- VRT や説明用 screenshot の前後では、recording 側で boundary frame を入れるようになっています
- screenshot 中は interval capture を一時停止し、完了後に短い stabilization wait を置いてから recording を再開します
- そのため、動画と VRT screenshot が干渉しにくくなることを狙っています


### `ctx.actAndWaitForNav(instruction, urlPattern)`

`act()` 後に、新タブまたは同一タブ遷移を待ちます。

```ts
const nextPage = await ctx.actAndWaitForNav(
  "Click the GitHub link",
  "github.com",
);
await ctx.screenshot("03-github", nextPage);
```


### `ctx.annotateClick(x, y, label?)`

録画や demo artifact で、**どこをクリックしたのか** を人間に分かるようにします。

```ts
await ctx.annotateClick(420, 380, "Click: Continue");
await ctx.page.click(420, 380);
```

意図:
- click 位置を marker で見せる
- `Click: Continue` のような action label を見せる
- annotation 前後に boundary frame を打ち、短い操作も録画へ残しやすくする

### `ctx.annotateKey(key)`

録画や demo artifact で、**どのキーを押したのか** を人間に分かるようにします。

```ts
await ctx.annotateKey("Escape");
await ctx.page.evaluate(() => {
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
});
```

意図:
- keyboard dismiss や shortcut を録画で追いやすくする
- key 操作の直前/直後の boundary frame を残しやすくする

### `ctx.highlightObserved(actions, screenshotName)`

`observe()` の結果をハイライトしてから撮影します。

```ts
const actions = await ctx.stagehand.observe("Find all clickable links");
await ctx.highlightObserved(actions, "04-links");
```


### `ctx.highlightTarget(instruction, screenshotName)`

ターゲット候補を見つけて、クリック前に可視化します。

```ts
await ctx.highlightTarget("Find the login button", "05-target");
```


### `ctx.assertNoVisualRegression(baselineName)`

現在画面と baseline を比較し、大きな差異があれば fail します。

```ts
await ctx.assertNoVisualRegression("before-submit");
```


### `ctx.saveCurrentBaseline(baselineName)`

比較に使ったスクリーンショットを baseline として保存します。

```ts
if (process.env.UPDATE_BASELINE) {
  ctx.saveCurrentBaseline("before-submit");
}
```

---

## 7. Stagehand の3つの基本操作

Voreux では、主に Stagehand の以下を使います。


### `act()`

自然言語でブラウザ操作を指示します。

```ts
await ctx.stagehand.act("Click the login button");
```

用途:
- クリック
- 入力
- 遷移操作

---


### `extract()`

ページから構造化データを取り出します。

```ts
import { z } from "zod";

const profileSchema = z.object({
  name: z.string(),
  bio: z.string(),
});

const profile = await ctx.stagehand.extract(
  "Extract the person's name and short bio",
  profileSchema,
);
```

用途:
- 一覧情報の抽出
- ページ内容の構造化
- assertion 前の整形

---


### `observe()`

操作候補を見つけます。

```ts
const actions = await ctx.stagehand.observe("Find all clickable buttons");
```

用途:
- 何が押せるか調べる
- ハイライト表示
- act 前の補助

---

## 8. 実践パターン

### パターンA: 開く → 抽出する

```ts
import { defineScenarioSuite } from "voreux";
import { expect } from "vitest";
import { z } from "zod";

const ORIGIN_URL = "https://example.com/";

const pageSchema = z.object({
  title: z.string(),
});

defineScenarioSuite({
  suiteName: "example.com extract",
  originUrl: ORIGIN_URL,
  steps: [
    {
      name: "Navigate",
      selfHeal: false,
      run: async (ctx) => {
        await ctx.page.goto(ORIGIN_URL);
        await ctx.page.waitForLoadState("networkidle");
      },
    },
    {
      name: "Extract title",
      run: async (ctx) => {
        const result = await ctx.stagehand.extract(
          "Extract the page title",
          pageSchema,
        );
        expect(result.title.length).toBeGreaterThan(0);
      },
    },
  ],
});
```

---

### パターンB: observe して撮る

```ts
{
  name: "Observe actions",
  run: async (ctx) => {
    const actions = await ctx.stagehand.observe(
      "Find all clickable navigation links",
    );
    await ctx.highlightObserved(actions, "nav-links");
  },
}
```

---

### パターンC: クリックして遷移確認

```ts
{
  name: "Open external page",
  run: async (ctx) => {
    const nextPage = await ctx.actAndWaitForNav(
      "Click the GitHub link",
      "github.com",
    );
    await ctx.screenshot("github-opened", nextPage);
  },
}
```

---

### パターンD: ビジュアル差分を入れる

```ts
{
  name: "Check visual regression",
  run: async (ctx) => {
    await ctx.assertNoVisualRegression("top-page");
  },
}
```

初回に baseline を作りたいとき:

```ts
if (process.env.UPDATE_BASELINE) {
  ctx.saveCurrentBaseline("top-page");
}
```

---

## 9. 新規シナリオ作成のおすすめ手順

### 手順1: 最初は smoke にする

最初から全部やらず、まずは:
- 開く
- 1つ抽出
- 1つクリック

の3段階くらいで作るのがよいです。

### 手順2: screenshot を多めに置く

AIベースの E2E は「何が見えていたか」が重要です。

おすすめ:
- 遷移直後
- 抽出後
- クリック前
- クリック後

### 手順3: assertion を必ず書く

AI操作が通っても、意味的に成功しているとは限りません。

たとえば:

```ts
expect(actions.length).toBeGreaterThan(0);
expect(profile.name.length).toBeGreaterThan(0);
expect(nextPage.url()).toContain("github.com");
```

### 手順4: `act()` の後は確認を入れる

`act()` 後は特に、
- URL確認
- スクリーンショット
- テキスト確認

を入れると壊れにくいです。

---

## 10. よくあるハマりどころ

### `extract()` は位置引数

```ts
// OK
await ctx.stagehand.extract("instruction", schema);

// NG
await ctx.stagehand.extract({ instruction: "...", schema });
```

### 初期遷移を self-heal にしない

最初の `goto()` は普通に `selfHeal: false` の方が素直です。

### `act()` 結果を鵜呑みにしない

クリックできたように見えて、違う要素を触っていることがあります。
必ず確認を入れてください。

### external site は不安定

本物のWebサイトは、
- 広告
- A/B テスト
- 遅延
- 文言変化

で不安定です。
そのため assertion は、厳密すぎず、でも意味を持つものにします。

---

## 11. どこまでを framework に寄せるべきか

シナリオを書く時の基本方針は:

- **共通化できるもの** → `packages/voreux`
- **サイト固有の手順** → `examples/.../tests/*.test.ts`

たとえば:

framework に寄せるもの:
- self-heal
- 録画
- スクリーンショット helper
- visual regression helper
- ハイライト helper

シナリオ側に置くもの:
- どのURLを開くか
- 何を抽出するか
- どのリンクを押すか
- 何を成功とみなすか

---

## 12. 実際に始めるときのテンプレート

```ts
import { expect } from "vitest";
import { z } from "zod";
import { defineScenarioSuite } from "voreux";

const ORIGIN_URL = "https://example.com/";

const sampleSchema = z.object({
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
      name: "Extract structured data",
      run: async (ctx) => {
        const data = await ctx.stagehand.extract(
          "Extract the page title",
          sampleSchema,
        );
        await ctx.screenshot("02-extracted");
        expect(data.title.length).toBeGreaterThan(0);
      },
    },
    {
      name: "Observe clickable elements",
      run: async (ctx) => {
        const actions = await ctx.stagehand.observe(
          "Find clickable links on this page",
        );
        await ctx.highlightObserved(actions, "03-observed");
        expect(actions.length).toBeGreaterThan(0);
      },
    },
  ],
});
```

---

## 13. まず見るべき既存ファイル

- `examples/cfe-jp/tests/cfe.test.ts`
  - 実際のサンプルシナリオ
- `packages/voreux/src/scenario.ts`
  - `defineScenarioSuite()` の動き
- `packages/voreux/src/context.ts`
  - `ctx` で何が使えるか
- `packages/voreux/src/config.ts`
  - 環境変数で何を変えられるか

---

## 14. 一言で言うと

Voreux のシナリオは、

- `defineScenarioSuite()` に
- `steps` を並べて
- `ctx.stagehand` と `ctx.page` を使って
- assertion と screenshot を添えていく

という形で書きます。

最初は **小さい smoke シナリオから始めて、徐々に抽出・観測・遷移確認を足す** のがおすすめです。
