# X Post Compose 詳細ルール

## 入力形式

```json
{
  "content": {
    "title": "記事タイトル",
    "summary": "記事要約",
    "keyPoints": ["ポイント1", "ポイント2"],
    "url": "https://...",
    "targetAudience": "個人開発者",
    "tone": "informative"
  },
  "template": {
    "id": "question",
    "structure": "[質問] + [本文] + [CTA]"
  },
  "options": {
    "includeUrl": false,
    "maxLength": 600,
    "variations": 3
  }
}
```

## 出力形式

```json
{
  "posts": [
    {
      "id": "post-1",
      "text": "Claude Codeの新機能、もう試した？\n\n自動コード補完が追加されて開発効率が爆上がり\n\n皆さんはどう活用してますか？",
      "charCount": 72,
      "templateUsed": "question",
      "includesUrl": false,
      "includesQuestion": true,
      "includesEmoji": false
    }
  ],
  "metadata": {
    "generatedAt": "2026-01-28T10:00:00Z",
    "contentSource": "anthropic-news",
    "templateId": "question"
  }
}
```

## 生成ルール

### 文字数

- 最適: 400-500文字（X Premium長文機能）
- 最大: 600文字
- 超過時: 自動で短縮

### スタイル

- 句読点（、。）は使用しない
- 文の区切りは改行で対応
- 許可絵文字: 🔥🚀✅☝️👇👉👈のみ

### トーン別スタイル

| トーン      | スタイル               |
| ----------- | ---------------------- |
| informative | 客観的、事実ベース     |
| practical   | 具体的、アクション重視 |
| exciting    | 絵文字多め、感嘆符使用 |

### 絵文字使用ガイド

- `informative`: 0-1個
- `practical`: 1-2個
- `exciting`: 2-3個

許可絵文字: 🔥🚀✅☝️👇👉👈（これ以外は禁止）

## バリエーション生成

3つのバリエーションを以下の観点で生成:

1. **標準版**: テンプレートに忠実
2. **質問強化版**: CTAを質問形式に
3. **コンパクト版**: より短く簡潔に

## 注意事項

- 外部リンクは`options.includeUrl`が`true`の場合のみ含める
- ハッシュタグは最大2個まで
- URLは文末に配置（含める場合）

## 参照

- テンプレート: `.claude/skills/x-post-structure/references/templates.md`
- アカウントトーン: `.claude/agent-docs/10-x-account.md`
