# indra - ローカル汎用エージェント

## プロジェクト概要

Claude Agent SDKを活用したローカル汎用エージェント。CLI + Web UI のハイブリッド構成。
→ 詳細: `.claude/agent-docs/00-overview.md`

## 技術スタック

- TypeScript (ESM), Node 22+, pnpm monorepo
- CLI: Commander + @clack/prompts
- Web UI: Lit + Vite
- Gateway: Hono + WebSocket
- LLM: Claude Agent SDK（サブスク認証）
- 動画生成: Remotion
  → 詳細: `.claude/agent-docs/03-tech-stack.md`

## ディレクトリ構成

```
src/
├── capabilities/   # 機能ロジック（social/x, content/news等）
├── channels/       # 入出力（cli, discord, gateway）
├── integrations/   # 外部API連携
├── orchestrator/   # LLM・スケジューラ統括
└── platform/       # 横断基盤（auth, memory, logs等）
ui/                 # Web UI (Litコンポーネント)
```

→ 詳細: `.claude/agent-docs/12-directory-structure.md`

## 開発コマンド

```bash
pnpm install          # 依存関係インストール
pnpm dev              # 開発サーバー起動
pnpm build            # ビルド
pnpm test             # テスト実行
pnpm lint             # リント
```

## 主要機能

| 優先度 | 機能              | 詳細                          |
| ------ | ----------------- | ----------------------------- |
| 高     | ニュース/レポート | RSS/API/SNSトレンド複合ソース |
| 高     | SNS運用自動化     | X/note投稿・承認フロー        |
| 中     | Discord連携       | 双方向（通知＋コマンド）      |
| 中     | GitHub連携        | 双方向                        |
| 中     | 動画/画像生成     | Remotion（コードベース）      |
| 低     | 足場計算・作図    | DXF読み書き                   |

## 横断機能

- **ログ・分析**: 全操作＋外部サービス連携を記録・分析
- **ブラウザ自動化**: agent-browserによるWeb操作・スクレイピング
  → 詳細: `.claude/skills/agent-browser/SKILL.md`
- **評価システム**: Pass@K/Pass Kによるエージェント評価（設計中）
  → 詳細: `.claude/agent-docs/11-evaluation-system.md`

## 参考リポジトリ

- Clawdbot: https://github.com/clawdbot/clawdbot
  → 詳細: `.claude/agent-docs/05-references.md`

## ドキュメント

- 要件定義: `.claude/agent-docs/01-requirements.md`
- アーキテクチャ: `.claude/agent-docs/02-architecture.md`
- フェーズ計画: `.claude/agent-docs/04-phases.md`
- UIデザイン: `.claude/agent-docs/06-ui-design.md`
- ブラウザ自動化: `.claude/agent-docs/07-browser-automation.md`
- Xアルゴリズム: `.claude/agent-docs/09-x-algorithm.md`
- Xアカウント情報: `.claude/agent-docs/10-x-account.md`
- 評価システム: `.claude/agent-docs/11-evaluation-system.md`
- ディレクトリ構成・運用: `.claude/agent-docs/12-directory-structure.md`

## Skills

- agent-browser: `.claude/skills/agent-browser/`
- anthropic-news-fetch: `.claude/skills/anthropic-news-fetch/`
- anthropic-news-summarize: `.claude/skills/anthropic-news-summarize/`
- x-account-fetch: `.claude/skills/x-account-fetch/`
- log-read: `.claude/skills/log-read/`
- log-analyze: `.claude/skills/log-analyze/`
- glm-analyze: `.claude/skills/glm-analyze/`
- report-generate: `.claude/skills/report-generate/`
- news-content-fetch: `.claude/skills/news-content-fetch/`
- x-post-structure: `.claude/skills/x-post-structure/`
- x-post-compose: `.claude/skills/x-post-compose/`
- x-algorithm-evaluate: `.claude/skills/x-algorithm-evaluate/`
- x-post-refine: `.claude/skills/x-post-refine/`

## Agents

- x-operations-agent: `.claude/agents/x-operations-agent.md`
  → X運用統括（ポスト作成・評価・改善・分析）

## Subagents

- analysis-agent: `.claude/subagents/analysis-agent.md`
- report-agent: `.claude/subagents/report-agent.md`
