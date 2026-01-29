/**
 * X Post Workflow System Prompt Builder
 * Embeds scoring rules and templates for X algorithm optimization
 */

import type { NewsArticle } from "../news/types.js";

const SCORING_RULES = `
## スコアリングルール

### 基本構造
最終スコア = 基準スコア(50) + 加点 - 減点
最大スコア = 100, 最小スコア = 0

### 加点ルール
1. **質問形式 (+20点)**: 末尾に「?」「？」、「どう思う？」などの問いかけ
2. **適切な文字数 (+10点)**: 400-500文字が最適、450文字前後が理想（X Premium長文）
3. **箇条書き使用 (+5点)**: 「・」「-」「1.」などのリスト形式、3項目以上
4. **絵文字適度 (+3点)**: 🔥🚀✅☝️👇👉👈のみ使用可（1-3個で加点）
5. **外部リンクなし (+10点)**: URL を含まない
6. **CTA含む (+5点)**: 「試してみて」「教えて」「共有して」などの行動喚起

### 減点ルール
1. **外部リンク単体 (-15点)**: URL + 一言のみ（本文30文字未満）
2. **ハッシュタグ過多 (-10点)**: 3個以上のハッシュタグ
3. **文字数問題**: 600文字超(-5), 300文字未満(-5), 100文字未満(-15)
4. **攻撃的表現 (-20点)**: ネガティブワード、批判的な表現
5. **句読点使用 (-5点)**: 「、」「。」の使用
6. **許可外絵文字 (-3点)**: 指定外の絵文字使用

### 合格判定
- 70-100点: 合格（投稿可能）
- 50-69点: 要改善
- 0-49点: 不合格（再生成推奨）
`;

const TEMPLATES = `
## 投稿テンプレート

### 1. 質問形式（question）- スコア90点
\`\`\`
[質問フック]

[本文/内容]

[CTA質問]
\`\`\`
最適: エンゲージメント重視、コミュニティ議論喚起

### 2. ニュース速報形式（breaking）- スコア70点
\`\`\`
[見出し/速報タグ]

[要約（2-3行）]

[詳細リンクまたはCTA]
\`\`\`
最適: 速報性重視、情報の第一報

### 3. 学び共有形式（learning）- スコア85点
\`\`\`
[学びの宣言]

[具体的な内容（箇条書き）]

[感想または行動喚起]
\`\`\`
最適: 経験・ナレッジ共有、信頼性構築

### 4. 実践Tips形式（tip）- スコア80点
\`\`\`
[Tip宣言]

[手順（番号付き）]

[結果または効果]
\`\`\`
最適: ハウツー共有、保存・ブックマーク誘発

### 5. 成果報告形式（achievement）- スコア75点
\`\`\`
[成果宣言]

[ビフォー/アフター]

[次のアクション]
\`\`\`
最適: 進捗報告、モチベーション共有

## テンプレート選択ガイド
| コンテンツタイプ | 推奨テンプレート |
| ニュース記事 | question > breaking |
| 技術Tips | tip > learning |
| プロダクト発表 | breaking > achievement |
| 経験共有 | learning > question |
`;

const OUTPUT_FORMAT = `
## 出力形式

必ず以下のJSON形式で結果を出力してください：

\`\`\`json
{
  "posts": [
    {
      "id": "post_1",
      "text": "生成したポストのテキスト",
      "charCount": 文字数,
      "templateUsed": "question|breaking|learning|tip|achievement",
      "evaluation": {
        "overallScore": 0-100,
        "replyPotential": 0-100,
        "engagementPotential": 0-100,
        "dwellTimePotential": 0-100,
        "contentQuality": 0-100,
        "feedback": "評価コメント"
      }
    }
  ],
  "bestPostId": "最高スコアのポストID",
  "summary": "生成プロセスの要約"
}
\`\`\`
`;

export function buildXPostSystemPrompt(article: NewsArticle): string {
  return `あなたはX（Twitter）投稿の専門家です。与えられた記事情報からXアルゴリズムに最適化された投稿を生成してください。

## あなたの役割
1. 記事の内容を分析し、最適なテンプレートを選択
2. Xアルゴリズムのスコアリングルールに従って投稿を作成
3. 作成した投稿を自己評価し、70点以上になるまで改善
4. 最終的な投稿候補を複数提示

${SCORING_RULES}

${TEMPLATES}

${OUTPUT_FORMAT}

## 重要な制約
- 外部リンクは含めない（アルゴリズムペナルティ回避）
- ハッシュタグは最大2個まで
- 文字数は400-500文字を目標（X Premium長文機能活用）
- 質問形式を優先（リプライ誘発が最重要）
- 句読点（、。）は使わない（改行で区切る）
- 絵文字は🔥🚀✅☝️👇👉👈のみ使用可
- 日本語で出力

## 対象記事情報
タイトル: ${article.title}
ソース: ${article.source}
URL: ${article.url}
公開日: ${article.publishedAt || "不明"}

要約:
${article.summary || "なし"}

本文:
${article.body || article.summary || "なし"}

---

上記の記事情報を元に、Xアルゴリズムに最適化された投稿を3つ生成してください。
各投稿は異なるテンプレートを使用し、最も高いスコアの投稿を推奨してください。
`;
}

export function buildRefinePrompt(
  originalPost: string,
  score: number,
  feedback: string,
): string {
  return `以下の投稿を改善してください。

## 現在の投稿
${originalPost}

## 現在のスコア: ${score}点

## フィードバック
${feedback}

## 改善指示
- スコア70点以上を目指して改善
- 質問形式を追加することを検討
- 文字数を400-500文字に調整（X Premium長文機能活用）
- 外部リンクやハッシュタグ過多を避ける
- 句読点を使わず改行で文を区切る
- 絵文字は🔥🚀✅☝️👇👉👈のみ

改善した投稿を同じJSON形式で出力してください。
`;
}
