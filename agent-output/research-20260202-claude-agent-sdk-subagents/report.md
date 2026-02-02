# Claude Agent SDK サブエージェント機能 調査レポート

**作成日**: 2026-02-02
**調査方法**: Codex (GPT-5.2) による情報収集 + Claude によるレポート作成

---

## エグゼクティブサマリー

Claude Agent SDKのサブエージェント機能は、複雑なタスクを専門化されたエージェントに分割・委譲するための仕組みである。主な利点は**コンテキスト分離**、**並列実行**、**専門化**、**ツール制限による安全性向上**の4点。定義方法はプログラム的（SDK推奨）とファイルシステムベース（Markdown）の2種類がある。

---

## 1. サブエージェントの定義方法

### 1.1 プログラム的定義（推奨）

SDKの`query()`関数で`agents`パラメータを使用して定義する。

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

await query({
  prompt: "認証モジュールをレビューして",
  options: {
    agents: {
      "code-reviewer": {
        description: "コードレビュー専門家。品質・セキュリティレビューに使用。",
        prompt: "あなたはセキュリティに特化したコードレビュー担当です...",
        tools: ["Read", "Grep", "Glob"],
        model: "sonnet",
      },
    },
  },
});
```

**重要ポイント:**

- メイン側の`allowed_tools`に`Task`が必須（サブエージェント呼び出しはTaskツール経由）
- 同名のサブエージェントがある場合、プログラム定義がファイル定義より優先

### 1.2 ファイルシステムベース定義

`.claude/agents/`（プロジェクト）または`~/.claude/agents/`（ユーザー）にMarkdownファイルを配置。

```markdown
---
name: code-reviewer
description: コード変更を自動リントでレビュー
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit
model: sonnet
---

あなたはコードレビュー担当です。コードを分析し、実行可能なフィードバックを提供してください。
```

**frontmatterフィールド:**
| フィールド | 必須 | 説明 |
|-----------|------|------|
| `name` | ○ | エージェント名 |
| `description` | ○ | いつ使うかの説明 |
| `tools` | - | 許可するツール |
| `disallowedTools` | - | 禁止するツール |
| `model` | - | 使用モデル（sonnet/opus/haiku） |

---

## 2. 利用シーン

| シーン               | 説明                                                           | 例                                                       |
| -------------------- | -------------------------------------------------------------- | -------------------------------------------------------- |
| **コンテキスト管理** | メインと別コンテキストで動作し、詳細ログをメインに流し込まない | 数十ファイルの探索結果を要約してのみ返す                 |
| **並列化**           | 複数サブエージェントを同時実行                                 | style-checker、security-scanner、test-coverageを並列実行 |
| **専門化**           | 役割ごとに専用プロンプトを持たせる                             | DB移行専用エージェントにSQLベストプラクティスを持たせる  |
| **ツール制限**       | アクセス可能ツールを制限し安全性を高める                       | doc-reviewerはRead/Grepのみ（書き込み不可）              |

---

## 3. 実装例

### Python（SDKプログラム定義）

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

async def main():
    async for message in query(
        prompt="認証モジュールのセキュリティ問題をレビュー",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Grep", "Glob", "Task"],
            agents={
                "code-reviewer": AgentDefinition(
                    description="コードレビュー専門家",
                    prompt="セキュリティ脆弱性を特定し、改善を提案...",
                    tools=["Read", "Grep", "Glob"],
                    model="sonnet"
                ),
                "test-runner": AgentDefinition(
                    description="テスト実行・分析専門家",
                    prompt="テストを実行し、結果を明確に分析...",
                    tools=["Bash", "Read", "Grep"]
                )
            }
        )
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

---

## 4. ベストプラクティス

### 4.1 descriptionを具体的に書く

自動委譲の条件として使われるため、「いつ使うべきか」を明確に。

```
✗ "コードレビュー担当"
○ "コードレビュー専門家。品質・セキュリティ・保守性レビューに使用。"
```

### 4.2 安全性のためのツール制限

- `tools`/`disallowedTools`で権限を狭める
- **サブエージェント側には`Task`を与えない**（サブエージェントはさらにサブエージェントを呼べない）

### 4.3 高ボリューム出力はサブエージェントに隔離

テスト実行や調査ログなどはサブエージェントで処理し、要点だけメインへ返す。

### 4.4 並列・連鎖の使い分け

- 独立作業 → 並列実行
- 依存関係がある作業 → チェーン（順次実行）

### 4.5 モデル選択でコスト/速度調整

- 軽量タスク → `haiku`
- 複雑なタスク → `sonnet`/`opus`

---

## 5. 制限事項

| 制限               | 説明                                                 |
| ------------------ | ---------------------------------------------------- |
| モデル選択         | `sonnet`/`opus`/`haiku`/`inherit`のみ（外部LLM不可） |
| ネスト不可         | サブエージェントは更にサブエージェントを呼べない     |
| システムプロンプト | メインのシステムプロンプトは継承されない             |

---

## 参考資料

- [Claude Agent SDK - Subagents](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Claude Code - Sub-agents](https://docs.anthropic.com/en/docs/claude-code/sub-agents)

---

_このレポートはClaude Agent SDKのサブエージェント機能についてCodex (GPT-5.2) が情報収集し、Claude (Opus 4.5) がレポート化したものです。_
