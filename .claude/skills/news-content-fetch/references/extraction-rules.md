# News Content Fetch 詳細ルール

## 出力形式

```json
{
  "articleId": "xxx",
  "title": "記事タイトル",
  "summary": "100-200文字の要約",
  "body": "記事本文",
  "url": "https://...",
  "keyPoints": ["ポイント1", "ポイント2", "ポイント3"],
  "targetAudience": "個人開発者",
  "tone": "informative",
  "publishedAt": "2026-01-28",
  "source": "anthropic"
}
```

## フィールド説明

| フィールド       | 説明                                         |
| ---------------- | -------------------------------------------- |
| `articleId`      | 記事の一意識別子                             |
| `title`          | 記事タイトル                                 |
| `summary`        | 100-200文字の要約（本文から自動生成）        |
| `body`           | 記事本文                                     |
| `url`            | 記事のURL                                    |
| `keyPoints`      | 投稿に使える3-5個のポイント                  |
| `targetAudience` | 想定ターゲット（個人開発者/足場事業者/一般） |
| `tone`           | トーン（informative/practical/exciting）     |
| `publishedAt`    | 公開日                                       |
| `source`         | ソース（anthropic/rss/x）                    |

## トーン判定ルール

| ソース         | デフォルトトーン |
| -------------- | ---------------- |
| Anthropic News | informative      |
| 技術ブログ     | practical        |
| プロダクト発表 | exciting         |

## ワークフロー

1. NewsStoreから記事を取得（SQLiteクエリまたはAPI呼び出し）
2. 記事内容を解析し、キーポイントを抽出
3. ターゲット層とトーンを判定
4. 構造化されたデータを返却

## エラー時の出力

```json
{
  "error": "記事が見つかりません",
  "articleId": "xxx"
}
```

## 参照

- NewsStore: `src/news/store.ts`
- アカウント情報: `.claude/agent-docs/10-x-account.md`
