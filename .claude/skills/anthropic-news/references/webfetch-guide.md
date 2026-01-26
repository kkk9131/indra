# WebFetch ガイド

## WebFetch ツール仕様

- URL と prompt を受け取り、コンテンツを取得・処理
- HTML は自動的に Markdown に変換
- 大きなコンテンツは要約される場合あり

## 対象URL

### Claude Code 製品ページ

```
https://claude.com/product/claude-code
```

（リダイレクト元: `https://www.anthropic.com/claude-code`）

### Anthropic ブログ

```
https://www.anthropic.com/news
```

> 注: URLはリダイレクトされる場合があります。WebFetchのリダイレクト指示に従ってください。

## プロンプトテンプレート

### ドキュメント用

```
このClaude Codeドキュメントページから以下を抽出してください：

1. 主要なセクション/機能の一覧
2. 最近追加された機能や更新（あれば）
3. 重要なコマンドやショートカット

日本語で簡潔にまとめてください。
```

### ブログ用

```
このAnthropicブログページから以下を抽出してください：

1. 最新の記事タイトルと日付（上位5件程度）
2. Claude/Claude Code関連の記事があればその概要
3. 重要な発表やアップデート情報

日本語で簡潔にまとめてください。
```

## 出力フォーマット

```markdown
# Anthropic 最新情報

## Claude Code ドキュメント

[抽出した内容]

## Anthropic ブログ

[抽出した内容]

---

取得日時: YYYY-MM-DD HH:MM
```

## エラー時の対応

- ネットワークエラー: リトライまたはユーザーに通知
- コンテンツ取得失敗: 取得できたソースのみ出力
