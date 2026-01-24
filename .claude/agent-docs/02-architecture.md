# indra - アーキテクチャ設計

## 1. 全体構成

```
┌──────────────────┐    ┌──────────────────┐
│       CLI        │    │     Web UI       │
│  (Commander)     │    │   (Lit + Vite)   │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         │    WebSocket          │    WebSocket
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │       Gateway         │
         │   (Hono + ws)         │
         │  ・セッション管理      │
         │  ・プロトコル処理      │
         │  ・イベント配信        │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │     Agent Core        │
         │  ・LLMプロバイダー     │
         │  ・ツール実行          │
         │  ・承認管理            │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   SNS Connectors      │
         │  ・X (Twitter)        │
         │  ・note               │
         └───────────────────────┘
```

## 2. WebSocketプロトコル

Clawdbotのプロトコル設計を参考:

### フレーム構造

```typescript
// リクエストフレーム（クライアント → サーバー）
type RequestFrame = {
  type: "req";
  id: string; // リクエストID（応答紐付け用）
  method: string; // "chat.send", "post.approve"等
  params?: unknown;
};

// レスポンスフレーム（サーバー → クライアント）
type ResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
};

// イベントフレーム（サーバー → クライアント、プッシュ通知）
type EventFrame = {
  type: "event";
  event: string; // "chat.message", "post.pending"等
  payload?: unknown;
  seq?: number; // シーケンス番号
};
```

### 主要メソッド

| カテゴリ | メソッド         | 説明             |
| -------- | ---------------- | ---------------- |
| chat     | `chat.send`      | メッセージ送信   |
| chat     | `chat.history`   | 履歴取得         |
| post     | `post.create`    | 投稿作成依頼     |
| post     | `post.approve`   | 投稿承認         |
| post     | `post.reject`    | 投稿却下         |
| schedule | `schedule.add`   | スケジュール追加 |
| schedule | `schedule.list`  | スケジュール一覧 |
| config   | `config.get/set` | 設定操作         |

## 3. セッション管理

### セッションキー形式

```
agent:<agentId>:<sessionId>
```

| 例                         | 意味                                     |
| -------------------------- | ---------------------------------------- |
| `agent:main:main`          | メインエージェントのデフォルトセッション |
| `agent:sns:twitter-thread` | SNS担当エージェントの特定タスク          |

### ファイル構造

```
~/.indra/
├── indra.json              # 設定ファイル
├── credentials/            # 認証情報（暗号化）
│   ├── anthropic.json
│   ├── openai.json
│   └── x.json
├── sessions/               # セッション永続化
│   └── agent-main/
│       ├── main.jsonl
│       └── task-1.jsonl
├── approval/               # 承認待ちキュー
│   └── pending/
└── agents/
    └── main/
        └── workspace/
```

## 4. 承認フローアーキテクチャ

```
┌─────────────────┐
│  Agent生成      │
│  (投稿コンテンツ)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Approval Queue │  ← SQLite/ファイル永続化
│  (承認待ちリスト)│
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│  CLI  │ │Web UI │  ← どちらからでも承認可能
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│  承認/却下/編集  │
└────────┬────────┘
         │
         ▼ (承認時)
┌─────────────────┐
│  SNS Connector  │
│  (投稿実行)      │
└─────────────────┘
```
