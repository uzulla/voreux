# Voreux

Voreux は Stagehand + Vitest ベースの E2E テストフレームワークです。

このリポジトリは **フレームワーク本体** と **サンプルプロジェクト** を同居させた workspace 構成です。

## 構成

```text
packages/
  voreux/                フレームワーク本体（npm公開対象）

examples/
  cfe-jp/                サンプルテストプロジェクト
```

- フレームワーク本体: `packages/voreux`
- サンプル: `examples/cfe-jp`

## 重要ポイント

- 将来的にユーザーは `npm i voreux` で利用する想定
- ただしこのリポジトリ内の開発中は `workspace:*` でローカル参照するため、**npm 公開前でも動作可能**

## セットアップ（このリポジトリ内で開発・検証する場合）

```bash
pnpm install
pnpm exec playwright install chromium
cp .env.example .env
# .env に OPENAI_API_KEY を設定
```

## 実行

```bash
# サンプル(cfe-jp)を実行
pnpm e2e

# サンプル(cfe-jp)をself-healで実行
pnpm e2e:self-heal

# workspace 全体の型チェック
pnpm -r build
```

## サンプルはここ

- `examples/cfe-jp/tests/cfe.test.ts`

このサンプルは `voreux` パッケージを通常の利用者と同じ感覚で import して使っています。

## 環境変数

- `OPENAI_API_KEY` 必須
- `SELF_HEAL=1` self-heal 有効化
- `STAGEHAND_MODEL` 既定: `openai/gpt-4o`
- `E2E_HEADLESS` `1/true` で headless
- `E2E_NAV_TIMEOUT_MS` 遷移待機上限（ms）
- `E2E_VISUAL_DIFF_THRESHOLD` 画像差分FAIL閾値（例: `0.1`）
