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

| プロバイダー | SDK                       | 備考                      |
| ------------ | ------------------------- | ------------------------- |
| Anthropic    | @anthropic-ai/claude-code | Claude Agent SDK（推奨）  |
| Anthropic    | @anthropic-ai/sdk         | 直接API（フォールバック） |
| OpenAI       | @openai/codex             | Codex SDK（推奨）         |
| OpenAI       | openai                    | 直接API（フォールバック） |
| Google       | @google/generative-ai     | REST API                  |
| Ollama       | ollama (HTTP API)         | ローカル実行              |

### エージェントSDK 使用方法

```typescript
// Claude Agent SDK
import Anthropic from "@anthropic-ai/sdk";
const claude = new Anthropic();
const response = await claude.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 8096,
  messages: [{ role: "user", content: prompt }],
  tools: [...],
});

// Codex SDK
import { CodexSDK } from "@openai/codex";
const codex = new CodexSDK();
const response = await codex.run({
  prompt: prompt,
  tools: [...],
});
```

エージェントSDKはサブプロセスとして動作し、ツール使用やマルチターン処理を自律的に実行。

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
