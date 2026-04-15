# Voreux

Voreux は、**Stagehand + Vitest** ベースの E2E テストフレームワークです。

AI に「クリックして」「入力して」と指示するだけで、Web ブラウザ操作を自動化するテストを書けます。

## 特徴

- **AI ファースト**: LLM に自然な指示語でブラウザ操作をさせる
- **自己修復**: 要素が見つからなくなっても自動でリトライ
- **スクリーンショット比較**: ビジュアルリグレッションも検出
- **録画対応**: テスト実行の様子を動画出力

## インストール

```bash
npm install @uzulla/voreux
# または
pnpm add @uzulla/voreux
```

**必須環境**

- Node.js >= 22.x
- pnpm >= 10.x（推奨）または npm
- Windows ユーザーは **WSL2** が必要です

## Draft scenario の扱い

Voreux では `*.draft.test.ts` を Draft scenario として扱えます。

- 通常の `voreux test` / `voreux run` では Draft は除外されます
- `--include-drafts` を付けると Draft も含めて実行されます
- `--only-drafts` を付けると Draft だけ実行されます
- `VOREUX_INCLUDE_DRAFTS=1` でも opt-in できます

例:

```bash
voreux test
voreux test --include-drafts
voreux test --only-drafts
VOREUX_INCLUDE_DRAFTS=1 voreux test
voreux test login-flow --include-drafts
```

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

## ライセンス

MIT
