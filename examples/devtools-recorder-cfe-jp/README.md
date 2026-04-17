# DevTools Recorder CFE.jp Example

このシナリオグループは、**Chrome DevTools Recorder JSON から Voreux の Draft scenario scaffold を生成する PoC** のサンプルです。

## 何が入っているか

- `recorder/cfe-github-link.json`
  - Chrome DevTools Recorder 由来のサンプルJSON
  - `https://cfe.jp/` を開いて GitHub リンクをクリックするハッピーパス操作を表現
- `tests/cfe-github-link.generated.draft.test.ts`
  - 上記 JSON から生成した Draft scenario
  - selector ベースで生成され、TODO コメントを多めに残してあります

## このサンプルの目的

このツールの目的は、**正常系の操作フローを E2E の初期骨格へ変換すること** です。

つまり、これは
- 不具合再現レポート生成
- 完成済みテストの全自動生成

ではなく、

- 人間が Recorder で辿ったハッピーパスを
- Voreux の Draft scenario に起こし
- 後から assertion や観察ポイントを足して仕上げる

ためのサンプルです。

## 生成方法

PoC ツールは標準入力またはファイル入力から JSON を受け取り、標準出力に Draft scenario を出します。

```bash
node ./packages/voreux/dist/scaffold-from-devtools-recorder-json-cli.js \
  ./examples/devtools-recorder-cfe-jp/recorder/cfe-github-link.json \
  > ./examples/devtools-recorder-cfe-jp/tests/cfe-github-link.generated.draft.test.ts
```

または:

```bash
cat ./examples/devtools-recorder-cfe-jp/recorder/cfe-github-link.json \
  | node ./packages/voreux/dist/scaffold-from-devtools-recorder-json-cli.js \
  > ./examples/devtools-recorder-cfe-jp/tests/cfe-github-link.generated.draft.test.ts
```

## この後に人間がやること

生成結果はあくまで scaffold です。次のような追記が前提です。

- どこを見て成功と判断するかの assertion 追加
- 遷移先や表示変化の確認
- selector や step 名の調整
- 必要なら `act()` ベースへの書き換え

## 補足

現状の PoC では、未対応の Recorder step に遭遇した場合はエラーになります。
不足する step は今後追加していく前提です。
