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

## 参考リポジトリ

- Clawdbot: https://github.com/clawdbot/clawdbot
  → 詳細: `.claude/agent-docs/05-references.md`

## ドキュメント

- 要件定義: `.claude/agent-docs/01-requirements.md`
- アーキテクチャ: `.claude/agent-docs/02-architecture.md`
- フェーズ計画: `.claude/agent-docs/04-phases.md`
- UIデザイン: `.claude/agent-docs/06-ui-design.md`
