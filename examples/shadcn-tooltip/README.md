# Voreux Sample: shadcn-tooltip

このサンプルは `https://ui.shadcn.com/docs/components/radix/tooltip` の
**最初の tooltip trigger** を対象にします。

## このサンプルで見せたいこと

- hover 待ちで表示される tooltip を Stagehand の座標 hover で扱う
- tooltip の表示を DOM だけでなく、**部分 VRT** でも確認する
- tooltip が portal されても、trigger + tooltip をまとめて clip screenshot する
- pointer を外したあと、tooltip が再び消えるところまで確認する

## このサンプルの重要な教訓

- tooltip は hover / pointer leave のような **状態遷移そのもの** を観測する必要がある
- tooltip content は portal されることがあるため、trigger 単体 screenshot では足りない
- 「出たこと」だけでなく、**消えること** まで見て初めて UI の挙動確認になる
- fixed wait は一般には推奨しない。この sample では公開 docs サイト相手の安定化のため、例外的に残している

## 現在のシナリオ

1. tooltip trigger を特定する
2. hover して tooltip が表示されるまで待つ
3. hidden → visible の見た目差分を部分 VRT で確認する
4. pointer を外し、tooltip が消えるまで確認する

## ファイル構成

```text
examples/shadcn-tooltip/
  README.md
  tests/
    tooltip-helpers.ts   tooltip 向けの sample 専用 helper 群
    visual-compare.ts    部分 VRT 用の最小比較 helper
    tooltip.test.ts      教材として読む本体シナリオ
```

## 実行

```bash
pnpm --filter @voreux/example-shadcn-tooltip e2e
```
