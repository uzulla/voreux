# Voreux 公開手順

このリポジトリは `pnpm workspace` 構成のモノレポです。

## 公開対象

`packages/voreux` が npm 公開対象です。repo ルートではありません。

- **package 名**: `@uzulla/voreux`
- **publish 先 directory**: `packages/voreux`

## 公開前のチェック

まず、publish 対象ディレクトリへ移動します。

```bash
cd packages/voreux
```

そのうえで、以下を確認します。

```bash
# 1. npm ログイン確認
npm whoami

# 2. 公開対象 package であることを確認
npm pkg get name
# → "@uzulla/voreux"

# 3. version は packages/voreux/package.json を確認
npm pkg get version

# 4. workspace ルートで lint / check / build
cd ../..
pnpm lint
pnpm check
pnpm -r build

# 5. packages/voreux に戻って dry-run
cd packages/voreux
npm pack --dry-run
# → tarball に含まれるファイルを確認
```

## 公開コマンド

```bash
cd packages/voreux
npm publish --access public
```

## よくある失敗と対策

| 失敗 | 原因 | 対策 |
|---|---|---|
| `npm notice Skipping all unused files` | `files` フィールドが不適切 | `package.json` の `files` を確認（少なくとも `dist` は必要） |
| `Version not changed` | version を上げていない | `packages/voreux/package.json` の version を確認し、必要なら上げて commit |
| `npm whoami` fails / `ENEEDAUTH` | npm 未ログイン | `npm login` で再ログイン |
| `E404` scope not found | scope (`@uzulla`) の権限がない | `npm access list packages $(npm whoami)` などで権限を確認し、必要なら `npm publish --access public` を使う |
| 想定したファイルが tarball に入らない | `files` や package 構成の認識ずれ | root に存在する `README.md` と `LICENSE` は `files` の有無にかかわらず自動で含まれるため、実際に何が入るかは `npm pack --dry-run` で確認する |

## 公開後の検証

```bash
# npm view で確認
npm view @uzulla/voreux

# fresh install スモークテスト
cd /tmp
mkdir smoke-test && cd smoke-test
pnpm init
pnpm add @uzulla/voreux
# → Dependencies が解決できることを確認
```

## 注意事項

- workspace 構成のため、`npm publish` は `packages/voreux` ディレクトリから行う
- repo ルートの `package.json` は private workspace 用（公開不可）
- version は `packages/voreux/package.json` を確認し、Semantic Versioning に従って更新すること
