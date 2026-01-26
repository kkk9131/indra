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

| ソース              | URL                                    |
| ------------------- | -------------------------------------- |
| Claude Code Product | https://claude.com/product/claude-code |
| Anthropic Blog      | https://www.anthropic.com/news         |

> 注: URLはリダイレクトされる場合があります。WebFetchのリダイレクト指示に従ってください。

## 基本ワークフロー

1. WebFetchで対象URLを取得
2. プロンプトで必要情報を抽出
3. Markdown形式で出力

## オプション

- `docs` - ドキュメントのみ取得
- `blog` - ブログのみ取得
- 指定なし - 両方取得

## 参照

- 詳細: `references/webfetch-guide.md`
- 使用例: `examples/usage.md`
