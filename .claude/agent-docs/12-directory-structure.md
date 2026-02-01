# ディレクトリ構成・運用ガイド

## 運用方針

- **単一責務**: 機能(capabilities)・実行統括(orchestrator)・基盤(platform)・入出力(channels)・外部連携(integrations)を混ぜない
- **機能単位で増やす**: 新機能は `src/capabilities/<domain>/<feature>/` に追加
- **Claude Code 互換優先**: スキル/エージェントは `.claude/` 配下を正とする
- **可視性担保**: ルート直下の `skills/` はシンボリックリンクとして残す
- **変更の影響範囲を限定**: 依存方向は `channels → orchestrator → capabilities/integrations/platform`
- **SDKセッションは使い捨て**: 「真実」（復旧可能な状態）は `data/runs/` に永続化

## 命名規則

### ディレクトリ/ファイル

| 対象                 | 規則                   | 例                    |
| -------------------- | ---------------------- | --------------------- |
| ディレクトリ         | lowercase / kebab-case | `social/`, `x-post/`  |
| ファイル             | kebab-case.ts          | `workflow-service.ts` |
| TypeScript 型/クラス | PascalCase             | `PostWorkflow`        |

### スキル / エージェント

| 種別   | 形式                    | 例                      |
| ------ | ----------------------- | ----------------------- |
| skills | `domain-feature-action` | `social-x-post-compose` |
| agents | `domain-role`           | `x-operations-agent`    |

### capabilities ドメイン

| ドメイン   | 用途                          |
| ---------- | ----------------------------- |
| `social/`  | X / note / YouTube など投稿系 |
| `content/` | ニュース収集・要約・記事生成  |
| `ops/`     | Gmail・管理・自動化           |
| `calc/`    | 足場割付・計算・作図          |

## ディレクトリ構成

```
src/
├── capabilities/       # 機能ロジック
│   ├── content/
│   │   └── news/
│   └── social/
│      └── x/
├── channels/           # 入出力
│   ├── cli/
│   ├── discord/
│   └── gateway/
├── integrations/       # 外部API連携
├── orchestrator/       # LLM・スケジューラ統括
│   ├── agents/         # エージェント管理基盤
│   │   ├── subagent/   # 実行状態管理（共通）
│   │   └── x-operations/  # X運用エージェント
│   ├── analytics/
│   ├── commands/
│   ├── evaluation/
│   ├── llm/
│   └── scheduler/
└── platform/           # 横断基盤
    ├── approval/
    ├── auth/
    ├── config/
    ├── infra/
    ├── logs/
    ├── memory/
    └── tools/
data/
└── runs/               # 実行状態永続化（SDKセッションとは独立）
```

## src/orchestrator/agents/ - エージェント管理基盤

```
src/orchestrator/agents/
├── index.ts                    # 公開API
├── types.ts                    # 共通型定義（AgentDefinition, SubagentRun）
├── registry.ts                 # エージェント定義レジストリ
├── loader.ts                   # .claude/agents/からの読み込み
│
├── subagent/                   # 共通: 実行状態管理基盤
│   ├── types.ts                # SubagentRun, Checkpoint型
│   ├── run-registry.ts         # RunRegistry（実行追跡）
│   ├── checkpoint.ts           # 永続化
│   └── hooks.ts                # SDK hooks統合
│
├── x-operations/               # X運用エージェント
│   ├── index.ts                # 公開API
│   ├── agents.ts               # X用サブエージェント定義
│   ├── skills-loader.ts        # X用スキル読み込み
│   ├── workflow.ts             # XPostCheckpoint使用
│   └── idempotency.ts          # 投稿の冪等性
│
└── note-writing/               # note執筆エージェント（将来）
    └── ...
```

### 設計原則

> SDKの`resume`機能は「会話コンテキストの復元」であり「タスク状態の復元」ではない。
> この混同は致命的。

- **SDKセッションは使い捨て**: 計算資源として扱う
- **真実はdata/runs/に永続化**: チェックポイント状態を自分で保持
- **復旧可能性**: プロセス終了→再起動後も未完了タスクを検出・復旧可能

## 依存関係

```
channels → orchestrator → capabilities
                       → integrations
                       → platform
```

**逆向き依存は禁止**（例: `capabilities` → `channels`）

## 新機能追加フロー

1. `src/capabilities/<domain>/<feature>/` を作成
2. 必要なら `src/integrations/` に外部APIクライアントを追加
3. `src/orchestrator/` から呼び出しを追加
4. `.claude/skills/` と `.claude/agents/` を追加して運用に組み込む

## 既存機能の拡張フロー

1. `capabilities` 側で処理の粒度を増やす（関数/サービス追加）
2. `orchestrator` のルーティングまたはコマンドで呼び出しを増やす
3. 必要なら `skills` を追加して「再利用可能な作業手順」に切り出す

## Agents vs Skills の関係

| 概念      | 定義場所                                       | 役割                       |
| --------- | ---------------------------------------------- | -------------------------- |
| **Agent** | `.claude/agents/` + `src/orchestrator/agents/` | ワークフロー制御、状態管理 |
| **Skill** | `.claude/skills/`                              | 単一タスク実行（ツール）   |

- **Agent**: ワークフロー全体を統括し、複数のSkillを組み合わせてタスクを実行
- **Skill**: 単一の作業手順（ツールとしてAgentに利用される）
- **SubagentRegistry**: 実行状態を追跡し、復旧可能性を担保する基盤
