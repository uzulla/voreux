# Voreux

Voreux は、**Stagehand + Vitest** ベースの E2E テストフレームワークです。

AI に「クリックして」「入力して」と指示するだけで、Web ブラウザ操作を自動化するテストを書けます。

## インストール

```bash
npm install @uzulla/voreux
# または
pnpm add @uzulla/voreux
```

**必須環境**

- Node.js >= 22.x
- pnpm >= 10.x（推奨）または npm
- Windows ユーザーは **WSL2** が必要です（native PowerShell / cmd は現在サポート対象外）

## クイックスタート

```bash
# プロジェクトの雛形を生成
npx @uzulla/voreux init my-e2e
cd my-e2e

# 依存をインストール
pnpm install

# OPENAI_API_KEY を設定
cp .env.example .env
# .env の OPENAI_API_KEY を実際のキーに置き換える

# テストを実行
pnpm test
```

> Note:
> 通常の公開版では `npx @uzulla/voreux init my-e2e` をそのまま使えます。
> まだ publish していないローカル変更や未公開ブランチを試す場合は、repo からの別手順で検証してください。

## Draft scenario の扱い

Voreux では `*.draft.test.ts` を Draft scenario として扱います。

- 通常の `voreux test` / `voreux run` では Draft は除外
- `--include-drafts` で Draft を含めて実行
- `--only-drafts` で Draft のみ実行
- `VOREUX_INCLUDE_DRAFTS=1` でも opt-in 可能

```bash
voreux test
voreux test --include-drafts
voreux test --only-drafts
VOREUX_INCLUDE_DRAFTS=1 voreux test
voreux test login-flow --include-drafts
```

## API リファレンス

- [Voreux / Stagehand API リファレンス](./docs/api-reference.md)
- [Voreux で E2E テストシナリオを書く方法](./docs/how-to-write-e2e-scenarios.md)
- [AI エージェントがシナリオを開発するときの行動指針](./docs/agent-behavior-for-scenario-authoring.md)

## 最初のテストを書く

```ts
import { defineScenarioSuite } from "@uzulla/voreux";

const steps = [
  {
    name: "load page",
    selfHeal: false,
    run: async (ctx) => {
      await ctx.page.goto("https://example.com/");
    },
  },
];

defineScenarioSuite({
  suiteName: "example",
  originUrl: "https://example.com/",
  steps,
});
```

## 実装者向けの重要注意: `ctx.page` は Playwright の生 `Page` ではない

Voreux の `ctx.page` は、Stagehand 経由の page オブジェクトです。
そのため、**Playwright の full API と完全互換ではありません**。

特に次は注意してください。

### 使える前提で考えてよいもの
- `ctx.page.goto(...)`
- `ctx.page.waitForSelector(...)`
- `ctx.page.waitForLoadState(...)`
- `ctx.page.evaluate(...)`
- `ctx.page.type(...)`
- `ctx.page.click(x, y)` ← **座標クリック**

### Playwright 気分でそのまま書くとハマりやすいもの
- `ctx.page.locator(...).waitFor()`
- `ctx.page.locator(...).isVisible()`
- `ctx.page.getByRole(...)`
- `ctx.page.click(selector, options)` ← **Voreux では座標クリックAPIとして扱う前提で考える**

### 実装のコツ
- まず `waitForSelector()` と `evaluate()` を基本に組む
- テキスト探索や要素列挙は `evaluate()` で行う
- 複雑UI（Monaco / Swagger UI など）は、DOM観察 + 座標クリック + `type()` の組み合わせを優先する
- Playwright の locator を前提に大量実装しない

### よくある失敗パターン（実際に踏んだもの）
- `ctx.page.locator(...).waitFor()` を書いてしまう
  - → Stagehand page ではそのまま通らないことがある
- `getByRole()` / `hasText` / `nth()` / `count()` を当然に使う
  - → Playwright 生 API と同じつもりで書くと壊れる
- Swagger UI や Monaco を「普通のフォーム」と思って扱う
  - → 実際には DOM 観察や座標 click の方が安定する場合がある
- selector が見つかっただけで「操作可能」とみなす
  - → hosted UI は初期表示や描画完了のタイミングがずれるので、観測対象をよく選ぶ

### 迷ったらどうするか
- まず `document.body.innerText` と対象要素の `textContent` を `evaluate()` で観察する
- 「今本当に何が表示されているか」を見てから操作方針を決める
- 生 Playwright で通るコードをそのまま Voreux に持ち込まない
- 既存サンプルで通っているパターンに寄せる

