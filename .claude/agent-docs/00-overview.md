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
├── src/                    # コア
│   ├── cli/                # CLI関連
│   ├── commands/           # CLIコマンド
│   ├── gateway/            # WebSocketサーバー
│   │   └── protocol/       # 通信プロトコル
│   ├── agents/             # エージェント管理
│   ├── llm/                # LLMプロバイダー抽象化
│   ├── connectors/         # 外部サービスコネクター
│   │   ├── x/              # X (Twitter)
│   │   ├── note/           # note
│   │   ├── discord/        # Discord
│   │   └── github/         # GitHub
│   ├── news/               # ニュース取得
│   ├── media/              # 動画/画像生成
│   ├── scaffold/           # 足場計算・作図
│   ├── approval/           # 承認フロー
│   ├── scheduler/          # スケジュール管理
│   ├── logging/            # ログ・分析
│   ├── config/             # 設定管理
│   └── infra/              # 基盤（DB等）
│
├── ui/                     # Web UI
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       └── ui/             # Litコンポーネント
│
└── extensions/             # プラグイン（将来）
```

## 参考リポジトリ

- Clawdbot: https://github.com/clawdbot/clawdbot
  - Gateway/プロトコル設計
  - マルチエージェント協調
  - Lit UIコンポーネント構成
