---
name: x-post-refine
description: 評価結果を基にポストを修正・改善する。
triggers:
  - /x-post-refine
  - ポスト修正
  - refine post
---

# X Post Refine Skill

アルゴリズム評価結果に基づいてポストを修正・改善する。

## 入力

- `post`: 修正対象ポスト（id, text）
- `evaluation`: 評価結果（score, negativeSignals, suggestions）
- `refinementFocus`: 最適化の焦点（optional）

## 出力

- `original`: 修正前ポスト
- `refined`: 修正後ポスト
- `changes[]`: 変更内容
- `improvement`: スコア改善情報

## refinementFocus

- `replyPotential`: 質問・議論誘発を強化
- `engagementPotential`: いいね・RT誘発を強化
- `dwellTimePotential`: 読みやすさ・構造化を強化
- `contentQuality`: 情報の価値・正確性を強化

→ 詳細: `references/refine-rules.md`