### 参考にすべき既存サンプル
- `examples/swagger-editor/tests/swagger-editor.test.ts`
- `examples/swagger-editor/tests/monaco-helpers.ts`
- `examples/shadcn-component/tests/carousel.test.ts`
- `examples/shadcn-component/tests/tooltip.test.ts`
- `examples/shadcn-component/tests/alert-dialog.test.ts`

特に Monaco のような特殊 widget を扱う場合、
「Playwright らしい locator 操作」よりも、**Stagehand page で実際に通る最小手段** を優先してください。

## 設定

### 環境変数

| 変数 | 既定値 | 説明 |
|---|---|---|
| `OPENAI_API_KEY` | **必須** | OpenAI API キー |
| `SELF_HEAL` | `0` | `1` で自己修復を有効化 |
| `STAGEHAND_MODEL` | `openai/gpt-4o` | 使用するモデル |
| `E2E_HEADLESS` | `false` | `1` でヘッドレス実行 |

---

## この repo について（開発者向け）

このリポジトリは、**フレームワーク本体** と **そのフレームワークを利用するサンプルテストプロジェクト** を同じ repo 内で開発できるように、`pnpm workspace` 構成にしています。

- `packages/voreux` に Voreux 本体を置く
- `examples/cfe-jp` にサンプルプロジェクトを置く
- `examples/swagger-editor` に Monaco編集 + UI反映のサンプルを置く
- `examples/petstore-swagger-ui` に Swagger UI 操作（Try it out / Execute）のサンプルを置く
- `examples/shadcn-component` に shadcn UI サンプル群をまとめる
  - carousel: カルーセル操作 + アニメーション待機
  - tooltip: hover tooltip + 表示/非表示 VRT
  - alert-dialog: click で dialog 表示 + overlay blur + close actions

この構成のため、workspace 内で開発・検証する場合は以下の手順でセットアップします。

```bash
pnpm install
cp examples/cfe-jp/.env.example examples/cfe-jp/.env
cp examples/swagger-editor/.env.example examples/swagger-editor/.env
cp examples/petstore-swagger-ui/.env.example examples/petstore-swagger-ui/.env
cp examples/shadcn-component/.env.example examples/shadcn-component/.env
# 各 .env に OPENAI_API_KEY を設定
```

`.env` は各 example ディレクトリ配下に置き、repo ルートには置きません。

### ブラウザ（Chromium）のセットアップについて

