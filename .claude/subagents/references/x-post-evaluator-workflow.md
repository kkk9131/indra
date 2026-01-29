# X Post Evaluator ワークフロー詳細

## フロー図

```mermaid
graph TD
    A[ポスト候補受取] --> B[/x-algorithm-evaluate]
    B --> C{全ポスト 70点以上?}
    C -->|Yes| D[ベストポスト選定]
    C -->|No| E[/x-post-refine]
    E --> F{修正3回未満?}
    F -->|Yes| B
    F -->|No| G[現状ベストを選定]
    D --> H[結果返却]
    G --> H
```

## 詳細手順

### 1. 評価実行

```
/x-algorithm-evaluate {
  posts: [{ id, text }, ...]
}
```

→ 各ポストのスコアと改善提案を取得

### 2. スコア確認

- 全ポストが70点以上 → ベストポストを選定
- 70点未満のポストあり → 修正フェーズへ

### 3. 修正（必要時）

```
/x-post-refine {
  post: { id, text },
  evaluation: { ... },
  refinementFocus: "replyPotential"
}
```

→ 修正後のポストを取得

### 4. 再評価

- 修正後のポストを再評価
- 最大3回まで繰り返し

### 5. 最終選定

- 最高スコアのポストを選定
- ランキングと評価サマリを返却

## 入力形式

```json
{
  "posts": [
    {
      "id": "post-1",
      "text": "ポスト本文..."
    }
  ],
  "options": {
    "minScore": 70,
    "maxRefinements": 3,
    "refinementFocus": "replyPotential"
  }
}
```

## 出力形式

```json
{
  "bestPost": {
    "id": "post-1-refined",
    "text": "最終ポスト本文...",
    "charCount": 130,
    "score": 85
  },
  "allEvaluations": [
    {
      "postId": "post-1",
      "originalScore": 55,
      "finalScore": 85,
      "refinementCount": 2,
      "breakdown": {
        "replyPotential": 90,
        "engagementPotential": 80,
        "dwellTimePotential": 85,
        "contentQuality": 85
      }
    }
  ],
  "ranking": ["post-1-refined", "post-2", "post-3"],
  "summary": {
    "totalPosts": 3,
    "passedCount": 3,
    "averageScore": 78,
    "totalRefinements": 2
  },
  "metadata": {
    "evaluatedAt": "2026-01-28T10:05:00Z"
  }
}
```

## 修正戦略

### refinementFocus 自動選定

評価結果から最も改善が必要なカテゴリを自動選定:

| 状況           | 選定されるフォーカス |
| -------------- | -------------------- |
| 質問形式なし   | replyPotential       |
| 構造が悪い     | dwellTimePotential   |
| 外部リンク単体 | engagementPotential  |
| 情報不足       | contentQuality       |

### 修正優先度

1. 外部リンク単体の解消（-15点回避）
2. 質問形式の追加（+20点獲得）
3. 文字数調整（+10点獲得）
4. 箇条書き追加（+5点獲得）

## エラーハンドリング

| エラー         | 対処                     |
| -------------- | ------------------------ |
| 評価失敗       | リトライ（最大2回）      |
| 修正失敗       | 元のポストを使用         |
| 全ポスト不合格 | 最高スコアのポストを選定 |

## 参照

- x-algorithm-evaluate: `.claude/skills/x-algorithm-evaluate/SKILL.md`
- x-post-refine: `.claude/skills/x-post-refine/SKILL.md`
- スコアリング詳細: `.claude/skills/x-algorithm-evaluate/references/scoring-rules.md`
