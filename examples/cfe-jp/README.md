# Voreux Sample: cfe-jp

このディレクトリは Voreux のサンプルテストプロジェクトです。

## セットアップ

このサンプルは `examples/cfe-jp/.env` を使います。
まずテンプレートをコピーして API キーを設定してください。

```bash
cp examples/cfe-jp/.env.example examples/cfe-jp/.env
# examples/cfe-jp/.env に OPENAI_API_KEY を設定
```

ローカル用の `.env` は `.gitignore` で除外されており、コミットしない前提です。

## 実行（リポジトリルートで）

```bash
pnpm e2e
```

## 直接このサンプルだけ実行

```bash
pnpm --filter @voreux/example-cfe-jp e2e
```

## テストファイル

- `tests/cfe.test.ts`
