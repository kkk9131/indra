/**
 * GLM用プロンプトビルダー
 *
 * X投稿生成用のプロンプトをGLM向けに生成する
 */

export interface ArticleInfo {
  id: string;
  title: string;
  url: string;
  content: string;
  summary?: string;
}

export interface GLMPromptOptions {
  candidateCount?: number; // デフォルト: 5
  maxLength?: number; // デフォルト: 280
  tone?: "informative" | "engaging" | "provocative"; // デフォルト: 'engaging'
}

export class GLMPromptBuilder {
  private defaultOptions: Required<GLMPromptOptions> = {
    candidateCount: 5,
    maxLength: 280,
    tone: "engaging",
  };

  /**
   * 記事情報からGLM用プロンプトを生成
   */
  buildPrompt(article: ArticleInfo, options?: GLMPromptOptions): string {
    const opts = { ...this.defaultOptions, ...options };

    return `# X投稿候補生成タスク

## 指示
以下の記事から、Xに投稿する候補を${opts.candidateCount}つ生成してください。

## 制約
- 各投稿は${opts.maxLength}文字以内
- 日本語で作成
- トーン: ${this.getToneDescription(opts.tone)}
- Xアルゴリズムで高評価されやすい構造を意識

## Xアルゴリズム最適化ポイント
1. **返信を促す**: 質問形式、意見を求める形式
2. **エンゲージメント**: 驚き、新発見、議論を呼ぶ内容
3. **滞在時間**: 読み応えのある情報量
4. **品質**: 誤字脱字なし、読みやすい構造

## 構文テンプレート例
- [ニュース] + 要点 + 詳細はリプで
- [気づき/学び] + 解説 + あなたはどう思う？
- [注意喚起] + 理由 + 対策
- [データ/統計] + インサイト + 議論を呼ぶ質問

## 記事情報
タイトル: ${article.title}
URL: ${article.url}
${article.summary ? `要約: ${article.summary}` : ""}

本文:
${article.content}

## 出力形式
以下のJSON形式で出力してください:

\`\`\`json
{
  "candidates": [
    {
      "id": "candidate_1",
      "text": "投稿内容",
      "templateUsed": "使用したテンプレート",
      "charCount": 文字数
    }
  ]
}
\`\`\``;
  }

  /**
   * トーンの説明を取得
   */
  private getToneDescription(
    tone: "informative" | "engaging" | "provocative",
  ): string {
    const descriptions = {
      informative: "情報提供型（客観的、事実ベース）",
      engaging: "エンゲージメント重視（親しみやすく、反応を促す）",
      provocative: "議論喚起型（意見を述べ、議論を呼ぶ）",
    };
    return descriptions[tone];
  }

  /**
   * GLM出力をパース
   */
  parseOutput(output: string): Array<{
    id: string;
    text: string;
    templateUsed?: string;
    charCount?: number;
  }> | null {
    try {
      // JSON部分を抽出
      const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        // JSONブロックがない場合、直接パースを試みる
        const parsed = JSON.parse(output);
        if (parsed.candidates && Array.isArray(parsed.candidates)) {
          return parsed.candidates;
        }
        return null;
      }

      const parsed = JSON.parse(jsonMatch[1]);
      if (!parsed.candidates || !Array.isArray(parsed.candidates)) {
        return null;
      }

      return parsed.candidates.map(
        (
          c: {
            id?: string;
            text: string;
            templateUsed?: string;
            charCount?: number;
          },
          i: number,
        ) => ({
          id: c.id ?? `candidate_${i + 1}`,
          text: c.text,
          templateUsed: c.templateUsed,
          charCount: c.charCount ?? c.text.length,
        }),
      );
    } catch {
      return null;
    }
  }
}

export const glmPromptBuilder = new GLMPromptBuilder();
