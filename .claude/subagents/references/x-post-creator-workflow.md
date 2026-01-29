# X Post Creator ワークフロー詳細

## フロー図

```mermaid
graph TD
    A[articleId受取] --> B[/news-content-fetch]
    B --> C{コンテンツ取得成功?}
    C -->|Yes| D[/x-post-structure]
    C -->|No| E[エラー返却]
    D --> F[/x-post-compose]
    F --> G[3バリエーション生成]
    G --> H[結果返却]
```

## 詳細手順

### 1. 記事情報取得

```
/news-content-fetch { articleId: "xxx" }
```

→ title, summary, keyPoints, tone を取得

### 2. テンプレート選択

```
/x-post-structure {
  contentType: "news",
  tone: content.tone,
  includeQuestion: true,
  includeEmoji: true
}
```

→ recommendedTemplate を取得

### 3. ポスト生成

```
/x-post-compose {
  content: { ... },
  template: recommendedTemplate,
  options: { variations: 3 }
}
```

→ 3つのポスト候補を生成

## 入力形式

```json
{
  "articleId": "string",
  "options": {
    "variations": 3,
    "includeUrl": false,
    "preferredTemplate": "question"
  }
}
```

## 出力形式

```json
{
  "articleId": "xxx",
  "content": {
    "title": "記事タイトル",
    "summary": "要約",
    "keyPoints": ["..."]
  },
  "posts": [
    {
      "id": "post-1",
      "text": "ポスト本文...",
      "charCount": 120,
      "templateUsed": "question"
    }
  ],
  "metadata": {
    "generatedAt": "2026-01-28T10:00:00Z",
    "source": "anthropic-news"
  }
}
```

## エラーハンドリング

| エラー               | 対処                         |
| -------------------- | ---------------------------- |
| 記事が見つからない   | エラーメッセージを返却       |
| テンプレート選択失敗 | デフォルト（question）を使用 |
| 生成失敗             | リトライ（最大2回）          |

## 参照

- news-content-fetch: `.claude/skills/news-content-fetch/SKILL.md`
- x-post-structure: `.claude/skills/x-post-structure/SKILL.md`
- x-post-compose: `.claude/skills/x-post-compose/SKILL.md`
