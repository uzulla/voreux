# Voreux Sample: petstore-swagger-ui

このディレクトリは [Swagger Petstore](https://petstore.swagger.io/) を題材にした Voreux サンプルです。

## このサンプルで見せたいこと

- Swagger UI の **"Try it out" → パラメータ入力 → Execute → レスポンス確認** という典型的な操作フロー
- `selfHeal: false` の Playwright 標準ロケーターだけで完結する、速くてシンプルな E2E
- HTTP ステータスコードとレスポンス Body を `expect` で検証する方法

## テスト対象 API

| エンドポイント | 概要 | 検証内容 |
|---|---|---|
| `GET /pet/findByStatus` | status で検索 | `status=available` で実行 → 200 & JSON 配列 |
| `GET /pet/{petId}` | ID 指定取得 | `petId=1` を入力 → 200 or 404、Body が JSON |

## ファイル構成

```text
examples/petstore-swagger-ui/
  README.md
  .env.example
  .gitignore
  package.json
  tsconfig.json
  vitest.config.ts
  tests/
    petstore.test.ts    本体シナリオ
```

## セットアップ

```bash
cp .env.example .env
# examples/petstore-swagger-ui/.env に OPENAI_API_KEY を設定
```

依存インストール（repo ルートで実行）:

```bash
pnpm install
pnpm --filter @voreux/example-petstore-swagger-ui exec playwright install chromium
```

## 実行

```bash
# このサンプルだけ実行
pnpm --filter @voreux/example-petstore-swagger-ui e2e

# self-heal 付きで実行
pnpm --filter @voreux/example-petstore-swagger-ui e2e:self-heal
```

## 現在のシナリオ

1. **ページ読み込み** — Swagger UI が表示され "Swagger Petstore" の見出しが確認できること
2. **GET /pet/findByStatus** — `status=available` を選択して Execute → 200 & JSON 配列レスポンスを確認
3. **GET /pet/{petId}** — `petId=1` を入力して Execute → 200 or 404、Body が JSON であることを確認

## 注意

- `petstore.swagger.io` は公開サンドボックスのため、データは随時変化します
- `GET /pet/{petId}` は `petId=1` が存在する保証がないため、**200 または 404 の両方を許容** しています
- Swagger UI のバージョンやレイアウトが変わった場合はセレクターの調整が必要になることがあります
