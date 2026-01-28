# x-account-fetch

指定されたXアカウントのタイムラインからツイートを取得するスキル。

## 概要

- **トリガー**: `x-account-fetch`, `Xアカウント取得`, `ツイート取得`
- **用途**: Xアカウントのタイムラインからツイートを取得し、NewsArticle形式で返す
- **依存**: agent-browser (ブラウザ自動化)

## 入力パラメータ

```typescript
interface XAccountFetchParams {
  handle: string; // Xハンドル（例: "@AnthropicAI"）
  maxTweets?: number; // 最大取得件数（デフォルト: 20）
  hoursBack?: number; // 直近何時間以内（0 = 無制限）
  includeRetweets?: boolean; // リツイートを含むか
  includeReplies?: boolean; // リプライを含むか
}
```

## 出力形式

```typescript
interface XAccountFetchResult {
  tweets: Array<{
    id: string;
    text: string;
    url: string;
    publishedAt: string;
    authorHandle: string;
    authorName: string;
    isRetweet: boolean;
    isReply: boolean;
    metrics?: {
      likes: number;
      retweets: number;
      replies: number;
    };
  }>;
  fetchedAt: string;
}
```

## 実装手順

1. agent-browserでXのタイムラインページを開く
2. スクロールしてツイートを読み込む
3. 各ツイートのデータを抽出
4. フィルタリング（RT/リプライ）を適用
5. 結果をJSON形式で返す

## 認証について

- Xの認証状態は `~/.indra/x-session.json` で永続化
- 未認証の場合はログインを促す
- OAuth2ではなくブラウザセッションを利用

## 使用例

```
/x-account-fetch @AnthropicAI --max-tweets 50
```

## 注意事項

- X側のレート制限に注意
- スクレイピングはXの利用規約に従うこと
- 大量取得は控えめに
