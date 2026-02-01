/**
 * X運用サブエージェント定義
 *
 * Claude Agent SDKのagents形式でX運用エージェントを定義
 */

import { loadXOperationsSkills, buildSkillsPrompt } from "./skills-loader.js";

export interface XOperationsAgentDefinition {
  name: string;
  description: string;
  prompt: string;
  tools?: string[];
  model?: "haiku" | "sonnet" | "opus";
}

/**
 * X運用エージェントのシステムプロンプト
 */
const X_OPERATIONS_SYSTEM_PROMPT = `# X Operations Agent

X(Twitter)投稿を作成・評価・改善するエージェント。

## コアアイデンティティ

個人開発者・技術者向けのClaude Code関連コンテンツに特化。
アカウント「@kz_pro_dev」の運用方針に基づき、実践的・経験ベースの発信を行う。

## 行動原則

1. **品質優先**: 量より質。高品質なコンテンツを提供
2. **アルゴリズム最適化**: Xアルゴリズムを理解し、リーチを最大化
3. **ターゲット意識**: 個人開発者・技術者に刺さるコンテンツ設計

## ワークフロー

### ポスト作成フロー

1. 記事/コンテンツを分析
2. 3バリエーション生成
3. 各バリエーションを評価（目標: 70点以上）
4. 必要に応じて改善（最大3回）
5. ベストポスト選定

### 評価基準（100点満点）

- リプライ誘発力: 30点（質問形式、意見を求める表現）
- エンゲージメント力: 25点（いいね・RT誘発要素）
- 滞在時間: 25点（画像/動画、適切な文字数）
- コンテンツ品質: 20点（情報価値、読みやすさ）

## コンテンツガイドライン

- 実践的・経験ベースの発信
- 絵文字使用: 適度に（🚀🔥✅☝️👇👉👈推奨）
- 句読点: 使わない（改行で区切る）
- 外部リンク: 単体投稿は避ける
`;

/**
 * X運用エージェントを作成
 */
export async function createXOperationsAgents(
  projectRoot?: string,
): Promise<Record<string, XOperationsAgentDefinition>> {
  const skills = await loadXOperationsSkills(projectRoot);
  const skillsPrompt = buildSkillsPrompt(skills);

  const fullPrompt = skillsPrompt
    ? `${X_OPERATIONS_SYSTEM_PROMPT}\n\n${skillsPrompt}`
    : X_OPERATIONS_SYSTEM_PROMPT;

  return {
    "x-operations-agent": {
      name: "x-operations-agent",
      description: "X(Twitter)投稿作成・評価・改善の専門エージェント",
      prompt: fullPrompt,
      tools: ["WebFetch", "WebSearch", "Read", "Grep", "Glob"],
      model: "sonnet",
    },
    "x-post-analyzer": {
      name: "x-post-analyzer",
      description: "記事/コンテンツを分析してポスト要素を抽出",
      prompt: `記事やコンテンツを分析し、Xポストに適した要素を抽出します。

## 抽出要素
- メインメッセージ
- キーワード/ハッシュタグ候補
- フック（注目を引く要素）
- CTA（行動喚起）候補`,
      model: "haiku",
    },
    "x-post-evaluator": {
      name: "x-post-evaluator",
      description: "ポストをXアルゴリズム基準で評価",
      prompt: `生成されたポストをXアルゴリズム基準で評価します。

## 評価基準（100点満点）
- リプライ誘発力: 30点
- エンゲージメント力: 25点
- 滞在時間: 25点
- コンテンツ品質: 20点

各項目のスコアと改善提案を返します。`,
      model: "haiku",
    },
  };
}

/**
 * エージェント定義をSDK形式に変換
 */
export function toSDKAgentFormat(
  agents: Record<string, XOperationsAgentDefinition>,
): Record<string, Omit<XOperationsAgentDefinition, "name">> {
  const result: Record<string, Omit<XOperationsAgentDefinition, "name">> = {};

  for (const [key, agent] of Object.entries(agents)) {
    const { name: _name, ...rest } = agent;
    result[key] = rest;
  }

  return result;
}
