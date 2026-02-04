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
         │  ・Claude Agent SDK   │
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

## 1.5 エージェント層（BaseWorkflow + SubagentRegistry）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Claude Agent SDK (query + agents + hooks)                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  agents: [                                                             │ │
│  │    { name: "x-operations-agent", skills: ["x-post-*", ...] },          │ │
│  │    { name: "research-agent", skills: ["research-report"] },             │ │
│  │  ]                                                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                           │                                                  │
│                           ▼                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Skills (プロンプト注入で利用)                        │ │
│  │  .claude/skills/                                                       │ │
│  │  ├─ x-post-structure/    ├─ research-report/                           │ │
│  │  ├─ x-post-compose/      ├─ log-read/                                  │ │
│  │  ├─ x-algorithm-evaluate/├─ log-analyze/                               │ │
│  │  ├─ x-post-refine/       └─ report-generate/                           │ │
│  │  └─ news-content-fetch/                                                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│  x-operations/    │  │  research/        │  │  {new-agent}/     │
│  ├─ agents.ts     │  │  ├─ agents.ts     │  │  extends          │
│  ├─ workflow.ts   │  │  ├─ workflow.ts   │  │  BaseWorkflow     │
│  └─ idempotency   │  │  └─ utils         │  │                   │
└─────────┬─────────┘  └─────────┬─────────┘  └───────────────────┘
          └──────────────────────┴──────────────────┐
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         subagent/ (共通基盤)                                 │
│  BaseWorkflow │ RunRegistry │ Checkpoint │ SDK Hooks                        │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         永続化層 (data/runs/)                                │
│  {runId}.json - 「真実」の保存（SDKセッションは補助的）                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 設計原則

> SDKの`resume`機能は「会話コンテキストの復元」であり「タスク状態の復元」ではない。
> この混同は致命的。 — LLMディベート全員一致

- **SDKセッションは使い捨て可能**: 計算資源として扱う
- **真実は自分で保持**: 復旧可能な状態を `data/runs/` に永続化
- **チェックポイント**: タスク固有の進捗状態（phase, generatedPosts, publishedPostIds等）

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

## 5. ディレクトリ構成

```
src/
├── capabilities/       # 機能ロジック
│   └── content/
│       └── news/       # ニュース取得・保存
├── channels/           # 入出力
│   ├── cli/
│   ├── discord/
│   └── gateway/
├── integrations/       # 外部API連携
├── orchestrator/       # LLM・スケジューラ統括
│   ├── agents/         # エージェント管理基盤
│   │   ├── subagent/       # 共通基盤（BaseWorkflow, RunRegistry等）
│   │   ├── x-operations/   # X運用エージェント
│   │   └── research/       # リサーチエージェント
│   ├── analytics/
│   ├── commands/
│   ├── evaluation/
│   ├── llm/
│   └── scheduler/
└── platform/           # 横断基盤
    ├── approval/
    ├── auth/
    ├── config/
    ├── infra/
    ├── logs/
    ├── memory/
    └── tools/
data/
└── runs/               # 実行状態永続化（SDKセッションとは独立）
```

### 依存方向

```
channels → orchestrator → capabilities/integrations/platform
```

逆向き依存は禁止（例: `capabilities` → `channels`）

### 運用方針

- **単一責務**: capabilities・orchestrator・platform・channels・integrationsを混ぜない
- **機能単位で増やす**: 新機能は `src/capabilities/<domain>/<feature>/` に追加
- **Claude Code互換優先**: スキル/エージェントは `.claude/` 配下を正とする
- **SDKセッションは使い捨て**: 「真実」は `data/runs/` に永続化

## 6. 命名規則

| 対象                 | 規則                    | 例                      |
| -------------------- | ----------------------- | ----------------------- |
| ディレクトリ         | lowercase / kebab-case  | `social/`, `x-post/`    |
| ファイル             | kebab-case.ts           | `workflow-service.ts`   |
| TypeScript 型/クラス | PascalCase              | `PostWorkflow`          |
| skills               | `domain-feature-action` | `social-x-post-compose` |
| agents               | `domain-role`           | `x-operations-agent`    |

### capabilities ドメイン

| ドメイン   | 用途                          |
| ---------- | ----------------------------- |
| `social/`  | X / note / YouTube など投稿系 |
| `content/` | ニュース収集・要約・記事生成  |
| `ops/`     | Gmail・管理・自動化           |
| `calc/`    | 足場割付・計算・作図          |

## 7. 機能追加フロー

### 新エージェント追加

1. `.claude/agents/{name}.md` にエージェント定義（frontmatter + プロンプト）
2. `.claude/skills/{skill}/SKILL.md` に必要なスキルを定義
3. `src/orchestrator/agents/{name}/` を作成:
   - `agents.ts`: エージェント定義 + スキルローダー連携
   - `workflow.ts`: BaseWorkflowを継承、ドメインロジックのみ実装
   - `skills-loader.ts`: スキルファイル読み込み
   - `index.ts`: 初期化・エクスポート
4. `src/channels/gateway/` にハンドラー/サービスを追加

### 既存機能の拡張

1. `capabilities` 側で処理の粒度を増やす（関数/サービス追加）
2. `orchestrator` のルーティングまたはコマンドで呼び出しを増やす
3. 必要なら `skills` を追加して「再利用可能な作業手順」に切り出す

## 8. Agents vs Skills

| 概念      | 定義場所                                       | 役割                       |
| --------- | ---------------------------------------------- | -------------------------- |
| **Agent** | `.claude/agents/` + `src/orchestrator/agents/` | ワークフロー制御、状態管理 |
| **Skill** | `.claude/skills/`                              | 単一タスク実行（ツール）   |

- **Agent**: ワークフロー全体を統括し、複数のSkillを組み合わせてタスクを実行
- **Skill**: 単一の作業手順（ツールとしてAgentに利用される）
- **BaseWorkflow**: 共通ライフサイクル（start/complete/fail/retry）を提供する基底クラス
- **SubagentRegistry**: 実行状態を追跡し、復旧可能性を担保する基盤
