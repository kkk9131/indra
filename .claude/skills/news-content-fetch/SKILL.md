---
name: news-content-fetch
description: NewsArticle IDから投稿に必要な情報を抽出する。
triggers:
  - /news-content-fetch
  - 記事内容取得
  - fetch content
---

# News Content Fetch Skill

NewsStoreから記事を取得し、X投稿作成に必要な情報を抽出する。

## 入力

- `articleId`: NewsArticleのID

## 出力

- `title`, `summary`, `body`, `url`
- `keyPoints[]`: 投稿に使える3-5個のポイント
- `targetAudience`: 想定ターゲット
- `tone`: informative/practical/exciting

→ 詳細: `references/extraction-rules.md`
