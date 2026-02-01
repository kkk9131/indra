# indra - プロジェクト概要

## 基本情報

| 項目           | 内容                                               |
| -------------- | -------------------------------------------------- |
| プロジェクト名 | indra                                              |
| 概要           | Claude Agent SDKを活用したローカル汎用エージェント |
| UI形式         | CLI + Web UI (Lit) を同時並行開発                  |
| 通信           | WebSocket (Gateway方式)                            |

## 主要機能

| 優先度 | 機能              | 詳細                              |
| ------ | ----------------- | --------------------------------- |
| 高     | ニュース/レポート | RSS/NewsAPI/SNSトレンド複合ソース |
| 高     | SNS運用自動化     | X/note投稿・承認フロー            |
| 中     | Discord連携       | 双方向（通知＋コマンド受付）      |
| 中     | GitHub連携        | 双方向（通知＋コマンド受付）      |
| 中     | 動画/画像生成     | Remotion（コードベース動画生成）  |
| 低     | 足場計算・作図    | DXF読み書き                       |

## 横断機能

- **ログ・分析**: 全操作＋外部サービス連携を記録・分析・レビュー

## 設計思想

Clawdbot (https://github.com/clawdbot/clawdbot) の設計パターンを参考にした構成:

- **ローカルファースト**: 全データをローカルに保存
- **マルチクライアント**: CLI と Web UI が対等なクライアントとして Gateway に接続
- **プラグイン拡張**: コネクター等を独立パッケージとして追加可能
- **マルチエージェント安全性**: 複数エージェントの同時実行に対応

## ディレクトリ構成

```
indra/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vitest.config.ts
│
├── .claude/
│   ├── agents/             # エージェント定義（マークダウン）
│   └── skills/             # スキル定義
│
├── src/
│   ├── capabilities/       # 機能ロジック
│   │   ├── content/news/   # ニュース取得・要約
│   │   └── social/x/       # X運用
│   ├── channels/           # 入出力
│   │   ├── cli/            # CLI
│   │   ├── discord/        # Discord連携
│   │   └── gateway/        # WebSocketサーバー
│   ├── integrations/       # 外部API連携
│   ├── orchestrator/       # LLM・スケジューラ統括
│   │   ├── agents/         # エージェント管理基盤
│   │   │   ├── subagent/   # 実行状態管理（共通）
│   │   │   └── x-operations/  # X運用エージェント
│   │   ├── llm/            # LLMプロバイダー
│   │   └── scheduler/      # スケジューラ
│   └── platform/           # 横断基盤
│       ├── approval/       # 承認フロー
│       ├── auth/           # 認証
│       ├── logs/           # ログ・分析
│       └── memory/         # メモリ管理
│
├── data/
│   └── runs/               # 実行状態永続化
│
├── ui/                     # Web UI (Lit)
│
└── docs/                   # ドキュメント
```

## 参考リポジトリ

- Clawdbot: https://github.com/clawdbot/clawdbot
  - Gateway/プロトコル設計
  - マルチエージェント協調
  - Lit UIコンポーネント構成
