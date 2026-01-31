# ディレクトリ構成・運用ガイド

## 運用方針

- **単一責務**: 機能(capabilities)・実行統括(orchestrator)・基盤(platform)・入出力(channels)・外部連携(integrations)を混ぜない
- **機能単位で増やす**: 新機能は `src/capabilities/<domain>/<feature>/` に追加
- **Claude Code 互換優先**: スキル/サブエージェントは `.claude/` 配下を正とする
- **可視性担保**: ルート直下の `skills/` と `subagents/` はシンボリックリンクとして残す
- **変更の影響範囲を限定**: 依存方向は `channels → orchestrator → capabilities/integrations/platform`

## 命名規則

### ディレクトリ/ファイル

| 対象                 | 規則                   | 例                    |
| -------------------- | ---------------------- | --------------------- |
| ディレクトリ         | lowercase / kebab-case | `social/`, `x-post/`  |
| ファイル             | kebab-case.ts          | `workflow-service.ts` |
| TypeScript 型/クラス | PascalCase             | `PostWorkflow`        |

### スキル / サブエージェント

| 種別      | 形式                    | 例                      |
| --------- | ----------------------- | ----------------------- |
| skills    | `domain-feature-action` | `social-x-post-compose` |
| subagents | `domain-role`           | `social-x`, `ops-gmail` |

### capabilities ドメイン

| ドメイン   | 用途                          |
| ---------- | ----------------------------- |
| `social/`  | X / note / YouTube など投稿系 |
| `content/` | ニュース収集・要約・記事生成  |
| `ops/`     | Gmail・管理・自動化           |
| `calc/`    | 足場割付・計算・作図          |

## ディレクトリ構成

```
src/
├── capabilities/       # 機能ロジック
│   ├── content/
│   │   └── news/
│   └── social/
│      └── x/
├── channels/           # 入出力
│   ├── cli/
│   ├── discord/
│   └── gateway/
├── integrations/       # 外部API連携
├── orchestrator/       # LLM・スケジューラ統括
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
```

## 依存関係

```
channels → orchestrator → capabilities
                       → integrations
                       → platform
```

**逆向き依存は禁止**（例: `capabilities` → `channels`）

## 新機能追加フロー

1. `src/capabilities/<domain>/<feature>/` を作成
2. 必要なら `src/integrations/` に外部APIクライアントを追加
3. `src/orchestrator/` から呼び出しを追加
4. `.claude/skills/` と `.claude/subagents/` を追加して運用に組み込む

## 既存機能の拡張フロー

1. `capabilities` 側で処理の粒度を増やす（関数/サービス追加）
2. `orchestrator` のルーティングまたはコマンドで呼び出しを増やす
3. 必要なら `skills` を追加して「再利用可能な作業手順」に切り出す
