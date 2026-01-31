# スキル / サブエージェント索引

## 概要
- Claude Code は `.claude/skills` と `.claude/subagents` を読み込みます。
- ルート直下の `skills/` と `subagents/` は見通しを良くするためのシンボリックリンクです。

## スキル一覧（`.claude/skills` 配下のフォルダ）
- agent-browser
- anthropic-news-fetch
- anthropic-news-summarize
- glm-analyze
- log-analyze
- log-read
- news-content-fetch
- report-generate
- x-account-fetch
- x-algorithm-evaluate
- x-post-compose
- x-post-refine
- x-post-structure

## サブエージェント一覧（`.claude/subagents` 配下のファイル）
- analysis-agent.md
- report-agent.md
- x-post-creator.md
- x-post-evaluator.md

## 新しいスキルを追加する
1) `.claude/skills/<skill-name>/SKILL.md` を作成
2) 必要に応じて `scripts/` / `assets/` などを追加

## 新しいサブエージェントを追加する
1) `.claude/subagents/<agent-name>.md` を作成
