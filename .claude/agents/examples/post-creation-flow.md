# ポスト作成フロー例

## シナリオ: Anthropicニュース記事からXポスト作成

### 入力

ユーザーリクエスト:

```
「Anthropicの最新ニュース記事からXポストを作成して」
```

記事情報:

```json
{
  "articleId": "anthropic-news-2026-01-28",
  "title": "Claude Agent SDK 2.0リリース",
  "url": "https://anthropic.com/news/agent-sdk-2"
}
```

### Step 1: 記事情報取得

```
/news-content-fetch { articleId: "anthropic-news-2026-01-28" }
```

結果:

```json
{
  "title": "Claude Agent SDK 2.0リリース",
  "summary": "Anthropicが新しいAgent SDKをリリース。並列処理とメモリ管理が大幅に改善。",
  "keyPoints": [
    "並列処理パフォーマンスが3倍に向上",
    "長期メモリ機能の追加",
    "MCP統合の簡素化"
  ],
  "tone": "technical"
}
```

### Step 2: テンプレート選択

```
/x-post-structure {
  contentType: "news",
  tone: "technical",
  includeQuestion: true,
  includeEmoji: true
}
```

結果:

```json
{
  "recommendedTemplate": "question",
  "alternatives": ["insight", "announcement"],
  "structure": {
    "hook": "ニュースフック",
    "body": "要点3つ",
    "cta": "質問形式"
  }
}
```

### Step 3: ポスト生成

```
/x-post-compose {
  content: { ... },
  template: "question",
  options: { variations: 3 }
}
```

結果:

```json
{
  "posts": [
    {
      "id": "post-1",
      "text": "Claude Agent SDK 2.0がリリース🚀\n\n✅ 並列処理が3倍高速に\n✅ 長期メモリ機能追加\n✅ MCP統合がシンプルに\n\n個人開発者にとってはかなり嬉しいアプデ\n\nみなさんはもう試した？",
      "charCount": 142,
      "templateUsed": "question"
    },
    {
      "id": "post-2",
      "text": "【速報】Claude Agent SDK 2.0🔥\n\n並列処理が3倍になったのはデカい\n\n長期メモリ機能もついに実装されて\nMCP統合も簡単になった\n\nこれで開発効率がさらに上がりそう\n\nどの機能が一番気になる？",
      "charCount": 150,
      "templateUsed": "question"
    },
    {
      "id": "post-3",
      "text": "Anthropicから大型アプデきた🚀\n\nClaude Agent SDK 2.0\n→ 並列処理3倍\n→ 長期メモリ追加\n→ MCP統合簡素化\n\n個人開発でClaude Code使ってる人には朗報\n\n早速試してみようと思うけど\nみなさんの感想聞きたい👇",
      "charCount": 160,
      "templateUsed": "question"
    }
  ]
}
```

### Step 4: 評価

```
/x-algorithm-evaluate { posts: [...] }
```

結果:

```json
{
  "evaluations": [
    {
      "postId": "post-1",
      "score": 82,
      "breakdown": {
        "replyPotential": 25,
        "engagementPotential": 20,
        "dwellTimePotential": 20,
        "contentQuality": 17
      },
      "suggestions": ["具体的な数値を追加すると説得力UP"]
    },
    {
      "postId": "post-2",
      "score": 78,
      "breakdown": {
        "replyPotential": 23,
        "engagementPotential": 18,
        "dwellTimePotential": 20,
        "contentQuality": 17
      },
      "suggestions": ["絵文字を追加で視認性向上"]
    },
    {
      "postId": "post-3",
      "score": 85,
      "breakdown": {
        "replyPotential": 27,
        "engagementPotential": 20,
        "dwellTimePotential": 21,
        "contentQuality": 17
      },
      "suggestions": []
    }
  ]
}
```

### Step 5: 結果返却

全ポスト70点以上なので修正不要。

```json
{
  "bestPost": {
    "id": "post-3",
    "text": "Anthropicから大型アプデきた🚀\n\nClaude Agent SDK 2.0\n→ 並列処理3倍\n→ 長期メモリ追加\n→ MCP統合簡素化\n\n個人開発でClaude Code使ってる人には朗報\n\n早速試してみようと思うけど\nみなさんの感想聞きたい👇",
    "charCount": 160,
    "score": 85
  },
  "ranking": ["post-3", "post-1", "post-2"],
  "summary": {
    "averageScore": 82,
    "passedCount": 3,
    "totalRefinements": 0
  }
}
```

### 最終出力（ユーザーへの提示）

```
## 最高スコアのポスト（85点）

Anthropicから大型アプデきた🚀

Claude Agent SDK 2.0
→ 並列処理3倍
→ 長期メモリ追加
→ MCP統合簡素化

個人開発でClaude Code使ってる人には朗報

早速試してみようと思うけど
みなさんの感想聞きたい👇

---

### 評価詳細
- リプライ誘発力: 27/30
- エンゲージメント力: 20/25
- 滞在時間: 21/25
- コンテンツ品質: 17/20

### 代替案
1. post-1（82点）
2. post-2（78点）
```

## ポイント

1. **3バリエーション生成**で選択肢を提供
2. **評価→改善サイクル**で品質担保
3. **ベストポスト自動選定**でユーザー負担軽減
4. **詳細評価**で透明性確保
