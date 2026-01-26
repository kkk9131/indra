# indra - 参考資料

## 1. Clawdbot リポジトリ

**URL**: https://github.com/clawdbot/clawdbot

### 参考にする実装

| 領域         | ファイル/ディレクトリ           | 参考ポイント               |
| ------------ | ------------------------------- | -------------------------- |
| Gateway      | `src/gateway/`                  | WebSocketサーバー実装      |
| プロトコル   | `src/gateway/protocol/`         | フレーム構造、スキーマ定義 |
| セッション   | `src/sessions/`, `src/routing/` | セッションキー管理         |
| エージェント | `src/agents/`                   | エージェント設定、スコープ |
| CLI          | `src/cli/`, `src/commands/`     | Commander構成、プロンプト  |
| UI           | `ui/src/ui/`                    | Litコンポーネント構成      |

### 設定ファイル参考

| ファイル              | 参考ポイント                 |
| --------------------- | ---------------------------- |
| `tsconfig.json`       | TypeScript設定               |
| `vitest.config.ts`    | テスト設定                   |
| `pnpm-workspace.yaml` | monorepo構成                 |
| `CLAUDE.md`           | エージェント向けドキュメント |

## 2. 技術ドキュメント

### Lit

- 公式: https://lit.dev/
- チュートリアル: https://lit.dev/tutorials/intro-to-lit/

### Hono

- 公式: https://hono.dev/
- WebSocket: https://hono.dev/helpers/websocket

### Commander

- 公式: https://github.com/tj/commander.js

### @clack/prompts

- 公式: https://github.com/natemoo-re/clack

## 3. API ドキュメント

### X (Twitter) API v2

- 公式: https://developer.x.com/en/docs/twitter-api
- ツイート投稿: https://developer.x.com/en/docs/twitter-api/tweets/manage-tweets/introduction

### note API

- 公式ドキュメントは限定的、Web自動化も検討

### LLM APIs

- Anthropic: https://docs.anthropic.com/
- OpenAI: https://platform.openai.com/docs/
- Google AI: https://ai.google.dev/docs
- Ollama: https://ollama.ai/

## 4. 設計パターン

### WebSocket通信

- JSON-RPC風のリクエスト/レスポンス
- イベントベースのプッシュ通知
- 接続時のハンドシェイク（hello/hello-ok）

### マルチエージェント

- セッションキーによるエージェント分離
- サブエージェントの階層構造
- ファイルロックによる並行安全性

### 承認フロー

- キューベースの非同期処理
- CLI/Web UIの対等なクライアント設計
- 永続化による再起動耐性

## 5. ブラウザ自動化

### agent-browser

- GitHub: https://github.com/vercel-labs/agent-browser
- AI agent向けヘッドレスブラウザCLI
- Vercel Labs製、Rust + Node.js構成

### 比較検討した選択肢

| ツール       | 特徴              | 不採用理由                |
| ------------ | ----------------- | ------------------------- |
| browser-use  | 自然言語操作      | LLMコスト高、Python依存   |
| Clawdbot内蔵 | 高機能ブラウザAPI | 統合コスト高              |
| Puppeteer    | Google製          | agent-browserの方が軽量   |
| Playwright   | Microsoft製       | agent-browserがラップ済み |
