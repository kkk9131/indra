# indra - ローカルマルチエージェントAIアシスタント

## プロジェクト概要

ローカル動作のマルチエージェントAIアシスタント。CLI + Web UI のハイブリッド構成。
→ 詳細: `.claude/agent-docs/00-overview.md`

## 技術スタック

- TypeScript (ESM), Node 22+, pnpm monorepo
- CLI: Commander + @clack/prompts
- Web UI: Lit + Vite
- Gateway: Hono + WebSocket
- LLM: Claude / OpenAI / Gemini / Ollama
  → 詳細: `.claude/agent-docs/03-tech-stack.md`

## ディレクトリ構成

```
src/           # コアロジック
ui/            # Web UI (Litコンポーネント)
extensions/    # プラグイン（将来）
```

## 開発コマンド

```bash
pnpm install          # 依存関係インストール
pnpm dev              # 開発サーバー起動
pnpm build            # ビルド
pnpm test             # テスト実行
pnpm lint             # リント
```

## 主要ユースケース

- SNS運用（X、note）
- 投稿作成・承認フロー
- スケジュール投稿

## 参考リポジトリ

- Clawdbot: https://github.com/clawdbot/clawdbot
  → 詳細: `.claude/agent-docs/05-references.md`

## ドキュメント

- 要件定義: `.claude/agent-docs/01-requirements.md`
- アーキテクチャ: `.claude/agent-docs/02-architecture.md`
- フェーズ計画: `.claude/agent-docs/04-phases.md`
- UIデザイン: `.claude/agent-docs/06-ui-design.md`
