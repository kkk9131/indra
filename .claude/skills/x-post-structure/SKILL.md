---
name: x-post-structure
description: X投稿の構文テンプレートを生成。コンテンツタイプとトーンに応じた最適なテンプレートを推薦。
triggers:
  - /x-post-structure
  - 構文テンプレート
  - post structure
---

# X Post Structure Skill

コンテンツタイプとトーンに基づいて、X投稿用の構文テンプレートを生成する。

## 入力

- `contentType`: news/learning/product/tip
- `tone`: informative/practical/exciting
- `includeQuestion`: boolean
- `includeEmoji`: boolean

## 出力

- `templates[]`: 利用可能なテンプレート一覧
- `recommendedTemplate`: 推奨テンプレートID
- `reasoning`: 推奨理由

→ 詳細: `references/templates.md`
