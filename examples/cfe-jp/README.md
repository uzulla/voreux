# Voreux Sample: cfe-jp

このディレクトリは Voreux のサンプルテストプロジェクトです。

## セットアップ

このサンプルは `examples/cfe-jp/.env` を使います。
`examples/cfe-jp/` ディレクトリでテンプレートをコピーして API キーを設定してください。

```bash
cp .env.example .env
# examples/cfe-jp/.env に OPENAI_API_KEY を設定
```

ローカル用の `.env` は `.gitignore` で除外されており、コミットしない前提です。
また、キャッシュ・スクリーンショット・録画・ベースラインなどのサンプル生成物は
`examples/cfe-jp/` 配下に出るように設定しています。

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
