以下は、Claude Agent SDKのサブエージェント機能についての調査まとめです（Markdown形式）。

# Claude Agent SDK サブエージェント調査まとめ

## 1) サブエージェントの定義方法（プログラム的 vs ファイルシステム）

### プログラム的（SDK推奨）
- SDKでは`query()`の`agents`パラメータでサブエージェントを定義します（TypeScript / Python）。Claudeは`description`を見て自動的に呼び出しを判断します。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))  
- サブエージェント呼び出しはTaskツール経由なので、**メイン側の`allowed_tools`に`Task`が必須**です。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))  
- `AgentDefinition`の主要フィールドは`description`、`prompt`、`tools`、`model`など。`tools`未指定ならメインと同等のツールを継承します。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))  
- **同名のサブエージェントがある場合、プログラム定義がファイル定義より優先**されます。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))  

### ファイルシステム（Markdown + YAML frontmatter）
- `.claude/agents/`（プロジェクト）や`~/.claude/agents/`（ユーザー）にMarkdownファイルとして定義可能で、SDK側でも検出される方式です。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))  
- frontmatterで`name`/`description`が必須、`tools`/`disallowedTools`/`model`/`permissionMode`/`skills`/`hooks`などを指定できます。([docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/sub-agents))  
- Claude Codeでは`--agents`フラグでJSON定義も可能（セッション限定）。([docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/sub-agents))  
- サブエージェントは**独立のシステムプロンプトのみ**を受け取り、メインのシステムプロンプトは継承しません。([docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/sub-agents))  

> 参考：SDKドキュメントでは「プログラム的定義が推奨」と明記。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))

---

## 2) 利用シーン（コンテキスト管理、並列化、専門化、ツール制限）

- **コンテキスト管理**: サブエージェントはメインと別コンテキストで動作し、詳細な探索ログをメインに流し込まない。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))  
- **並列化**: 複数サブエージェントを同時実行でき、レビューや調査を並列化可能。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))  
- **専門化**: 役割ごとに専用プロンプトを持たせ、特定領域に最適化できる。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))  
- **ツール制限**: `tools`や`disallowedTools`でアクセス可能ツールを制限し、安全性を高める。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))  

---

## 3) 実装例・コードサンプル

### Python（SDKのプログラム定義）
```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

async def main():
    async for message in query(
        prompt="Review the authentication module for security issues",
        options=ClaudeAgentOptions(
            # Task tool is required for subagent invocation
            allowed_tools=["Read", "Grep", "Glob", "Task"],
            agents={
                "code-reviewer": AgentDefinition(
                    description="Expert code review specialist. Use for quality, security, and maintainability reviews.",
                    prompt="""You are a code review specialist with expertise in security, performance, and best practices.
When reviewing code:
- Identify security vulnerabilities
- Check for performance issues
- Verify adherence to coding standards
- Suggest specific improvements
Be thorough but concise in your feedback.""",
                    tools=["Read", "Grep", "Glob"],
                    model="sonnet"
                ),
                "test-runner": AgentDefinition(
                    description="Runs and analyzes test suites. Use for test execution and coverage analysis.",
                    prompt="""You are a test execution specialist. Run tests and provide clear analysis of results.""",
                    tools=["Bash", "Read", "Grep"]
                )
            }
        )
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```
([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))

### TypeScript（SDKのプログラム定義：概念例）
```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

await query({
  prompt: "Review the authentication module for security issues",
  options: {
    agents: {
      "code-reviewer": {
        description: "Expert code review specialist. Use for quality, security, and maintainability reviews.",
        prompt: "You are a code review specialist focused on security and best practices.",
        tools: ["Read", "Grep", "Glob"],
        model: "sonnet"
      }
    }
  }
});
```
([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))

### ファイル定義（Markdown + YAML frontmatter）
```markdown
---
name: code-reviewer
description: Review code changes with automatic linting
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit
model: sonnet
---
You are a code reviewer. Analyze the code and provide actionable feedback.
```
([docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/sub-agents))

---

## 4) ベストプラクティス

- **`description`を具体的に**: 自動委譲の条件として使われるため、「いつ使うべきか」を明確に書く。必要なら“use proactively”のような文言で積極的委譲を促す。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))  
- **安全性のためのツール制限**: `tools`/`disallowedTools`で権限を狭める。サブエージェント側には`Task`を与えない（サブエージェントはさらにサブエージェントを呼べない）。([platform.claude.com](https://platform.claude.com/docs/en/agent-sdk/subagents))  
- **高ボリューム出力はサブエージェントに隔離**: テスト実行や調査ログなどはサブエージェントで処理し、要点だけメインへ返す。([docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/sub-agents))  
- **並列・連鎖の使い分け**: 独立作業は並列、依存関係がある作業は「チェーン」させる。([docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/sub-agents))  
- **モデル選択でコスト/速度調整**: `model`で`haiku`などの軽量モデルを使い、コストやレイテンシを制御。([docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code/sub-agents))  

---

必要なら、目的や開発言語に合わせて「最小構成のSDKサンプル」や「自分のチーム向けのサブエージェント定義テンプレート」も作成できます。