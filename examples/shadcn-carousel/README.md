# Voreux Sample: shadcn-carousel

このサンプルは `https://ui.shadcn.com/docs/components/base/carousel` の
**ページ最上部にある basic carousel** を対象にします。

## このサンプルで見せたいこと

- ノイジーなコンポーネントサンプルページから、テスト対象の carousel を特定する
- カルーセル操作後、**アニメーション完了を待って** 次のセルへ進む
- ボタン連打ではなく、状態変化を観測してから次の操作へ進む
- docs 上の実サンプルが **loop するのか / しないのか** を現物確認ベースで判定する
- DOM の正しさだけでなく、**人間が知覚できる見た目の変化** を重視する

## このサンプルの重要な教訓

- サンプルページは複数 carousel がありノイジーなので、最初に「どれを対象にするか」を固定する必要がある
- 今回は `data-slot="carousel"` の **最初の要素** を対象としている
- carousel の移動確認は transform よりも、**viewport 中央に最も近い item が何か** を見る方が分かりやすかった
- 現物確認の結果、docs 上の basic carousel は **loop しない**。そのためこの sample では「末尾で止まること」を検証している
- この sample では「DOM が変わったか」だけでなく、**前/次ボタンの disabled / opacity / pointer-events の変化** のような、人間に見える状態変化を重要視している
- carousel 領域だけを clip screenshot する helper を入れており、将来的に軽量な部分 VRT を追加しやすい構造にしている
- sample 専用 helper は `tests/carousel-helpers.ts` に切り出し、テスト本体では「何を検証したいか」が読めるようにしている

## 現在のシナリオ

1. 対象 carousel を特定する
2. `Next` を押して 1 → 2 → 3 へ進み、各操作の間でアニメーション終了を待つ
3. 末尾では `Next` が視覚的に無効化され、`Previous` は有効なままであることを確認する

## ファイル構成

```text
examples/shadcn-carousel/
  README.md
  tests/
    carousel-helpers.ts   carousel 向けの sample 専用 helper 群
    carousel.test.ts      教材として読む本体シナリオ
```

## 実行

```bash
pnpm --filter @voreux/example-shadcn-carousel e2e
```

## 補足

この carousel にはインジケーターが無いため、
「どのセルが見えているか」は centered item と部分 screenshot、
「もう進めないこと」は nav button の視覚状態で確認する方針にしています。
