# Anthropic ニュースページ UI 仕様

## 概要

Anthropic関連のニュース（Claude Code更新、公式ブログ）をタイムライン形式で表示するUIページ。

## データ型

```typescript
type NewsSource = "claude-code" | "blog";

interface NewsArticle {
  id: string;
  source: NewsSource;
  title: string;
  summary: string | null;
  content: string | null;
  url: string;
  publishedAt: string | null;
}
```

## コンポーネント構成

### news-page.ts

メインページコンポーネント。

**責務:**

- モックデータの管理
- タブフィルターによるソース切り替え
- 更新ボタン（モック、機能は後日実装）

**State:**

- `filter`: 'all' | 'claude-code' | 'blog'
- `articles`: NewsArticle[]

### news-timeline-item.ts

タイムラインアイテムコンポーネント。

**責務:**

- 記事の概要表示
- クリックで展開/折りたたみ
- 「View Original」リンク

**Props:**

- `article`: NewsArticle
- `expanded`: boolean

**Events:**

- `toggle`: 展開/折りたたみ切り替え

## UI仕様

### タブフィルター

| タブ        | 表示内容               |
| ----------- | ---------------------- |
| All         | 全ての記事             |
| Claude Code | source = 'claude-code' |
| Blog        | source = 'blog'        |

### タイムラインアイテム

**折りたたみ状態:**

- ソースバッジ（Claude Code: 緑、Blog: 青）
- タイトル
- サマリー（1-2行）
- 展開アイコン（▼）

**展開状態:**

- ソースバッジ
- タイトル
- フルコンテンツ
- 「View Original」ボタン
- 折りたたみアイコン（▲）

### カラースキーム

| 要素               | 色                |
| ------------------ | ----------------- |
| Claude Code バッジ | #2e7d32 (緑)      |
| Blog バッジ        | #1976d2 (青)      |
| 背景（カード）     | #ffffff           |
| 背景（ページ）     | var(--bg-primary) |

## 将来の拡張

- WebSocket経由でのリアルタイム更新
- SQLiteによるデータ永続化
- 既読管理
- 通知機能
