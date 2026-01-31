# X Operations ワークフロー詳細

## 概要

X運用エージェントの3つのワークフローパターンを詳細に解説する。

## パターン1: Creation Flow（記事からポスト作成）

### フロー図

```mermaid
graph TD
    A[記事/コンテンツ受取] --> B[/news-content-fetch]
    B --> C{コンテンツ取得成功?}
    C -->|Yes| D[/x-post-structure]
    C -->|No| E[エラー返却]
    D --> F[/x-post-compose]
    F --> G[3バリエーション生成]
    G --> H[/x-algorithm-evaluate]
    H --> I{全ポスト70点以上?}
    I -->|Yes| J[ベストポスト選定]
    I -->|No| K[/x-post-refine]
    K --> L{修正3回未満?}
    L -->|Yes| H
    L -->|No| M[現状ベストを選定]
    J --> N[結果返却]
    M --> N
```

### 詳細手順

#### Step 1: 記事情報取得

```
/news-content-fetch { articleId: "xxx" }
```

取得情報:

- title: 記事タイトル
- summary: 要約
- keyPoints: 重要ポイント
- tone: トーン（technical, casual, etc.）

#### Step 2: テンプレート選択

```
/x-post-structure {
  contentType: "news",
  tone: content.tone,
  includeQuestion: true,
  includeEmoji: true
}
```

推奨テンプレート:

- question: 質問形式（リプライ誘発）
- insight: 洞察共有型
- announcement: お知らせ型

#### Step 3: ポスト生成

```
/x-post-compose {
  content: { ... },
  template: recommendedTemplate,
  options: { variations: 3 }
}
```

3つのバリエーションを生成。

#### Step 4: 評価・改善

```
/x-algorithm-evaluate { posts: [...] }
```

70点未満のポストがある場合:

```
/x-post-refine {
  post: { ... },
  evaluation: { ... },
  refinementFocus: "replyPotential"
}
```

最大3回まで修正を繰り返す。

### 入力形式

```json
{
  "articleId": "string",
  "options": {
    "variations": 3,
    "includeUrl": false,
    "preferredTemplate": "question",
    "minScore": 70,
    "maxRefinements": 3
  }
}
```

### 出力形式

```json
{
  "bestPost": {
    "id": "post-1-refined",
    "text": "最終ポスト本文...",
    "charCount": 130,
    "score": 85
  },
  "allPosts": [...],
  "content": {
    "title": "記事タイトル",
    "summary": "要約"
  },
  "metadata": {
    "generatedAt": "2026-01-28T10:00:00Z",
    "refinementCount": 2
  }
}
```

## パターン2: Evaluation Flow（ポスト評価・改善）

### フロー図

```mermaid
graph TD
    A[ポスト候補受取] --> B[/x-algorithm-evaluate]
    B --> C{70点以上?}
    C -->|Yes| D[ベストポスト選定]
    C -->|No| E[/x-post-refine]
    E --> F{修正3回未満?}
    F -->|Yes| B
    F -->|No| G[現状ベストを選定]
    D --> H[結果返却]
    G --> H
```

### 詳細手順

#### Step 1: 評価実行

```
/x-algorithm-evaluate {
  posts: [{ id, text }, ...]
}
```

評価項目:

- replyPotential: リプライ誘発力（30点）
- engagementPotential: エンゲージメント力（25点）
- dwellTimePotential: 滞在時間（25点）
- contentQuality: コンテンツ品質（20点）

#### Step 2: スコア判定

- 全ポスト70点以上 → ベストポスト選定
- 70点未満あり → 修正フェーズへ

#### Step 3: 修正（必要時）

```
/x-post-refine {
  post: { id, text },
  evaluation: { ... },
  refinementFocus: "replyPotential"
}
```

refinementFocus自動選定:
| 状況 | フォーカス |
|------|----------|
| 質問形式なし | replyPotential |
| 構造が悪い | dwellTimePotential |
| 外部リンク単体 | engagementPotential |
| 情報不足 | contentQuality |

#### Step 4: 再評価

修正後のポストを再評価。最大3回まで繰り返す。

### 入力形式

```json
{
  "posts": [{ "id": "post-1", "text": "ポスト本文..." }],
  "options": {
    "minScore": 70,
    "maxRefinements": 3,
    "refinementFocus": "auto"
  }
}
```

### 出力形式

```json
{
  "bestPost": {
    "id": "post-1-refined",
    "text": "最終ポスト本文...",
    "charCount": 130,
    "score": 85
  },
  "allEvaluations": [...],
  "ranking": ["post-1-refined", "post-2", "post-3"],
  "summary": {
    "totalPosts": 3,
    "passedCount": 3,
    "averageScore": 78,
    "totalRefinements": 2
  }
}
```

## パターン3: Analysis Flow（アカウント分析）

### フロー図

```mermaid
graph TD
    A[アカウント指定] --> B[/x-account-fetch]
    B --> C{取得成功?}
    C -->|Yes| D[ツイート分析]
    C -->|No| E[エラー返却]
    D --> F[傾向抽出]
    F --> G[レポート生成]
    G --> H[結果返却]
```

### 詳細手順

#### Step 1: アカウント情報取得

```
/x-account-fetch { username: "@AnthropicAI" }
```

取得情報:

- プロフィール情報
- 最新ツイート（20件程度）
- エンゲージメント統計

#### Step 2: 傾向分析

分析項目:

- 投稿頻度
- コンテンツタイプ分布
- エンゲージメント率
- 使用言語・トーン

#### Step 3: レポート生成

```json
{
  "account": "@AnthropicAI",
  "analysis": {
    "postingFrequency": "1日2-3回",
    "contentTypes": {
      "announcement": 40,
      "technical": 30,
      "engagement": 30
    },
    "averageEngagement": {
      "likes": 150,
      "retweets": 30,
      "replies": 20
    }
  },
  "insights": [
    "技術的な深掘り投稿が高エンゲージメント",
    "質問形式の投稿がリプライを誘発"
  ],
  "recommendations": ["技術解説投稿を増やす", "質問形式を活用する"]
}
```

## エラーハンドリング

| エラー               | 対処                         |
| -------------------- | ---------------------------- |
| 記事が見つからない   | エラーメッセージを返却       |
| テンプレート選択失敗 | デフォルト（question）を使用 |
| 生成失敗             | リトライ（最大2回）          |
| 評価失敗             | リトライ（最大2回）          |
| 修正失敗             | 元のポストを使用             |
| 全ポスト不合格       | 最高スコアのポストを選定     |
| アカウント取得失敗   | エラーメッセージを返却       |

## 参照

- news-content-fetch: `.claude/skills/news-content-fetch/SKILL.md`
- x-post-structure: `.claude/skills/x-post-structure/SKILL.md`
- x-post-compose: `.claude/skills/x-post-compose/SKILL.md`
- x-algorithm-evaluate: `.claude/skills/x-algorithm-evaluate/SKILL.md`
- x-post-refine: `.claude/skills/x-post-refine/SKILL.md`
- x-account-fetch: `.claude/skills/x-account-fetch/SKILL.md`
