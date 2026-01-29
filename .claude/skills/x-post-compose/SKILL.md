---
name: x-post-compose
description: 記事情報をテンプレートに適用してXポストを生成する。
triggers:
  - /x-post-compose
  - ポスト生成
  - compose post
---

# X Post Compose Skill

記事コンテンツとテンプレートを組み合わせてX投稿を生成する。

## 入力

- `content`: 記事情報（title, summary, keyPoints等）
- `template`: 使用するテンプレート
- `options`: includeUrl, maxLength, variations

## 出力

- `posts[]`: 生成されたポスト候補（デフォルト3つ）
  - `id`, `text`, `charCount`, `templateUsed`

→ 詳細: `references/compose-rules.md`
