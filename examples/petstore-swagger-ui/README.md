# Voreux Sample: petstore-swagger-ui

このディレクトリは [Swagger Petstore](https://petstore.swagger.io/) を題材にした Voreux サンプルです。

## このサンプルで見せたいこと

- Swagger UI の **"Try it out" → パラメータ入力 → Execute → レスポンス確認** という典型的な操作フロー
- Voreux / Stagehand 環境で、**Playwright full API に寄りすぎず** Swagger UI を扱う方法
- HTTP ステータスコードとレスポンス Body を `expect` で検証する方法

## このサンプルが将来の作業者に伝えたい教訓

このサンプルは、単に Petstore を叩く例ではなく、
**「Swagger UI のような複雑UIを Voreux でどう扱うか」** の実例でもあります。

特に重要だった点:
- `ctx.page` は Playwright の生 `Page` ではない
- cookie banner を閉じないと opblock click が通らないことがある
- opblock の開閉は `.opblock-body` の有無ではなく `is-open` class の方が信頼できた
- response 待機は `.live-responses-wrapper` 前提ではなく、実際に出てくる `.response-col_status` / `.microlight` を観察して決めるべきだった
- まずブラウザで現物を観察してから selector / assertion を決める方が早い

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
- cookie banner を閉じないと opblock のクリックが通らないことがあります
- Swagger UI は **折りたたみ時でも `.opblock-body` を DOM に残すとは限らず、逆に DOM 存在だけでは開閉判定にならない** ため、このサンプルでは `is-open` クラスで展開状態を見ています
- Voreux / Stagehand では Playwright の locator full API 前提で書かず、`waitForSelector` / `evaluate` / 座標 click / `type()` を主軸に組む方が安定します
- response 待機は、先入観で wrapper selector を決めず、**実際にどの DOM が増えるか** を観察してから決めた方がよいです
- step 名に `/` を含めると screenshot path が壊れることがあるため、サンプルでは安全な step 名にする方がよいです
