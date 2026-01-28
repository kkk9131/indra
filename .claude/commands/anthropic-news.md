---
allowed-tools: Skill
description: Anthropicニュースを取得して要約付きで返す
---

# Anthropic News Command

2つのスキルを組み合わせてニュースを取得・要約する。

## アーキテクチャ

```
/anthropic-news (このコマンド)
    ├── anthropic-news-fetch スキル (記事取得)
    │   └── agent-browser で記事一覧・詳細を取得
    │       → タイトル、URL、日付、本文、画像URL
    │
    └── anthropic-news-summarize スキル (要約生成)
        └── 本文から100-200文字の日本語要約を生成
```

## 実行手順

1. Skillツールで `anthropic-news-fetch` スキルを呼び出す
2. 取得した各記事の本文に対して `anthropic-news-summarize` スキルで要約生成
3. JSON形式で出力

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
      "imageUrl": "https://...image.png",
      "summary": "記事の要約（100-200文字）"
    }
  ]
}
```

## フィールド説明

- `source`: "blog"（Anthropicブログ）または "claude-code"（Claude Codeドキュメント）
- `title`: 記事のタイトル
- `url`: 記事の完全URL
- `publishedAt`: 公開日（YYYY-MM-DD形式）
- `body`: 記事本文（全文）
- `imageUrl`: サムネイル画像URL
- `summary`: 記事内容の日本語要約（100-200文字）

## 注意事項

- 今日の記事がない場合は `{"articles": []}` を返す
- エラー発生時も必ずJSON形式で返す: `{"articles": [], "error": "エラー内容"}`
- 要約は必ず日本語で記述
- fetchスキルでbodyが取得できなかった場合、summaryは空文字列
