# Phase 1 実装コンテキスト

## プロジェクト: indra

ローカル動作のマルチエージェントAIアシスタント。CLI + Web UI のハイブリッド構成。

## 実装タスク

### P1-1: プロジェクト初期化

1. **P1-1-1**: pnpm monorepo セットアップ
2. **P1-1-2**: TypeScript設定 (tsconfig.json)
3. **P1-1-3**: Vitest設定
4. **P1-1-4**: Oxlint/Oxfmt設定

### P1-2: CLI基本構成

1. **P1-2-1**: Commander基本構成
2. **P1-2-2**: @clack/prompts統合
3. **P1-2-3**: `indra chat` コマンド（スタブ）
4. **P1-2-4**: `indra config` コマンド

### P1-3: Web UI基本構成

1. **P1-3-1**: Vite + Lit プロジェクト作成
2. **P1-3-2**: 接続状態表示コンポーネント
3. **P1-3-3**: チャットUIコンポーネント

### P1-4: Gateway基本構成

1. **P1-4-1**: Hono + ws サーバー基盤
2. **P1-4-2**: WebSocketプロトコル実装
3. **P1-4-3**: セッション管理・永続化

## 技術スタック

- **言語**: TypeScript 5.x (ESM, strict mode)
- **ランタイム**: Node.js 22+
- **パッケージ管理**: pnpm 9.x (monorepo)
- **CLI**: commander, @clack/prompts, chalk
- **Web UI**: Lit, Vite
- **サーバー**: Hono, ws
- **データ**: better-sqlite3, proper-lockfile
- **バリデーション**: zod
- **テスト**: Vitest
- **リンター**: Oxlint, Oxfmt

## ディレクトリ構成

```
indra/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vitest.config.ts
│
├── src/                    # コア
│   ├── cli/                # CLI関連
│   ├── commands/           # CLIコマンド
│   ├── gateway/            # WebSocketサーバー
│   │   └── protocol/       # 通信プロトコル
│   ├── config/             # 設定管理
│   └── infra/              # 基盤（DB、ログ等）
│
├── ui/                     # Web UI
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       └── ui/             # Litコンポーネント
│
└── extensions/             # プラグイン（将来）
```

## WebSocketプロトコル

```typescript
// リクエストフレーム
type RequestFrame = {
  type: "req";
  id: string;
  method: string; // "chat.send", "config.get" 等
  params?: unknown;
};

// レスポンスフレーム
type ResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
};

// イベントフレーム
type EventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
};
```

## TypeScript設定

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  }
}
```

## package.json構造

```json
{
  "name": "indra",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "indra": "dist/cli/entry.js"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

## pnpm-workspace.yaml

```yaml
packages:
  - .
  - ui
  - extensions/*
```

## 実装要件

1. 全てESMで実装
2. strict modeを有効化
3. zodでバリデーション
4. Vitestでユニットテスト作成
5. CLIとWeb UIは同一Gatewayに接続可能な設計
