/**
 * リサーチサブエージェント定義
 *
 * Claude Agent SDKのagents形式でリサーチエージェントを定義
 */

import { loadResearchSkills, buildSkillsPrompt } from "./skills-loader.js";

export interface ResearchAgentDefinition {
  name: string;
  description: string;
  prompt: string;
  tools?: string[];
  model?: "haiku" | "sonnet" | "opus";
}

/**
 * リサーチエージェントのシステムプロンプト
 */
const RESEARCH_SYSTEM_PROMPT = `# Research Agent

指定されたトピックについて調査し、構造化されたリサーチレポートを作成するエージェント。

## コアアイデンティティ

技術・ビジネストピックのリサーチに特化。
複数の情報源から信頼性の高い情報を収集し、分析・整理して価値あるレポートを生成。

## 行動原則

1. **客観性**: 複数のソースから情報を収集し、偏りのない分析を行う
2. **信頼性**: 公式情報源を優先し、引用元を明記
3. **構造化**: 読みやすく整理されたレポートを生成

## ワークフロー

1. トピックを分析し、検索クエリを設計
2. WebSearchで複数の観点から情報を収集
3. 収集した情報を分類・整理
4. 構造化されたMarkdownレポートを作成
5. 参考ソース一覧を付与

## レポート出力先

agent-output/research-{YYYYMMDD}-{topic}/report.md
`;

/**
 * リサーチエージェントを作成
 */
export async function createResearchAgents(
  projectRoot?: string,
): Promise<Record<string, ResearchAgentDefinition>> {
  const skills = await loadResearchSkills(projectRoot);
  const skillsPrompt = buildSkillsPrompt(skills);

  const fullPrompt = skillsPrompt
    ? `${RESEARCH_SYSTEM_PROMPT}\n\n${skillsPrompt}`
    : RESEARCH_SYSTEM_PROMPT;

  return {
    "research-agent": {
      name: "research-agent",
      description: "リサーチレポート作成エージェント",
      prompt: fullPrompt,
      tools: ["WebSearch", "Read", "Write", "Bash"],
      model: "opus",
    },
    "research-analyzer": {
      name: "research-analyzer",
      description: "収集した情報を分析・整理",
      prompt: `収集した情報を分析し、レポート構成を提案します。

## 分析観点
- 主要な発見事項の特定
- 情報の信頼性評価
- 矛盾する情報の整理
- レポート構成の提案`,
      model: "haiku",
    },
  };
}

/**
 * エージェント定義をSDK形式に変換
 */
export function toSDKAgentFormat(
  agents: Record<string, ResearchAgentDefinition>,
): Record<string, Omit<ResearchAgentDefinition, "name">> {
  return Object.fromEntries(
    Object.entries(agents).map(([key, { name: _name, ...rest }]) => [
      key,
      rest,
    ]),
  );
}
