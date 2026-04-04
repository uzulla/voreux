# Voreux Sample: swagger-editor

このディレクトリは `editor.swagger.io` を題材にした Voreux サンプルです。

狙い:
- Monaco editor のような通常の input ではない編集領域を扱う
- 左ペインの小さな編集が右ペインへ反映されることを確認する
- 右ペインのアコーディオンUIを操作する

## セットアップ

```bash
cp .env.example .env
# examples/swagger-editor/.env に OPENAI_API_KEY を設定
```

## 実行

```bash
pnpm --filter @voreux/example-swagger-editor e2e
```

## 注意

- hosted の `editor.swagger.io` は UI や初期サンプルが変わることがあります
- このサンプルはまず「小さい編集」と「UI反映」に焦点を当てています
- `Try it out` / `Execute` は別段階のサンプル候補です
