# アーキテクチャ / 運用ガイド

このドキュメントは、Indra のローカル運用における方針・命名規則・ディレクトリ構成・全体構造をまとめたものです。

## 運用方針
- **単一責務**: 「機能(capabilities)」「実行統括(orchestrator)」「基盤(platform)」「入出力(channels)」「外部連携(integrations)」を混ぜない。
- **機能単位で増やす**: 新機能は `src/capabilities/<domain>/<feature>/` に追加。
- **Claude Code 互換優先**: スキル/サブエージェントは **`.claude/` 配下を正** とする。
- **可視性担保**: ルート直下の `skills/` と `subagents/` はシンボリックリンクとして残す。
- **変更の影響範囲を限定**: 依存方向は `channels → orchestrator → capabilities/integrations/platform`。

## 命名規則
### ディレクトリ/ファイル
- **ディレクトリ**: `lowercase`（短い英単語・複合は `kebab-case`）
- **ファイル**: `kebab-case.ts`
- **TypeScript 型/クラス**: `PascalCase`

### スキル / サブエージェント
- **skills**: `domain-feature-action`（例: `social-x-post-compose`）
- **subagents**: `domain-role`（例: `social-x`, `ops-gmail`）

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

### skills / subagents
- **skills**: `domain-feature-action`（作業の粒度を小さく）
  - 例: `social-x-post-compose`, `ops-gmail-triage`, `calc-scaffold-layout`
- **subagents**: `domain-role`（役割や責務を表す）
  - 例: `social-x`, `content-news`, `ops-gmail`

## ディレクトリ構成（現在）
```
.
├─ .claude/
│  ├─ skills/
│  └─ subagents/
├─ skills -> .claude/skills
├─ subagents -> .claude/subagents
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
├─ ui/
└─ ...
```

## アーキテクチャ図
```mermaid
flowchart TD
  U[ユーザー / タスク] --> C[channels (cli/discord)]
  C --> G[gateway]
  G --> O[orchestrator]

  O --> L[LLM Provider (Agent SDK)]
  L --> S[.claude/skills]
  L --> SA[.claude/subagents]

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
- **サブエージェント追加**: `.claude/subagents/<agent-name>.md`

### 新機能追加フロー
1) `src/capabilities/<domain>/<feature>/` を作成
2) 必要なら `src/integrations/` に外部APIクライアントを追加
3) `src/orchestrator/` から呼び出しを追加
4) `.claude/skills/` と `.claude/subagents/` を追加して運用に組み込む

### 既存機能の拡張フロー
1) `capabilities` 側で処理の粒度を増やす（関数/サービス追加）
2) `orchestrator` のルーティングまたはコマンドで呼び出しを増やす
3) 必要なら `skills` を追加して「再利用可能な作業手順」に切り出す

### 依存関係のルール
- `channels` は **UI/CLI/Discord等の入出力のみ**
- `orchestrator` は **LLMやスケジューラを束ねる中枢**
- `capabilities` は **機能ロジック**
- `integrations` は **外部API連携**
- `platform` は **横断基盤**
- 逆向き依存は禁止（`capabilities` → `channels` など）
