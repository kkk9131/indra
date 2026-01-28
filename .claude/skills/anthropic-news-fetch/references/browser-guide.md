# agent-browser ガイド

## 基本コマンド

```bash
# ブラウザを開く
agent-browser open <url>

# ページ読み込み待機
agent-browser wait --load networkidle

# スナップショット取得（画像含む）
agent-browser snapshot -i

# テキスト取得（mainセレクタ推奨）
agent-browser get text main

# 画像URL取得（og:image）
agent-browser eval "document.querySelector('meta[property=\"og:image\"]')?.getAttribute('content')"

# ブラウザを閉じる
agent-browser close
```

## Anthropic News ページ構造

### 記事一覧ページ (https://www.anthropic.com/news)

- 記事カードが並んでいる
- 各カードにタイトル、日付、リンクが含まれる
- 日付は "Jan 28, 2026" のような形式

### 記事詳細ページ

- `<article>` タグ内に本文
- `<meta property="og:image">` にサムネイル画像URL
- `<time>` タグに公開日

## 日付の判定

今日の日付の記事のみを抽出する。

```javascript
const today = new Date().toISOString().split("T")[0]; // "2026-01-28"
```

## 注意事項

- ページ読み込み完了を待ってからスナップショットを取得
- 記事がない場合は空配列を返す
- エラー時は必ずbrowser closeを実行
