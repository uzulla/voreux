# Voreux Sample: shadcn-component

このディレクトリには、`https://ui.shadcn.com` 上の
**shadcn UI コンポーネント sample 群** をまとめています。

現在含んでいる sample:
- carousel
- tooltip
- alert-dialog

## このディレクトリの方針

- shadcn UI 系の sample は同じディレクトリにまとめる
- component ごとの知見は test / helper を分けて保持する
- hosted docs サイト相手の不安定さや、Stagehand 前提の実装パターンを sample として残す

## 現在の sample

### carousel

対象:
- `https://ui.shadcn.com/docs/components/base/carousel`

見せたいこと:
- ノイジーな component docs から対象 carousel を固定する
- アニメーション完了を待って次操作へ進む
- centered item / button state / 部分 VRT で human-perceivable state change を確認する

### tooltip

対象:
- `https://ui.shadcn.com/docs/components/radix/tooltip`

見せたいこと:
- hover で表示される tooltip を扱う
- 部分 VRT で hidden → visible の変化を確認する
- pointer を外したあと tooltip が消えるところまで確認する

### alert-dialog

対象:
- `https://ui.shadcn.com/docs/components/radix/alert-dialog`

見せたいこと:
- click で alert dialog が開くこと
- dialog 表示中は overlay によって背景がボケること
- `Cancel` / `Continue` のどちらでも dialog を閉じられること
- hidden → visible の変化を部分 VRT で確認すること

## 実行

```bash
pnpm --filter @voreux/example-shadcn-component e2e
```
