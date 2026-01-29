# X Post Refine 詳細ルール

## 入力形式

```json
{
  "post": {
    "id": "post-1",
    "text": "Claude Codeの新機能が発表されました。詳細はこちら https://..."
  },
  "evaluation": {
    "overallScore": 55,
    "negativeSignals": ["外部リンク単体"],
    "suggestions": ["質問形式を追加", "リンクを削除"]
  },
  "refinementFocus": "replyPotential"
}
```

## 出力形式

```json
{
  "original": {
    "id": "post-1",
    "text": "Claude Codeの新機能が発表されました。詳細はこちら https://...",
    "score": 55
  },
  "refined": {
    "id": "post-1-refined",
    "text": "Claude Codeに新機能が追加\n\n- 自動コード補完\n- コンテキスト理解向上\n- 処理速度2倍\n\nもう試した？感想教えて！",
    "score": 85
  },
  "changes": [
    {
      "type": "removed",
      "description": "外部リンクを削除"
    },
    {
      "type": "added",
      "description": "質問形式のCTAを追加"
    },
    {
      "type": "restructured",
      "description": "箇条書き形式に変更"
    }
  ],
  "improvement": {
    "scoreDiff": 30,
    "addressedIssues": ["外部リンク単体", "質問形式なし"],
    "remainingIssues": []
  }
}
```

## 修正ルール

### 1. 外部リンク単体対策

**修正前**:

```
新機能が発表 https://example.com
```

**修正後**:

```
新機能が発表！

- ポイント1
- ポイント2
- ポイント3

試してみた感想を教えて！
```

### 2. 質問形式追加

**パターン**:

- 「〇〇ってどう思う？」
- 「皆さんは〇〇してますか？」
- 「試してみた？」
- 「感想教えて！」

### 3. 文字数調整

**長すぎる場合**:

- 重複を削除
- 簡潔な表現に置換
- 情報の優先度で絞り込み

**短すぎる場合**:

- 詳細を追加
- 質問を追加
- CTAを追加

### 4. ハッシュタグ調整

- 3個以上 → 最重要の1-2個に絞る
- 0個 → 必要に応じて1個追加

## refinementFocus 詳細

| フォーカス          | 最適化内容               |
| ------------------- | ------------------------ |
| replyPotential      | 質問・議論誘発を強化     |
| engagementPotential | いいね・RT誘発を強化     |
| dwellTimePotential  | 読みやすさ・構造化を強化 |
| contentQuality      | 情報の価値・正確性を強化 |

## 修正上限

- 最大修正回数: 3回
- 1回の修正で3つ以上の変更を行わない
- 元の意図を損なわないよう注意

## 参照

- スコアリング: `.claude/skills/x-algorithm-evaluate/references/scoring-rules.md`
- テンプレート: `.claude/skills/x-post-structure/references/templates.md`
