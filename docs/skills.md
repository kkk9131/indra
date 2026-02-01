# スキル / エージェント索引

## 概要

- Claude Code は `.claude/skills` と `.claude/agents` を読み込みます。
- ルート直下の `skills/` は見通しを良くするためのシンボリックリンクです。

## Agents vs Skills

| 概念      | 定義場所                                       | 役割                       |
| --------- | ---------------------------------------------- | -------------------------- |
| **Agent** | `.claude/agents/` + `src/orchestrator/agents/` | ワークフロー制御、状態管理 |
| **Skill** | `.claude/skills/`                              | 単一タスク実行（ツール）   |

- **Agent**: ワークフロー全体を統括し、複数のSkillを組み合わせてタスクを実行
- **Skill**: 単一の作業手順（ツールとしてAgentに利用される）

## スキル一覧（`.claude/skills` 配下のフォルダ）

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

### ログ・分析

- log-read: ログ読み取り
- log-analyze: ログ解析
- glm-analyze: GLM深層分析

### レポート

- report-generate: レポート生成

### ブラウザ自動化

- agent-browser: Web操作・スクレイピング

## エージェント一覧（`.claude/agents` 配下のファイル）

- x-operations-agent.md: X運用統括（ポスト作成・評価・改善・分析）
- general-purpose-agent.md: 汎用エージェント

## Agent定義フォーマット

`.claude/agents/{name}.md`:

```yaml
---
name: x-operations-agent
description: X投稿作成・評価・改善
tools: WebFetch, WebSearch, Read, Grep, Glob
model: sonnet
---

# Agent Name

エージェントの詳細説明...

## 参照スキル

- skill-name-1
- skill-name-2
```

## 新しいスキルを追加する

1. `.claude/skills/<skill-name>/SKILL.md` を作成
2. 必要に応じて `scripts/` / `assets/` などを追加

## 新しいエージェントを追加する

1. `.claude/agents/<agent-name>.md` を作成
2. frontmatter（name, description, tools, model）を定義
3. 参照するスキルを明記
