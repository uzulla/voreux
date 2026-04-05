# Voreux

Voreux は、**Stagehand + Vitest** ベースの E2E テストフレームワークです。

AI に「クリックして」「入力して」と指示するだけで、Web ブラウザ操作を自動化するテストを書けます。

## インストール

```bash
npm install @uzulla/voreux
# または
pnpm add @uzulla/voreux
```

**必須環境**

- Node.js >= 22.x
- pnpm >= 10.x（推奨）または npm
- Windows ユーザーは **WSL2** が必要です（native PowerShell / cmd は現在サポート対象外）

## クイックスタート

```bash
# プロジェクトの雛形を生成
npx @uzulla/voreux init my-e2e
cd my-e2e

# 依存をインストール
pnpm install

# OPENAI_API_KEY を設定
cp .env.example .env
# .env の OPENAI_API_KEY を実際のキーに置き換える

# テストを実行
pnpm test
```

> Note:
> 通常の公開版では `npx @uzulla/voreux init my-e2e` をそのまま使えます。
> まだ publish していないローカル変更や未公開ブランチを試す場合は、repo からの別手順で検証してください。

## 最初のテストを書く

```ts
import { defineScenarioSuite } from "@uzulla/voreux";

const steps = [
  {
    name: "load page",
    selfHeal: false,
    run: async (ctx) => {
      await ctx.page.goto("https://example.com/");
    },
  },
];

defineScenarioSuite({
  suiteName: "example",
  originUrl: "https://example.com/",
  steps,
});
```

## 実装者向けの重要注意: `ctx.page` は Playwright の生 `Page` ではない

Voreux の `ctx.page` は、Stagehand 経由の page オブジェクトです。
そのため、**Playwright の full API と完全互換ではありません**。

特に次は注意してください。

### 使える前提で考えてよいもの
- `ctx.page.goto(...)`
- `ctx.page.waitForSelector(...)`
- `ctx.page.waitForLoadState(...)`
- `ctx.page.evaluate(...)`
- `ctx.page.type(...)`
- `ctx.page.click(x, y)` ← **座標クリック**

### Playwright 気分でそのまま書くとハマりやすいもの
- `ctx.page.locator(...).waitFor()`
- `ctx.page.locator(...).isVisible()`
- `ctx.page.getByRole(...)`
- `ctx.page.click(selector, options)` ← **Voreux では座標クリックAPIとして扱う前提で考える**

### 実装のコツ
- まず `waitForSelector()` と `evaluate()` を基本に組む
- テキスト探索や要素列挙は `evaluate()` で行う
- 複雑UI（Monaco / Swagger UI など）は、DOM観察 + 座標クリック + `type()` の組み合わせを優先する
- Playwright の locator を前提に大量実装しない

### よくある失敗パターン（実際に踏んだもの）
- `ctx.page.locator(...).waitFor()` を書いてしまう
  - → Stagehand page ではそのまま通らないことがある
- `getByRole()` / `hasText` / `nth()` / `count()` を当然に使う
  - → Playwright 生 API と同じつもりで書くと壊れる
- Swagger UI や Monaco を「普通のフォーム」と思って扱う
  - → 実際には DOM 観察や座標 click の方が安定する場合がある
- selector が見つかっただけで「操作可能」とみなす
  - → hosted UI は初期表示や描画完了のタイミングがずれるので、観測対象をよく選ぶ

### 迷ったらどうするか
- まず `document.body.innerText` と対象要素の `textContent` を `evaluate()` で観察する
- 「今本当に何が表示されているか」を見てから操作方針を決める
- 生 Playwright で通るコードをそのまま Voreux に持ち込まない
- 既存サンプルで通っているパターンに寄せる

### 参考にすべき既存サンプル
- `examples/swagger-editor/tests/swagger-editor.test.ts`
- `examples/swagger-editor/tests/monaco-helpers.ts`

