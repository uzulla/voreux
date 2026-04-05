# Voreux Sample: swagger-editor

このディレクトリは `editor.swagger.io` を題材にした Voreux サンプルです。

## このサンプルで見せたいこと

- Monaco editor のような **通常の input ではない編集領域** を扱う
- 左ペインの小さな編集が UI 上で見えることを確認する
- 右ペインのアコーディオンUIを操作する

## 重要ポイント

このサンプルでは、Monaco editor 部分を **特別扱い** しています。

理由:
- Monaco は普通の `<input>` / `<textarea>` と同じ感覚では扱えない
- Stagehand の `page.click()` は Playwright の `page.click(selector)` とは違い、**座標クリック API**
- そのため、Monaco 用の補助ロジックを `tests/monaco-helpers.ts` に分離しています

将来的に「特殊な editor widget をどう扱うか」のドキュメント例として流用しやすいよう、
この helper はコメント多めで書いてあります。

## ファイル構成

```text
examples/swagger-editor/
  README.md
  tests/
    monaco-helpers.ts       Monaco editor 向けの特別扱い helper
    swagger-editor.test.ts  本体シナリオ
```

## セットアップ

```bash
cp .env.example .env
# examples/swagger-editor/.env に OPENAI_API_KEY を設定
```

## 実行

```bash
pnpm --filter @voreux/example-swagger-editor e2e
```

## 現在のシナリオ

1. Swagger Editor を開く
2. Monaco editor の title 行付近に人間っぽく click する
3. ` Voreux` を追記する
4. editor 表示と page 表示から「編集が入った」ことを確認する
5. 右ペインの `Parameters` / `Payload` / `Headers` / `Expand all` などを開く

## 注意

- hosted の `editor.swagger.io` は UI や初期サンプルが変わることがあります
- Monaco への caret 位置は完全固定ではないため、厳密な文字列一致より
  **「編集結果が UI 上で観測できるか」** を主軸に検証しています
- `Try it out` / `Execute` は別段階のサンプル候補です
