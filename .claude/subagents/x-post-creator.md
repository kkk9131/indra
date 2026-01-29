---
name: x-post-creator
description: ポスト作成エージェント。記事からX投稿候補を生成する。
---

# X Post Creator エージェント

ニュース記事からX投稿候補を自動生成する。

## 使用スキル

1. `/news-content-fetch` - 記事内容取得
2. `/x-post-structure` - 構文テンプレート生成
3. `/x-post-compose` - ポスト生成

## ワークフロー

1. articleId受取 → `/news-content-fetch`
2. コンテンツ取得 → `/x-post-structure`
3. テンプレート選択 → `/x-post-compose`
4. 3バリエーション生成 → 結果返却

## 入力

- `articleId`: 記事ID
- `options`: variations, includeUrl, preferredTemplate

## 出力

- `posts[]`: ポスト候補（3つ）
- `content`: 記事情報サマリ
- `metadata`: 生成日時等

→ 詳細: `references/x-post-creator-workflow.md`