特に Monaco のような特殊 widget を扱う場合、
「Playwright らしい locator 操作」よりも、**Stagehand page で実際に通る最小手段** を優先してください。

## 設定

### 環境変数

| 変数 | 既定値 | 説明 |
|---|---|---|
| `OPENAI_API_KEY` | **必須** | OpenAI API キー |
| `SELF_HEAL` | `0` | `1` で自己修復を有効化 |
| `STAGEHAND_MODEL` | `openai/gpt-4o` | 使用するモデル |
| `E2E_HEADLESS` | `false` | `1` でヘッドレス実行 |

---

## この repo について（開発者向け）

このリポジトリは、**フレームワーク本体** と **そのフレームワークを利用するサンプルテストプロジェクト** を同じ repo 内で開発できるように、`pnpm workspace` 構成にしています。

- `packages/voreux` に Voreux 本体を置く
- `examples/cfe-jp` にサンプルプロジェクトを置く
- `examples/swagger-editor` に Monaco編集 + UI反映のサンプルを置く
- `examples/petstore-swagger-ui` に Swagger UI 操作（Try it out / Execute）のサンプルを置く

この構成のため、workspace 内で開発・検証する場合は以下の手順でセットアップします。

```bash
pnpm install
pnpm --filter @voreux/example-cfe-jp exec playwright install chromium
pnpm --filter @voreux/example-swagger-editor exec playwright install chromium
pnpm --filter @voreux/example-petstore-swagger-ui exec playwright install chromium
cp examples/cfe-jp/.env.example examples/cfe-jp/.env
cp examples/swagger-editor/.env.example examples/swagger-editor/.env
cp examples/petstore-swagger-ui/.env.example examples/petstore-swagger-ui/.env
# 各 .env に OPENAI_API_KEY を設定
```

`.env` は `examples/cfe-jp/.env` に置き、repo ルートには置きません。

## ディレクトリ構造

```text
.
├── packages/
│   └── voreux/          Voreux 本体（npm 公開対象）
│       ├── src/
│       │   ├── index.ts    公開 API
│       │   ├── scenario.ts  describe/test の共通ライフサイクル
│       │   ├── stagehand.ts Stagehand 初期化/終了
│       │   ├── context.ts   TestContext と共通ユーティリティ
│       │   ├── self-heal.ts self-heal 処理
│       │   ├── screenshot.ts スクリーンショット/比較
│       │   ├── recording.ts  録画処理
│       │   └── highlight.ts observe/target ハイライト
│       └── dist/           build 成果物
└── examples/
    ├── cfe-jp/           サンプルテストプロジェクト
    │   └── tests/
    │       └── cfe.test.ts サンプルシナリオ
    └── swagger-editor/   Monaco編集 + preview操作のサンプル
        └── tests/
            └── swagger-editor.test.ts
    └── petstore-swagger-ui/  Swagger UI 操作（Try it out / Execute）のサンプル
        └── tests/
            └── petstore.test.ts
```

## 公開されている型・関数

```ts
import { defineScenarioSuite } from "@uzulla/voreux";
import type { ScenarioStep, ScenarioSuiteOptions } from "@uzulla/voreux";
```

## 実行方法（開発時）

```bash
# サンプルを実行
pnpm e2e

# self-heal 付きで実行
pnpm e2e:self-heal

# workspace 全体を build
pnpm -r build

# Voreux パッケージだけ test
pnpm --filter @uzulla/voreux test

# cfe-jp サンプルだけ直接実行
pnpm --filter @voreux/example-cfe-jp e2e

# swagger-editor サンプルだけ直接実行
pnpm --filter @voreux/example-swagger-editor e2e

# petstore-swagger-ui サンプルだけ直接実行
pnpm --filter @voreux/example-petstore-swagger-ui e2e
```

## npm 公開について

npm への公開手順は `README_PUBLISH.md` を参照してください。

## ライセンス

MIT — `packages/voreux/LICENSE` を参照
