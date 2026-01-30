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

## 取得ソース（3つすべてを順番に処理すること）

| #   | ソース      | URL                                   | source値      |
| --- | ----------- | ------------------------------------- | ------------- |
| 1   | News        | https://www.anthropic.com/news        | `blog`        |
| 2   | Research    | https://www.anthropic.com/research    | `research`    |
| 3   | Engineering | https://www.anthropic.com/engineering | `engineering` |

## オプション

- `translate`: `true`の場合、タイトルと本文を日本語に翻訳（デフォルト: `false`）
- `sources`: 取得するソースの配列（デフォルト: すべて）

## ワークフロー

### ステップ1: 今日の日付を確認

```bash
date +%Y-%m-%d
```

この日付（例: `2026-01-30`）を `TODAY` として記憶する。

### ステップ2: 3つのソースを順番に処理

**必ず以下の3つのURLを順番に処理すること:**

#### 2-1. News (blog)

```bash
agent-browser open https://www.anthropic.com/news
agent-browser wait --load networkidle
agent-browser snapshot -i
```

→ 今日の日付（TODAY）の記事があるか確認

#### 2-2. Research (research)

```bash
agent-browser open https://www.anthropic.com/research
agent-browser wait --load networkidle
agent-browser snapshot -i
```

→ 今日の日付（TODAY）の記事があるか確認

#### 2-3. Engineering (engineering)

```bash
agent-browser open https://www.anthropic.com/engineering
agent-browser wait --load networkidle
agent-browser snapshot -i
```

→ 今日の日付（TODAY）の記事があるか確認

### ステップ3: 今日の記事を判定

**重要**: 記事の日付を確認し、TODAY と完全一致する記事のみを対象とする。

日付フォーマットの例:

- "Jan 30, 2026" → 2026-01-30
- "January 30, 2026" → 2026-01-30

**判定基準**:

- 記事の公開日がTODAYと一致する → 取得対象
- 記事の公開日がTODAYと異なる → スキップ
- 日付が不明な記事 → スキップ

### ステップ4: 今日の記事がある場合のみ詳細取得

今日の記事がある場合のみ、各記事URLにアクセス:

```bash
agent-browser open <article-url>
agent-browser get text main
agent-browser eval "document.querySelector('meta[property=\"og:image\"]')?.getAttribute('content')"
```

### ステップ5: 翻訳（オプション）

translateオプションが有効な場合、タイトルと本文を日本語に翻訳。

### ステップ6: 終了

```bash
agent-browser close
```

## 重要な注意事項

- **3つのソースすべてを必ず処理すること**
- **今日の記事がない場合は空の配列 `[]` を返す**
- 過去の記事は絶対に取得しない
- 日付の判定は厳密に行う（年月日が完全一致）

## 出力形式（必須）

以下のJSON形式で出力すること。他のテキストは出力しない。

### 今日の記事がある場合

```json
{
  "articles": [
    {
      "source": "blog",
      "title": "Article Title from News",
      "titleJa": "記事タイトル（日本語訳）",
      "url": "https://www.anthropic.com/news/...",
      "publishedAt": "2026-01-30",
      "body": "Article body (full text)",
      "bodyJa": "記事本文（日本語訳）",
      "imageUrl": "https://...image.png"
    },
    {
      "source": "research",
      "title": "Research Paper Title",
      "titleJa": null,
      "url": "https://www.anthropic.com/research/...",
      "publishedAt": "2026-01-30",
      "body": "Research paper content",
      "bodyJa": null,
      "imageUrl": "https://...image.png"
    }
  ]
}
```

### 今日の記事がない場合

```json
{
  "articles": []
}
```

## フィールド説明

- `source`: ソース種別（必ず正しいsource値を設定すること）
  - `"blog"`: https://www.anthropic.com/news からの記事
  - `"research"`: https://www.anthropic.com/research からの記事
  - `"engineering"`: https://www.anthropic.com/engineering からの記事
- `title`: 記事のタイトル（原文）
- `titleJa`: 日本語タイトル（translateオプション有効時のみ、無効時はnull）
- `url`: 記事の完全URL
- `publishedAt`: 公開日（YYYY-MM-DD形式）
- `body`: 記事本文（原文、HTMLタグ除去済み）
- `bodyJa`: 日本語本文（translateオプション有効時のみ、無効時はnull）
- `imageUrl`: サムネイル画像URL（og:imageまたはメイン画像）

## 翻訳ガイドライン

- 技術用語・固有名詞（Claude, Anthropic, API名等）はそのまま維持
- 自然な日本語表現を使用
- 原文の意味を正確に伝える

## エラー時の出力

```json
{
  "articles": [],
  "error": "エラー内容"
}
```

## 参照

- agent-browserガイド: `references/browser-guide.md`
