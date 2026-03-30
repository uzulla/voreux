# Voreux

Voreux は、Stagehand + Vitest ベースの E2E テストフレームワークです。

このリポジトリは、**フレームワーク本体** と **そのフレームワークを利用するサンプルテストプロジェクト** を同じ repo 内で開発できるように、`pnpm workspace` 構成にしています。

## この repo の考え方

```bash
npm install voreux
```

ただし、開発中に毎回 npm へ publish しないとサンプルが動かない構成だと不便です。
そこでこの repo では、workspace を使って次のようにしています。

- `packages/voreux` に **Voreux 本体** を置く
- `examples/cfe-jp` に **Voreux を使うサンプルプロジェクト** を置く
- サンプル側は `voreux: workspace:*` で **ローカルの Voreux** を参照する

これにより、**npm 未公開の状態でも、利用時に近い形でサンプルを動かせる** ようになっています。

## ディレクトリ構造

```text
.
├── package.json                workspaceルート用 package.json
├── pnpm-workspace.yaml         workspace 定義
├── packages/
│   └── voreux/
│       ├── package.json        Voreux 本体の package 定義
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts        公開API
│       │   ├── scenario.ts     describe/test の共通ライフサイクル
│       │   ├── stagehand.ts    Stagehand 初期化/終了
│       │   ├── context.ts      TestContext と共通ユーティリティ
│       │   ├── self-heal.ts    self-heal 処理
│       │   ├── screenshot.ts   スクリーンショット/比較
│       │   ├── recording.ts    録画処理
│       │   ├── highlight.ts    observe/target ハイライト
│       │   └── config.ts       環境変数ベース設定
│       ├── tests/
│       │   └── public-api.test.ts  公開APIのスモークテスト
│       └── dist/               build成果物（生成物）
└── examples/
    └── cfe-jp/
        ├── package.json        サンプルプロジェクト定義
        ├── tsconfig.json
        ├── vitest.config.ts
        ├── README.md
        └── tests/
            └── cfe.test.ts     サンプルシナリオ
```

## 役割分担

### `packages/voreux`

Voreux 本体です。npm 公開対象はこちらです。

この package は、Stagehand ベースの E2E シナリオを組み立てるための共通機能を提供します。

現時点では主に以下を持っています。

- `defineScenarioSuite()` によるシナリオ定義
- `ScenarioStep` / `ScenarioSuiteOptions` 型エクスポート
- Stagehand の初期化/終了
- self-heal
- スクリーンショット撮影
- ビジュアル差分検知
- 録画処理
- observe/act の補助

### 公開されている型

`voreux` は関数だけでなく、以下の型も public API として export しています。

- `ScenarioStep`
- `ScenarioSuiteOptions`

TypeScript では、これらを使ってシナリオ定義を型安全に書けます。

```ts
import { defineScenarioSuite } from "voreux";
import type { ScenarioStep, ScenarioSuiteOptions } from "voreux";

const steps: ScenarioStep[] = [
  {
    name: "Navigate",
    selfHeal: false,
    run: async (ctx) => {
      await ctx.page.goto("https://example.com/");
    },
  },
];

const suite: ScenarioSuiteOptions = {
  suiteName: "example",
  originUrl: "https://example.com/",
  steps,
};

defineScenarioSuite(suite);
```

### `examples/cfe-jp`

Voreux を利用する **サンプルテストプロジェクト** です。

このサンプルは framework 内部を相対 import せず、通常利用者に近い形で:

```ts
import { defineScenarioSuite } from "voreux";
```

として使います。

ただし実体は npm レジストリではなく workspace 経由で解決されます。

## セットアップ

**推奨環境**

- Node.js >= 22.x
- pnpm >= 10.x

この repo は `pnpm workspace` 前提で構成しているため、Node.js / pnpm のバージョン差異があると再現性が崩れる可能性があります。
必要に応じて以下で確認してください。

```bash
node --version
pnpm --version
```

この repo 内で開発・検証する場合は、workspace ルートでセットアップします。

```bash
pnpm install
pnpm --filter @voreux/example-cfe-jp exec playwright install chromium
cp examples/cfe-jp/.env.example examples/cfe-jp/.env
# examples/cfe-jp/.env に OPENAI_API_KEY を設定
```

`.env` はサンプルプロジェクト側（`examples/cfe-jp/.env`）に置きます。
ルートの `.env` は不要です。
ローカル用の `.env` は `examples/cfe-jp/.gitignore` で除外します。
また、sample 実行時の `.cache` / `screenshots` / `recordings` / `baselines` も
repo 直下ではなく `examples/cfe-jp/` 配下へ出るようにしています。

## 実行方法

### サンプルを実行

```bash
pnpm e2e
```

これは workspace ルートから `examples/cfe-jp` の E2E を実行します。
`examples/cfe-jp/.env` に `OPENAI_API_KEY` が入っていれば、そのまま通ります。

### self-heal 付きで実行

```bash
pnpm e2e:self-heal
```

### workspace 全体を build

```bash
pnpm -r build
```

### Voreux パッケージだけ test

```bash
pnpm --filter voreux test
```

### サンプルだけ直接実行

```bash
pnpm --filter @voreux/example-cfe-jp e2e
```

## サンプルはここ

サンプルシナリオはここにあります。

- `examples/cfe-jp/tests/cfe.test.ts`

まずはこのファイルを見れば、Voreux をどう使うかが分かるようにしています。

より詳しいシナリオ作成ガイド:
- `docs/how-to-write-e2e-scenarios.md`

## 利用イメージ

```ts
import { defineScenarioSuite } from "voreux";
```

この repo では、その最終利用形に近い形を保ちながら、publish 前でも workspace で開発できるようにしています。

## 環境変数

- `OPENAI_API_KEY`
  - 必須
- `SELF_HEAL=1`
  - self-heal を有効化
- `STAGEHAND_MODEL`
  - 既定: `openai/gpt-4o`
- `E2E_HEADLESS`
  - `1` / `true` で headless 実行
- `E2E_NAV_TIMEOUT_MS`
  - 遷移待機上限（ms）
- `E2E_VISUAL_DIFF_THRESHOLD`
  - 画像差分 FAIL 閾値（例: `0.1`）
