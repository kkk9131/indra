# indra - 技術スタック

## 1. コア技術

| カテゴリ       | 技術       | バージョン | 備考                     |
| -------------- | ---------- | ---------- | ------------------------ |
| 言語           | TypeScript | 5.x        | ESM、strict mode         |
| ランタイム     | Node.js    | 22+        | LTS                      |
| パッケージ管理 | pnpm       | 9.x        | monorepo対応             |
| ビルド         | tsc + Vite |            | tsc for CLI, Vite for UI |

## 2. CLI

| ライブラリ     | 用途                       |
| -------------- | -------------------------- |
| commander      | コマンド定義               |
| @clack/prompts | インタラクティブプロンプト |
| chalk          | 色付き出力                 |
| osc-progress   | プログレスバー             |

## 3. Web UI

| ライブラリ | 用途                    |
| ---------- | ----------------------- |
| Lit        | Web Components          |
| Vite       | ビルド、開発サーバー    |
| (D3.js)    | グラフ/可視化（必要時） |

## 4. サーバー/通信

| ライブラリ | 用途                           |
| ---------- | ------------------------------ |
| Hono       | HTTPサーバー（軽量）           |
| ws         | WebSocketサーバー/クライアント |

## 5. データ永続化

| ライブラリ      | 用途                                 |
| --------------- | ------------------------------------ |
| better-sqlite3  | SQLite                               |
| proper-lockfile | ファイルロック（マルチプロセス安全） |

## 6. バリデーション/スキーマ

| ライブラリ        | 用途                       |
| ----------------- | -------------------------- |
| zod               | ランタイムバリデーション   |
| @sinclair/typebox | JSONスキーマ生成           |
| ajv               | JSONスキーマバリデーション |

## 7. LLM SDK

| SDK                            | 備考                                 |
| ------------------------------ | ------------------------------------ |
| @anthropic-ai/claude-agent-sdk | Claude Agent SDK（サブスク認証対応） |

### Claude Agent SDK 使用方法

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "What files are in this directory?",
  options: {
    model: "sonnet", // "opus", "sonnet", "haiku"
    maxTurns: 1,
  },
})) {
  if (message.type === "assistant" && message.message?.content) {
    for (const block of message.message.content) {
      if ("text" in block) {
        console.log(block.text);
      }
    }
  }
}
```

### 特徴

- **サブスク認証**: ANTHROPIC_API_KEY不要、Claudeサブスクリプションで動作
- **モデル選択**: opus / sonnet / haiku
- **ストリーミング対応**: AsyncIterableでリアルタイム出力
- **ツール機能**: 将来の拡張で活用可能

### 設計方針

- **Claude Agent SDK優先**: 今後の機能追加・リファクタリングはClaude Agent SDKが扱いやすい仕様を優先する
- **SDKとの親和性**: データ構造、インターフェース設計はSDKのメッセージ形式に合わせる
- **拡張性**: SDKのツール機能を活用しやすい設計を維持する

## 8. 開発ツール

| ツール | 用途                 |
| ------ | -------------------- |
| Vitest | テストフレームワーク |
| Oxlint | リンター             |
| Oxfmt  | フォーマッター       |

## 9. TypeScript設定

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  }
}
```

## 10. package.json 構造

```json
{
  "name": "indra",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "indra": "dist/entry.js"
  },
  "exports": {
    ".": "./dist/index.js"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

## 11. pnpm-workspace.yaml

```yaml
packages:
  - .
  - ui
  - extensions/*
```

## 12. ブラウザ自動化

| ライブラリ    | 用途                           |
| ------------- | ------------------------------ |
| agent-browser | ブラウザ操作CLI（Vercel Labs） |

### 特徴

- Rust CLI + Node.js daemon（高速）
- Playwright/Chromium ベース
- アクセシビリティツリーで要素参照（@e1形式）
- セッション・プロファイル永続化
- LLM不要（コマンドベース）

### 使用例

```bash
agent-browser open https://x.com
agent-browser snapshot --interactive
agent-browser fill @e3 "投稿内容"
agent-browser click @e5
```

→ 詳細: `.claude/agent-docs/07-browser-automation.md`