Voreux は内部で [Stagehand](https://github.com/browserbase/stagehand) を使用しており、Stagehand はブラウザ起動に `chrome-launcher` を利用します。

重要な点:
- `chrome-launcher` は **システムにインストールされた Chrome / Chromium** を探します
- **`playwright install chromium` でダウンロードした Chromium を自動では使いません**

そのため、この repo の examples では **`playwright install chromium` を前提手順として案内しません**。
まずは、各 example の `.env` に `CHROME_PATH` を明示的に設定してください。

```bash
# 例: システムにある Chromium / Chrome の実パスを設定
CHROME_PATH=/usr/bin/chromium
```

もし Playwright 管理下の Chromium を使いたい場合でも、
そのパスを自分で確認して `CHROME_PATH` に明示的に設定する必要があります。

```bash
# 例: Playwright が展開した Chromium を明示的に使う場合
CHROME_PATH=/home/<username>/.cache/ms-playwright/chromium-XXXX/chrome-linux64/chrome
```
# (~ はチルダ展開されないため、絶対パスで指定してください)

# .env に追記
CHROME_PATH=/home/<username>/.cache/ms-playwright/chromium-XXXX/chrome-linux64/chrome
```

システムに Chrome/Chromium がインストールされている場合（`/usr/bin/google-chrome` など）は `CHROME_PATH` の設定は不要です。

#### WSL2 環境での追加対応

WSL2 環境では Chromium のサンドボックス機能が使えないため、`--no-sandbox` フラグが必要です。
これは WSL2 での既知の制約であり、Voreux のフレームワーク側（`packages/voreux/src/stagehand.ts`）で既に対応済みです。

## ディレクトリ構造

```text
.
├── packages/
│   └── voreux/          Voreux 本体（npm 公開対象）
│       ├── src/
│       │   ├── index.ts    公開 API
│       │   ├── scenario.ts  describe/test の共通ライフサイクル
│       │   ├── stagehand.ts Stagehand 初期化/終了
│       │   ├── context.ts   TestContext と共通ユーティリティ
│       │   ├── self-heal.ts self-heal 処理
│       │   ├── screenshot.ts スクリーンショット/比較
│       │   ├── recording.ts  録画処理
│       │   └── highlight.ts observe/target ハイライト
│       └── dist/           build 成果物
└── examples/
    ├── cfe-jp/              サンプルテストプロジェクト
    │   └── tests/
    │       └── cfe.test.ts サンプルシナリオ
    ├── swagger-editor/      Monaco編集 + preview操作のサンプル
    │   └── tests/
    │       └── swagger-editor.test.ts
    ├── petstore-swagger-ui/ Swagger UI 操作（Try it out / Execute）のサンプル
    │   └── tests/
    │       └── petstore.test.ts
    └── shadcn-component/   shadcn UI サンプル群
        └── tests/
            ├── carousel.test.ts
            ├── tooltip.test.ts
            └── alert-dialog.test.ts
```

## 公開されている型・関数

```ts
import { defineScenarioSuite } from "@uzulla/voreux";
import type { ScenarioStep, ScenarioSuiteOptions } from "@uzulla/voreux";
```

## 実行方法（開発時）

> **重要: examples のテストを実行する前に必ず `pnpm build` を先に実行してください。**
>
> `packages/voreux` は TypeScript ソースを `dist/` にコンパイルして成果物を出力します。
> examples は `dist/` を参照するため、**build 前にテストを実行すると古い成果物を参照してしまい、
> 新しいAPIが見つからないなどのエラーが発生します。**
>
> ```bash
> pnpm build   # 必ず先に実行
> pnpm test    # その後テスト
> ```

```bash
# サンプルを実行
pnpm e2e

# self-heal 付きで実行
pnpm e2e:self-heal

# workspace 全体を build
pnpm -r build

# Voreux パッケージだけ test
pnpm --filter @uzulla/voreux test

# cfe-jp サンプルだけ直接実行
pnpm --filter @voreux/example-cfe-jp e2e

# swagger-editor サンプルだけ直接実行
pnpm --filter @voreux/example-swagger-editor e2e

# petstore-swagger-ui サンプルだけ直接実行
pnpm --filter @voreux/example-petstore-swagger-ui e2e

# shadcn-component サンプル群を直接実行
pnpm --filter @voreux/example-shadcn-component e2e
```

## browser-grounded agent work 用の MCP project config

この repo には、project-scoped の `.mcp.json` を含めています。

### なぜあるのか
- ACP / Claude Code session によっては、**実際にその session が project root として見ている場所** に MCP server が設定されていないと、Playwright browser tools が露出しないことがある
- tricky UI の authoring / debugging では、DOM 推論だけでなく **browser-grounded observation** が必要だった
- Playwright MCP を project config に置いておくことで、その観測経路を後続 agent session でも再現しやすくするため

### これは何のためか
- scenario authoring 中の browser-grounded observation / debugging
- hosted docs demo のような dynamic page で human-visible behavior を検証すること
- agent が live UI state を見たうえで、Voreux test にどう assertion を落とすか判断すること

### これは何ではないか
- Voreux の通常利用者に必須な設定ではない
- sample を Playwright test project に書き換える意図のものではない
- `examples/` にある既存の Voreux / Stagehand stack の代替ではない

実際の sample test は引き続き Voreux / Stagehand stack で書きます。`.mcp.json` は、agent が必要時に browser observation path を使えるようにするための project config です。

### 補足
- `.mcp.json` の Playwright MCP server は `@latest` ではなく固定 version を pin している
- これは agent / browser の挙動を session 間や CI 近い環境で再現しやすくするため

## Recording / annotation helpers for developers

Voreux now has framework-level human-visible action annotations.
Use these when a sample is likely to be watched by a human in a recording or demo artifact.

Available from `TestContext`:
- `ctx.annotateClick(x, y, label?)`
- `ctx.annotateKey(key)`
- `ctx.annotateHover(x, y, label?)`

Intended behavior:
- leave a frame before the action annotation
- leave a frame with the annotation visible
- leave a frame after the annotation disappears
- reduce dependence on interval timing alone for human-readable recordings

VRT-related screenshots also coordinate with recording now:
- a boundary frame is captured before the screenshot
- interval capture is paused during the screenshot
- a short stabilization wait is applied after the screenshot
- a boundary frame is captured before interval capture resumes

See:
- `packages/voreux/src/context.ts`
- `packages/voreux/src/annotation.ts`
- `packages/voreux/src/recording.ts`
- `packages/voreux/src/screenshot.ts`

## npm 公開について

npm への公開手順は `README_PUBLISH.md` を参照してください。

## ライセンス

MIT — `packages/voreux/LICENSE` を参照
