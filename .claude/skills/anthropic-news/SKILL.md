---
name: anthropic-news
description: Claude Code公式ドキュメントとAnthropicブログから最新情報を取得。WebFetch使用。「/anthropic-news」「claude最新情報」「anthropic news」で発動。
---

# Anthropic News Skill

Claude Code公式ドキュメントとAnthropicブログからWebFetchで最新情報を取得する。

## 発動キーワード

- `/anthropic-news`
- `claude最新情報`
- `anthropic news`

## 取得ソース

| ソース         | URL                            |
| -------------- | ------------------------------ |
| Anthropic News | https://www.anthropic.com/news |
| Claude Blog    | https://claude.com/blog        |

> 注: URLはリダイレクトされる場合があります。WebFetchのリダイレクト指示に従ってください。

## 基本ワークフロー

1. WebFetchで対象URLを取得
2. プロンプトで必要情報を抽出
3. **必ず以下の出力形式に従う**

## 出力形式（必須）

**重要**: 自動パーサーが処理するため、以下の形式を厳守すること。

```markdown
## Claude Code ドキュメント

1. **記事タイトル** (YYYY-MM-DD)
   URL: https://example.com/article1

2. **記事タイトル** (YYYY-MM-DD)
   URL: https://example.com/article2

## Anthropic ブログ

1. **記事タイトル** (YYYY-MM-DD)
   URL: https://www.anthropic.com/news/article1

2. **記事タイトル** (YYYY-MM-DD)
   URL: https://www.anthropic.com/news/article2
```

### 形式ルール

- セクションは `## Claude Code ドキュメント` と `## Anthropic ブログ` を使用
- 各記事は番号付きリスト（`1.`, `2.`）
- タイトルは `**太字**` で囲む
- 日付は `(YYYY-MM-DD)` 形式でタイトルの後に記載（不明な場合は省略可）
- URLは次行に `URL: ` プレフィックスで記載
- サマリーや説明文は不要（タイトルとURLのみ）

## オプション

- `docs` - ドキュメントのみ取得
- `blog` - ブログのみ取得
- 指定なし - 両方取得

## 参照

- 詳細: `references/webfetch-guide.md`
- 使用例: `examples/usage.md`
