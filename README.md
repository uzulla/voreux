# Stagehand E2E Test

[Stagehand](https://github.com/browserbase/stagehand) + [Vitest](https://vitest.dev/) で https://cfe.jp/ に対する E2E テストを行うプロジェクト。

## セットアップ

```bash
# 依存パッケージのインストール
pnpm install

# Playwright の Chromium をインストール（初回のみ）
pnpm exec playwright install chromium

# 環境変数の設定
cp .env.example .env
# .env を編集して OPENAI_API_KEY を設定
```

## 実行

```bash
# 通常実行
pnpm e2e

# セルフヒールモード（失敗時にキャッシュ削除 + リトライ）
pnpm e2e:self-heal
```

## 環境変数

| 変数 | 説明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API キー（必須） |
| `SELF_HEAL=1` | セルフヒールモード。失敗時にキャッシュ削除・ページリロード・リトライを行う |

## プロジェクト構成

```
tests/
  e2e/
    cfe.test.ts           テストシナリオ（Vitest の describe/test 形式）
support/
  stagehand.ts            Stagehand 初期化・終了、出力ディレクトリ準備
  context.ts              TestContext インタフェース・ファクトリ、VisualRegressionError
  self-heal.ts            セルフヒール（タブ閉じ・キャッシュ削除・リロード・リトライ）
  screenshot.ts           スクリーンショット撮影、ベースライン比較（pixelmatch）
  recording.ts            フレームキャプチャ、ffmpeg で MP4 変換
  highlight.ts            DOM ハイライトオーバーレイ注入
vitest.config.ts          Vitest 設定
baselines/                ビジュアルリグレッション用ベースライン画像
screenshots/              （生成）テスト中のスクリーンショット
recordings/               （生成）テスト録画（MP4）
```

## テストの流れ

`tests/e2e/cfe.test.ts` で以下の 5 テストが順次実行される:

1. **Navigate to page** — `page.goto()` でサイトを開く
2. **Extract profile** — `extract()` で名前・肩書き・SNS リンク一覧を構造化抽出
3. **Extract books** — `extract()` で著書タイトル・説明を抽出
4. **Observe links** — `observe()` でクリック可能な要素を列挙しハイライト表示
5. **Click GitHub link** — `act()` で GitHub リンクをクリックし、遷移先を検証

各テストでスクリーンショットが `screenshots/` に保存され、テスト全体の録画が `recordings/test-recording.mp4` に出力される。

## Stagehand とは

[Browserbase](https://www.browserbase.com/) が開発した AI 駆動のブラウザ自動化フレームワーク。Playwright を拡張し、自然言語でブラウザを操作する 3 つのプリミティブを提供する:

- **`act(instruction)`** — 自然言語で操作を指示（クリック、入力など）
- **`extract(instruction, schema)`** — Zod スキーマに沿った構造化データ抽出
- **`observe(instruction)`** — 操作可能な要素の発見・列挙

ローカルモード (`env: "LOCAL"`) では Browserbase のクラウド不要で、ローカルの Chromium + LLM API キーだけで動作する。

## 動画録画

テスト中 500ms 間隔でブラウザ画面をキャプチャし、テスト終了後に ffmpeg で MP4 に変換する。ffmpeg 未インストール時はフレーム画像が `recordings/frames/` に残る。

> **なぜ Playwright の `recordVideo` を使わないのか？**
> Stagehand v3 は Playwright の BrowserContext ではなく CDP 直接接続の `V3Context` でブラウザを制御しており、Playwright の録画 API にアクセスできない。

## セルフヒール + ビジュアルリグレッション検知

`SELF_HEAL=1` 時のみ有効。`act()` のキャッシュ破損（セレクタずれ）からの自動復旧を行う。ただしページ自体の視覚的崩壊（ビジュアルリグレッション）はヒール対象外で即 FAIL。

```
ページスクリーンショット撮影
       │
  ベースライン存在？ ── No ──→ 初回: そのまま実行
       │ Yes
  pixelmatch で比較
       │
  差異 > 10% ? ── Yes ──→ FAIL (VisualRegressionError)
       │ No
  テスト本体を実行
       │
  成功？ ── Yes ──→ PASS
       │ No
  SELF_HEAL=1 ? ── No ──→ FAIL
       │ Yes
  キャッシュ削除 → ページリロード → リトライ
       │
  成功？ ── Yes ──→ PASS
       │ No
       └──→ FAIL
```

`baselines/` にテスト成功時のスクリーンショットが保存される。ビューポートサイズ固定（1280x720）で比較の安定性を確保。閾値は `support/context.ts` の `VISUAL_DIFF_THRESHOLD` で調整可能（デフォルト 10%）。

## act() キャッシュ

コンストラクタの `cacheDir` で有効化。`act()` の結果（xpath セレクタ）をローカルにキャッシュし、2回目以降は LLM を呼ばず直接操作する。

- 対象は `act()` のみ。`extract()` / `observe()` はキャッシュされない
- キャッシュキーは instruction + URL のハッシュ
- DOM 構造が変わったら `rm -rf .cache/cfe-test` で再生成
- キャッシュヒット時も操作対象を誤る可能性があるため、`act()` 後のアサーションは必須

## v3 API のハマりポイント

### `extract()` は位置引数

```typescript
// OK
const data = await stagehand.extract("instruction", zodSchema);

// NG（schema が無視され pageText のみ返る）
const data = await stagehand.extract({ instruction: "...", schema: zodSchema });
```

### `model` の指定が必要

```typescript
const stagehand = new Stagehand({
  env: "LOCAL",
  model: "openai/gpt-4o",  // これがないと AI 機能が動かない
});
```

### V3Context の制限

- `stagehand.context` は Playwright の `BrowserContext` ではなく `V3Context`
- `waitForEvent()` がないため、新タブ検出は `context.pages()` のポーリングで代替
- Pages から `.context()` メソッドも使えない

## 参考リンク

- [Stagehand GitHub](https://github.com/browserbase/stagehand)
- [Stagehand Docs](https://docs.stagehand.dev/)
- [Vitest](https://vitest.dev/)
- [Caching Best Practices](https://docs.stagehand.dev/v3/best-practices/caching)
