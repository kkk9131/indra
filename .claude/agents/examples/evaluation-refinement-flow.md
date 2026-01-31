# 評価・改善フロー例

## シナリオ: 既存ポストの評価と改善

### 入力

ユーザーリクエスト:

```
「このポストを評価して改善して」
```

対象ポスト:

```
Claude Codeすごい。開発が楽になった。
https://claude.ai/claude-code
```

### Step 1: 初回評価

```
/x-algorithm-evaluate {
  posts: [{
    "id": "user-post-1",
    "text": "Claude Codeすごい。開発が楽になった。\nhttps://claude.ai/claude-code"
  }]
}
```

結果:

```json
{
  "evaluations": [
    {
      "postId": "user-post-1",
      "score": 35,
      "breakdown": {
        "replyPotential": 5,
        "engagementPotential": 5,
        "dwellTimePotential": 10,
        "contentQuality": 15
      },
      "issues": [
        "外部リンク単体（-15点）",
        "質問形式なし（リプライ誘発力低）",
        "具体性不足（内容が曖昧）",
        "短すぎる（滞在時間低）"
      ],
      "suggestions": [
        "外部リンクにコンテキストを追加",
        "質問形式で締める",
        "具体的な体験・数値を追加",
        "文字数を100文字以上に"
      ]
    }
  ]
}
```

**判定**: 35点 < 70点 → 修正必要

### Step 2: 修正 #1

```
/x-post-refine {
  post: {
    "id": "user-post-1",
    "text": "Claude Codeすごい。開発が楽になった。\nhttps://claude.ai/claude-code"
  },
  evaluation: { ... },
  refinementFocus: "replyPotential"
}
```

結果:

```json
{
  "refinedPost": {
    "id": "user-post-1-v2",
    "text": "Claude Codeを使い始めて開発効率が上がった\n\n・コード書く時間が半分に\n・レビューもAIがサポート\n・デバッグも早くなった\n\nまだ使ったことない人は一度試してみて\n\nみなさんはClaude Code使ってる？",
    "charCount": 140
  },
  "changes": [
    "外部リンクを削除しコンテンツを充実",
    "箇条書きで具体的なメリットを追加",
    "質問形式でリプライを誘発"
  ]
}
```

### Step 3: 再評価 #1

```
/x-algorithm-evaluate {
  posts: [{
    "id": "user-post-1-v2",
    "text": "Claude Codeを使い始めて開発効率が上がった\n\n・コード書く時間が半分に\n・レビューもAIがサポート\n・デバッグも早くなった\n\nまだ使ったことない人は一度試してみて\n\nみなさんはClaude Code使ってる？"
  }]
}
```

結果:

```json
{
  "evaluations": [
    {
      "postId": "user-post-1-v2",
      "score": 68,
      "breakdown": {
        "replyPotential": 22,
        "engagementPotential": 16,
        "dwellTimePotential": 18,
        "contentQuality": 12
      },
      "issues": ["絵文字なし（視認性）", "「半分」は曖昧（具体的な数値推奨）"],
      "suggestions": ["絵文字を追加（🚀🔥など）", "具体的な数値を追加"]
    }
  ]
}
```

**判定**: 68点 < 70点 → 追加修正必要

### Step 4: 修正 #2

```
/x-post-refine {
  post: {
    "id": "user-post-1-v2",
    "text": "..."
  },
  evaluation: { ... },
  refinementFocus: "engagementPotential"
}
```

結果:

```json
{
  "refinedPost": {
    "id": "user-post-1-v3",
    "text": "Claude Codeで開発効率3倍になった🚀\n\n✅ コード書く時間が1/3に\n✅ レビューもAIがサポート\n✅ デバッグ時間も大幅短縮\n\n個人開発者には本当におすすめ\n\nみなさんはClaude Code使ってる？🔥",
    "charCount": 148
  },
  "changes": [
    "絵文字を追加（🚀✅🔥）",
    "「半分」→「1/3」で具体性UP",
    "「3倍」という数値でインパクト強化"
  ]
}
```

### Step 5: 再評価 #2

```
/x-algorithm-evaluate {
  posts: [{
    "id": "user-post-1-v3",
    "text": "Claude Codeで開発効率3倍になった🚀\n\n✅ コード書く時間が1/3に\n✅ レビューもAIがサポート\n✅ デバッグ時間も大幅短縮\n\n個人開発者には本当におすすめ\n\nみなさんはClaude Code使ってる？🔥"
  }]
}
```

結果:

```json
{
  "evaluations": [
    {
      "postId": "user-post-1-v3",
      "score": 82,
      "breakdown": {
        "replyPotential": 25,
        "engagementPotential": 20,
        "dwellTimePotential": 20,
        "contentQuality": 17
      },
      "issues": [],
      "suggestions": []
    }
  ]
}
```

**判定**: 82点 >= 70点 → 合格

### Step 6: 結果返却

```json
{
  "bestPost": {
    "id": "user-post-1-v3",
    "text": "Claude Codeで開発効率3倍になった🚀\n\n✅ コード書く時間が1/3に\n✅ レビューもAIがサポート\n✅ デバッグ時間も大幅短縮\n\n個人開発者には本当におすすめ\n\nみなさんはClaude Code使ってる？🔥",
    "charCount": 148,
    "score": 82
  },
  "refinementHistory": [
    {
      "version": "original",
      "score": 35,
      "issues": ["外部リンク単体", "質問形式なし", "短すぎる"]
    },
    {
      "version": "v2",
      "score": 68,
      "issues": ["絵文字なし", "数値が曖昧"]
    },
    {
      "version": "v3",
      "score": 82,
      "issues": []
    }
  ],
  "summary": {
    "originalScore": 35,
    "finalScore": 82,
    "improvement": "+47",
    "refinementCount": 2
  }
}
```

### 最終出力（ユーザーへの提示）

```
## 改善結果

### Before（35点）
Claude Codeすごい。開発が楽になった。
https://claude.ai/claude-code

### After（82点）
Claude Codeで開発効率3倍になった🚀

✅ コード書く時間が1/3に
✅ レビューもAIがサポート
✅ デバッグ時間も大幅短縮

個人開発者には本当におすすめ

みなさんはClaude Code使ってる？🔥

---

### 改善ポイント
1. 外部リンク単体を解消（-15点回避）
2. 質問形式を追加（+20点獲得）
3. 箇条書きで構造化（+5点獲得）
4. 絵文字で視認性向上（+5点獲得）
5. 具体的な数値で説得力UP

### スコア推移
35 → 68 → 82（+47点改善）
```

## ポイント

1. **段階的改善**: 1回の修正で完璧を目指さない
2. **優先順位**: 最も影響の大きい問題から解決
3. **最大3回制限**: 過度な修正を防止
4. **履歴保持**: 改善プロセスを可視化
