# DevTools Recorder JSON operations support

このドキュメントは、`packages/voreux/src/scaffold-generation/from-devtools-recorder-json.ts` が
Chrome DevTools Recorder / Puppeteer Replay 由来の JSON でどの operation (`step.type`) を扱えるかを整理したものです。

JSON フォーマット仕様の参照元としては、次を起点に見るのが分かりやすいです。

- Chrome DevTools Recorder reference
  - <https://developer.chrome.com/docs/devtools/recorder/reference>
- Puppeteer Replay schema docs
  - <https://github.com/puppeteer/replay/blob/main/docs/api/modules/Schema.md>
- Puppeteer Replay `UserFlow` interface
  - <https://github.com/puppeteer/replay/blob/main/docs/api/interfaces/Schema.UserFlow.md>

※ DevTools Recorder の JSON は実質的に Puppeteer Replay schema を前提に見たほうが追いやすいです。

## 対応表

以下は Puppeteer Replay schema の `Schema.Step` / `Schema.UserStep` / `Schema.AssertionStep` を基準にした一覧です。

| operation | 現在の対応 | 備考 |
|---|---|---|
| `setViewport` | 対応 | width/height を scaffold に反映 |
| `navigate` | 対応 | originUrl 決定にも使用 |
| `click` | 対応 | selector ベースの click scaffold を生成 |
| `change` | 対応 | input/textarea への値設定 |
| `select` | 対応 | select 要素への値設定 |
| `waitForElement` | 対応 | 単純な wait scaffold として対応 |
| `type` | 対応（互換入力） | schema の主要一覧には見えないが実装では受理 |
| `hover` | 非対応 | `Unsupported DevTools Recorder step type` |
| `close` | 非対応 | 同上 |
| `doubleClick` | 非対応 | テストで unsupported 扱いを確認済み |
| `emulateNetworkConditions` | 非対応 | 同上 |
| `keyDown` | 非対応 | 同上 |
| `keyUp` | 非対応 | 同上 |
| `scroll` | 非対応 | page / element scroll とも未対応 |
| `waitForExpression` | 非対応 | assertion 系だが未対応 |
| `customStep` | 非対応 | custom step 未対応 |

## 前提

- 入力 JSON は `title` と `steps` を持つ object を想定します
- `steps` は少なくとも 1 件必要です
- 少なくとも 1 件の `navigate` step が必要です
- selector を使う step は、最終的に `document.querySelector()` 互換の selector を 1 つ選べる必要があります
  - `aria/...` / `pierce/...` / `xpath/...` は一部変換されます
  - CSS selector を 1 つも選べない場合は失敗します

## 現在サポートしている operation 一覧

現在の実装で scaffold 生成に対応している `step.type` は次のとおりです。

- `setViewport`
- `navigate`
- `click`
- `change`
- `type`
- `select`
- `waitForElement`

## operation ごとの変換内容

### `setViewport`
- 必須フィールド: `width`, `height`
- 生成内容:
  - `ctx.page.setViewportSize({ width, height })`
- 備考:
  - `deviceScaleFactor`, `isMobile`, `hasTouch`, `isLandscape` は現在 scaffold 生成には未反映

### `navigate`
- 必須フィールド: `url`
- 生成内容:
  - `ctx.page.goto(url)`
  - `ctx.page.waitForLoadState("networkidle")`
  - screenshot
- 備考:
  - 最初の `navigate` の `url` を `originUrl` として採用

### `click`
- 必須フィールド: `selectors`
- 生成内容:
  - `waitForSelector`
  - `page.evaluate(... element.click())`
  - `waitForLoadState("networkidle")`
  - screenshot
- 備考:
  - recorded selector 群はコメントとして残す

### `change`
- 必須フィールド: `selectors` と `value` または `text`
- 生成内容:
  - `input` / `textarea` に対して value を代入
  - `input` / `change` event を dispatch
  - screenshot

### `type`
- 現状の扱い:
  - `change` と同じ処理として扱う互換入力
- 必須フィールド:
  - `selectors` と `value` または `text`
- 備考:
  - 逐次 key input の再現ではなく、最終値を入れる scaffold を生成

### `select`
- 必須フィールド: `selectors`, `value`
- 生成内容:
  - `HTMLSelectElement.value` の設定
  - `input` / `change` event を dispatch
  - screenshot

### `waitForElement`
- 必須フィールド: `selectors`
- 生成内容:
  - `waitForSelector`
  - screenshot
- 備考:
  - assertion というより最小限の wait scaffold として出力
  - `operator`, `count`, `visible`, `attributes`, `properties` は現在未反映

## 実装上の補足

### unsupported operation の挙動

未対応 operation が来た場合は、現在は黙ってスキップせず失敗します。

- 例: `Unsupported DevTools Recorder step type: doubleClick`

これは不完全な scaffold を silently 生成しないための挙動です。

### selector 変換の現在仕様

以下は一定の変換を行います。

- `aria/...` → `[aria-label="..."]`
- `xpath/...` / `xpath//...` → `xpath=...`
- `pierce/...` → prefix を外す

ただし scaffold 内では `document.querySelector()` を使う step もあるため、
実質的には CSS selector が 1 つ見つかるケースを最も安全な前提にしています。

### 現在未反映の代表的な JSON フィールド

step 自体は受け付けても、次のような追加フィールドは今の scaffold では十分に使っていません。

- `assertedEvents`
- `timeout`
- `frame`
- `target`
- `offsetX`, `offsetY`
- `deviceType`
- `button`
- `operator`, `count`, `visible`, `attributes`, `properties`
- `deviceScaleFactor`, `isMobile`, `hasTouch`, `isLandscape`

## 参考

- 実装: `packages/voreux/src/scaffold-generation/from-devtools-recorder-json.ts`
- テスト: `packages/voreux/tests/scaffold-generation-from-devtools-recorder-json.test.ts`
- 参考 schema: Puppeteer Replay `Schema.UserFlow` / `Schema.Step`
- Chrome DevTools Recorder reference: <https://developer.chrome.com/docs/devtools/recorder/reference>
- Puppeteer Replay schema docs: <https://github.com/puppeteer/replay/blob/main/docs/api/modules/Schema.md>
- Puppeteer Replay `UserFlow` interface: <https://github.com/puppeteer/replay/blob/main/docs/api/interfaces/Schema.UserFlow.md>
