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

## agent-browser によるニュース取得

WebFetch では取得できない場合や、ページ移動が必要な場合に使用。

### Anthropic News (`https://www.anthropic.com/news`)

```bash
agent-browser open https://www.anthropic.com/news
agent-browser scroll down
agent-browser snapshot -i
agent-browser click @e<該当ref>  # 今日の日付と一致する記事
agent-browser get text
agent-browser close
```

### Claude Blog (`https://claude.com/blog`)

```bash
agent-browser open https://claude.com/blog
agent-browser scroll down
agent-browser snapshot -i
agent-browser click @e<該当ref>  # 今日の日付と一致する記事
agent-browser get text
agent-browser close
```

### 使用ガイドライン

- snapshot の `-i` オプションでインタラクティブ要素の ref を取得
- 記事リンクの ref を確認してから click で遷移
- 複数記事を取得する場合は各記事ごとに open → get text → close のサイクル
