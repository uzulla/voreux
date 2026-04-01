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
> `npx @uzulla/voreux init my-e2e` は、package がまだ npm に publish されていない段階では 404 で失敗することがあります。
> その場合は local path install か、repo からの別の bootstrap 手順を使ってください。

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

この構成のため、workspace 内で開発・検証する場合は以下の手順でセットアップします。

```bash
pnpm install
pnpm --filter @voreux/example-cfe-jp exec playwright install chromium
cp examples/cfe-jp/.env.example examples/cfe-jp/.env
# examples/cfe-jp/.env に OPENAI_API_KEY を設定
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
    └── cfe-jp/           サンプルテストプロジェクト
        └── tests/
            └── cfe.test.ts サンプルシナリオ
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

# サンプルだけ直接実行
pnpm --filter @voreux/example-cfe-jp e2e
```

## ライセンス

MIT — `packages/voreux/LICENSE` を参照
