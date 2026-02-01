# アーキテクチャ / 運用ガイド

このドキュメントは、Indra のローカル運用における方針・命名規則・ディレクトリ構成・全体構造をまとめたものです。

## 運用方針

- **単一責務**: 「機能(capabilities)」「実行統括(orchestrator)」「基盤(platform)」「入出力(channels)」「外部連携(integrations)」を混ぜない。
- **機能単位で増やす**: 新機能は `src/capabilities/<domain>/<feature>/` に追加。
- **Claude Code 互換優先**: スキル/サブエージェントは **`.claude/` 配下を正** とする。
- **可視性担保**: ルート直下の `skills/` はシンボリックリンクとして残す。
- **変更の影響範囲を限定**: 依存方向は `channels → orchestrator → capabilities/integrations/platform`。

## 命名規則

### ディレクトリ/ファイル

- **ディレクトリ**: `lowercase`（短い英単語・複合は `kebab-case`）
- **ファイル**: `kebab-case.ts`
- **TypeScript 型/クラス**: `PascalCase`

### スキル / エージェント

- **skills**: `domain-feature-action`（例: `social-x-post-compose`）
- **agents**: `domain-role`（例: `x-operations-agent`）

### capabilities ドメイン例

- `social/` : X / note / YouTube など投稿系
- `content/` : ニュース収集・要約・記事生成
- `ops/` : Gmail・管理・自動化
- `calc/` : 足場割付・計算・作図

## 命名規則（具体例）

### capabilities

- **ディレクトリ**: `src/capabilities/<domain>/<feature>/`
  - 例: `src/capabilities/social/x/`, `src/capabilities/content/news/`
- **公開エントリ**: `index.ts`
  - 例: `src/capabilities/social/x/index.ts`
- **ワークフロー**: `workflow-service.ts`
  - 例: `src/capabilities/social/x/workflow-service.ts`
- **プロンプト**: `system-prompt.ts`
  - 例: `src/capabilities/social/x/system-prompt.ts`

### integrations

- **外部サービスの名称**をそのまま使用
  - 例: `src/integrations/x.ts`, `src/integrations/discord.ts`
- **共有型**は `types.ts`
  - 例: `src/integrations/types.ts`

### channels

- **入出力チャネル**をそのまま使用
  - 例: `src/channels/cli/`, `src/channels/discord/`, `src/channels/gateway/`

### orchestrator

- **役割ベース**で分類
  - 例: `src/orchestrator/commands/`, `src/orchestrator/llm/`, `src/orchestrator/scheduler/`

### platform

- **横断的な基盤機能**に限定
  - 例: `src/platform/auth/`, `src/platform/memory/`, `src/platform/logs/`

### skills / agents

- **skills**: `domain-feature-action`（作業の粒度を小さく）
  - 例: `social-x-post-compose`, `ops-gmail-triage`, `calc-scaffold-layout`
- **agents**: `domain-role`（役割や責務を表す）
  - 例: `x-operations-agent`, `general-purpose-agent`

## ディレクトリ構成（現在）

```
.
├─ .claude/
│  ├─ skills/               # スキル定義（単一タスク）
│  └─ agents/               # エージェント定義（ワークフロー制御）
├─ skills -> .claude/skills
├─ src/
│  ├─ capabilities/
│  │  ├─ content/
│  │  │  └─ news/
│  │  └─ social/
│  │     └─ x/
│  ├─ channels/
│  │  ├─ cli/
│  │  ├─ discord/
│  │  └─ gateway/
│  ├─ integrations/
│  ├─ orchestrator/
│  │  ├─ agents/            # エージェント管理基盤
│  │  │  ├─ subagent/       # 実行状態管理（共通）
│  │  │  │  ├─ types.ts
│  │  │  │  ├─ run-registry.ts
│  │  │  │  ├─ checkpoint.ts
│  │  │  │  └─ hooks.ts
│  │  │  └─ x-operations/   # X運用エージェント
│  │  │     ├─ index.ts
│  │  │     ├─ agents.ts
│  │  │     ├─ skills-loader.ts
│  │  │     ├─ workflow.ts
│  │  │     └─ idempotency.ts
│  │  ├─ analytics/
│  │  ├─ commands/
│  │  ├─ evaluation/
│  │  ├─ llm/
│  │  └─ scheduler/
│  └─ platform/
│     ├─ approval/
│     ├─ auth/
│     ├─ config/
│     ├─ infra/
│     ├─ logs/
│     ├─ memory/
│     └─ tools/
├─ docs/
├─ data/
│  └─ runs/                 # 実行状態永続化（SDKセッションとは独立）
├─ ui/
└─ ...
```

## SubagentRegistry層

SDK公式の`resume`機能は「会話コンテキストの復元」であり「タスク状態の復元」ではない。
この混同を避けるため、SubagentRegistryで実行状態を管理する。

### 設計原則

- **SDKセッションは使い捨て可能**: 計算資源として扱う
- **真実はdata/runs/に永続化**: チェックポイント状態を自分で保持
- **復旧可能性**: プロセス終了→再起動後も未完了タスクを検出・復旧可能

### アーキテクチャ

```
Gateway / CLI
     │
     ▼
┌────────────────────────────────────────────────────┐
│  SDK公式: query({ agents, resume, hooks })          │
│  - サブエージェント定義                             │
│  - ツール実行                                       │
│  - ライフサイクルフック                             │
└────────────────────────────────────────────────────┘
     │
     ▼ フックで自動記録
┌────────────────────────────────────────────────────┐
│  SubagentRegistry                                   │
│  - runId / agentName / status                       │
│  - inputDigest / toolCalls / outputs                │
│  - チェックポイント状態                             │
│    (accountId, lastPostId, nextAction等)            │
└────────────────────────────────────────────────────┘
     │
     ▼ ローカル永続化
   data/runs/{runId}.json
```

## アーキテクチャ図

```mermaid
flowchart TD
  U[ユーザー / タスク] --> C[channels (cli/discord)]
  C --> G[gateway]
  G --> O[orchestrator]

  O --> L[LLM Provider (Agent SDK)]
  L --> S[.claude/skills]
  L --> A[.claude/agents]

  O --> Cap[capabilities]
  Cap --> Int[integrations]

  O --> Plat[platform]
  Plat --> Data[(data/)]

  Int --> Ext[外部サービス
  (X / Note / YouTube / Gmail など)]
```

## 運用方法（具体）

### 日常運用の基本

- **起動**: `pnpm gateway`（API/WebSocket）、`pnpm cli`（CLI）
- **ログ確認**: `data/` と `src/platform/logs/` を確認
- **スキル追加**: `.claude/skills/<skill-name>/SKILL.md`
- **エージェント追加**: `.claude/agents/<agent-name>.md`

### 新機能追加フロー

1. `src/capabilities/<domain>/<feature>/` を作成
2. 必要なら `src/integrations/` に外部APIクライアントを追加
3. `src/orchestrator/` から呼び出しを追加
4. `.claude/skills/` と `.claude/agents/` を追加して運用に組み込む

### 既存機能の拡張フロー

1. `capabilities` 側で処理の粒度を増やす（関数/サービス追加）
2. `orchestrator` のルーティングまたはコマンドで呼び出しを増やす
3. 必要なら `skills` を追加して「再利用可能な作業手順」に切り出す

### 依存関係のルール

- `channels` は **UI/CLI/Discord等の入出力のみ**
- `orchestrator` は **LLMやスケジューラを束ねる中枢**
- `capabilities` は **機能ロジック**
- `integrations` は **外部API連携**
- `platform` は **横断基盤**
- 逆向き依存は禁止（`capabilities` → `channels` など）
