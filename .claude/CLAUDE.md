# indra - ローカル汎用エージェント

## プロジェクト概要

Claude Agent SDKを活用したハイブリッド型ローカルAIエージェント。

- **対話モード**: チャットで指示→汎用Agentが直接対応
- **自律モード**: スケジュール→オーケストレーターがサブAgentに委譲→承認→実行

CLI + Web UI のハイブリッド構成。
→ 詳細: `.claude/agent-docs/02-architecture.md`

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
├── capabilities/   # 機能ロジック（content/news等）
├── channels/       # 入出力（cli, discord, gateway）
├── integrations/   # 外部API連携
├── orchestrator/   # LLM・スケジューラ統括
│   └── agents/     # エージェント管理基盤
│       ├── subagent/       # 共通基盤（BaseWorkflow, RunRegistry等）
│       ├── x-operations/   # X運用エージェント
│       └── research/       # リサーチエージェント
└── platform/       # 横断基盤（auth, memory, logs等）
ui/                 # Web UI (Litコンポーネント)
data/runs/          # 実行状態永続化
```

→ 詳細: `.claude/agent-docs/02-architecture.md`

## 開発コマンド

```bash
pnpm install          # 依存関係インストール
pnpm dev              # 開発サーバー起動
pnpm build            # ビルド
pnpm test             # テスト実行
pnpm lint             # リント
```

## 進捗状況

| Phase | 機能                            | 状態         | 自律性Level         |
| ----- | ------------------------------- | ------------ | ------------------- |
| 1     | 基盤構築                        | ✅ 完了      | L0 手動             |
| 2     | LLM統合                         | ✅ 完了      | L0                  |
| 3     | SNS連携+承認フロー              | ✅ 完了      | L0                  |
| 3R    | リサーチAgent                   | ✅ 完了      | L0                  |
| 4     | BaseWorkflow基盤+スケジューラー | ★ 次の最優先 | L2 スケジュール駆動 |
| 5     | ニュースAgent                   | 一部実装済み | -                   |
| 6     | マルチSNS (note/YouTube/TikTok) | 未着手       | -                   |
| 7     | チャンネル拡張 (Discord/GitHub) | 未着手       | L1 イベント駆動     |
| 8-9   | メディア生成 / 足場計算         | 未着手       | -                   |
| 10    | ログ・分析・プロアクティブ      | 一部実装済み | L3 機会検知         |
| 11    | マルチAgent・学習               | 未着手       | L4 適応             |

→ 詳細: `.claude/agent-docs/tasks.md`

## 主要機能

| 優先度 | 機能               | 詳細                                   |
| ------ | ------------------ | -------------------------------------- |
| 最優先 | ワークフロー基盤   | BaseWorkflow+subagent共通基盤+承認設定 |
| 高     | SNS運用自動化      | X/note/YouTube/TikTok投稿・承認フロー  |
| 高     | ニュース/レポート  | RSS/API/SNSトレンド複合ソース          |
| 中     | Discord/GitHub連携 | 双方向（通知＋イベントトリガー）       |
| 中     | 動画/画像生成      | Remotion（コードベース）               |
| 低     | 足場計算・作図     | DXF読み書き                            |

## 横断機能

- **ログ・分析**: 全操作＋外部サービス連携を記録・分析
- **ブラウザ自動化**: agent-browserによるWeb操作・スクレイピング
  → 詳細: `.claude/skills/agent-browser/SKILL.md`
- **評価システム**: Pass@K/Pass Kによるエージェント評価（設計段階、Phase 11で実装予定）

## 参考リポジトリ

- Clawdbot: https://github.com/clawdbot/clawdbot

## ドキュメント

- 要件定義: `.claude/agent-docs/01-requirements.md`
- アーキテクチャ（構成・命名規則・運用）: `.claude/agent-docs/02-architecture.md`
- 技術スタック: `.claude/agent-docs/03-tech-stack.md`
- タスク一覧・フェーズ計画: `.claude/agent-docs/tasks.md`
- UIデザイン: `.claude/agent-docs/06-ui-design.md`
- ブラウザ自動化: `.claude/agent-docs/07-browser-automation.md`
- Xアルゴリズム: `.claude/agent-docs/09-x-algorithm.md`

## Skills

### X運用

- x-post-structure: 構文テンプレート生成
- x-post-compose: ポスト生成
- x-algorithm-evaluate: Xアルゴリズム評価
- x-post-refine: 改善
- x-account-fetch: アカウント情報取得

### ニュース・コンテンツ

- anthropic-news-fetch: Anthropicニュース取得
- anthropic-news-summarize: ニュース要約
- news-content-fetch: 記事情報抽出

### ログ・分析・レポート

- log-read / log-analyze / glm-analyze / report-generate
- research-report: リサーチレポート作成

### ブラウザ自動化

- agent-browser: Web操作・スクレイピング

## Agents

- x-operations-agent: `.claude/agents/x-operations-agent.md`
  → X運用統括（ポスト作成・評価・改善・分析）
- research-agent: `.claude/agents/research-agent.md`
  → リサーチレポート作成（トピック調査・レポート生成）
- general-purpose-agent: `.claude/agents/general-purpose-agent.md`
  → 汎用エージェント

### Agents vs Skills

| 概念  | 定義場所          | 役割                       |
| ----- | ----------------- | -------------------------- |
| Agent | `.claude/agents/` | ワークフロー制御、状態管理 |
| Skill | `.claude/skills/` | 単一タスク実行（ツール）   |
