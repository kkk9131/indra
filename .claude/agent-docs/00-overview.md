# indra - プロジェクト概要

## 基本情報

| 項目             | 内容                                           |
| ---------------- | ---------------------------------------------- |
| プロジェクト名   | indra                                          |
| 概要             | ローカル動作のマルチエージェントAIアシスタント |
| 主要ユースケース | SNS運用（X、note）- 投稿作成・スケジュール     |
| UI形式           | CLI + Web UI (Lit) を同時並行開発              |
| 通信             | WebSocket (Gateway方式)                        |

## 設計思想

Clawdbot (https://github.com/clawdbot/clawdbot) の設計パターンを参考にした構成:

- **ローカルファースト**: 全データをローカルに保存
- **マルチクライアント**: CLI と Web UI が対等なクライアントとして Gateway に接続
- **プラグイン拡張**: SNSコネクター等を独立パッケージとして追加可能
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
│   ├── connectors/         # SNSコネクター
│   │   ├── x/              # X (Twitter)
│   │   └── note/           # note
│   ├── approval/           # 承認フロー
│   ├── scheduler/          # スケジュール管理
│   ├── config/             # 設定管理
│   └── infra/              # 基盤（DB、ログ等）
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
