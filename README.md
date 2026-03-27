# Voreux

Voreux は、[Stagehand](https://github.com/browserbase/stagehand) + [Vitest](https://vitest.dev/) ベースの E2E テストフレームワークです。

「共通フレームワーク（support）」と「サンプル/実シナリオ（tests/mytest/*）」を分離して管理できます。

## セットアップ

```bash
pnpm install
pnpm exec playwright install chromium
cp .env.example .env
# .env を編集して OPENAI_API_KEY を設定
```

## 実行

```bash
# 全シナリオ
pnpm e2e

# セルフヒール有効
pnpm e2e:self-heal
```

## ディレクトリ構成

```text
tests/
  mytest/
    cfe.jp/
      cfe.test.ts         サンプルシナリオ（cfe.jp）

support/                 フレームワーク本体（共通実装）
  scenario.ts            シナリオ実行の共通ライフサイクル
  config.ts              設定（環境変数で上書き可能）
  stagehand.ts           Stagehand 初期化・終了
  context.ts             TestContext / 共通ユーティリティ
  self-heal.ts           self-heal 実装
  screenshot.ts          スクリーンショット / 差分比較
  recording.ts           録画（ffmpeg）
  highlight.ts           観測・ターゲットのハイライト
```

## シナリオ追加方法

1. `tests/mytest/<site-or-project>/` を作成
2. `*.test.ts` を追加
3. `support/scenario.ts` の `defineScenarioSuite()` を使って steps を定義

例:

```ts
import { defineScenarioSuite } from "../../../support/scenario.js";

defineScenarioSuite({
  suiteName: "example",
  originUrl: "https://example.com/",
  steps: [
    { name: "Navigate", selfHeal: false, run: async (ctx) => { /* ... */ } },
    { name: "Extract", run: async (ctx) => { /* ... */ } },
  ],
});
```

## 環境変数

- `OPENAI_API_KEY` 必須
- `SELF_HEAL=1` self-heal 有効化
- `STAGEHAND_MODEL` 既定: `openai/gpt-4o`
- `E2E_HEADLESS` `1/true` で headless
- `E2E_NAV_TIMEOUT_MS` 遷移待機上限（ms）
- `E2E_VISUAL_DIFF_THRESHOLD` 画像差分FAIL閾値（例: `0.1`）

## 備考

- `act()` キャッシュは `.cache/stagehand-e2e` を利用
- DOM変更時は `.cache/stagehand-e2e` を削除して再生成してください
