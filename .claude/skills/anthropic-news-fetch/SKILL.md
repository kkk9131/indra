---
name: anthropic-news-fetch
description: agent-browserでAnthropicニュース記事を取得。タイトル・URL・日付・本文・画像URLを返す。
triggers:
  - /anthropic-news-fetch
  - 記事を取得
  - fetch news
allowed-tools: Bash(agent-browser:*)
---

# Anthropic News Fetch Skill

agent-browserを使用してAnthropicニュース記事を取得する。

## 発動キーワード

- `/anthropic-news-fetch`
- `記事を取得`

## 取得ソース

| ソース         | URL                            |
| -------------- | ------------------------------ |
| Anthropic News | https://www.anthropic.com/news |

## ワークフロー

1. `agent-browser open https://www.anthropic.com/news`
2. `agent-browser wait --load networkidle`
3. `agent-browser snapshot -i` で記事一覧取得
4. **今日の日付の記事のみ**を特定
5. 各記事URLにアクセス:
   - `agent-browser open <article-url>`
   - `agent-browser get text main` で本文取得
   - `agent-browser eval "document.querySelector('meta[property=\"og:image\"]')?.getAttribute('content')"` で画像URL取得
6. `agent-browser close`
7. JSON形式で出力

> 今日の記事がない場合は空の配列を返す

## 出力形式（必須）

以下のJSON形式で出力すること。他のテキストは出力しない。

```json
{
  "articles": [
    {
      "source": "blog",
      "title": "記事タイトル",
      "url": "https://...",
      "publishedAt": "2026-01-28",
      "body": "記事本文（全文）",
      "imageUrl": "https://...image.png"
    }
  ]
}
```

## フィールド説明

- `source`: "blog"（Anthropicブログ）
- `title`: 記事のタイトル
- `url`: 記事の完全URL
- `publishedAt`: 公開日（YYYY-MM-DD形式）
- `body`: 記事本文（全文、HTMLタグ除去済み）
- `imageUrl`: サムネイル画像URL（og:imageまたはメイン画像）

## エラー時の出力

```json
{
  "articles": [],
  "error": "エラー内容"
}
```

## 参照

- agent-browserガイド: `references/browser-guide.md`
