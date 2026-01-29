---
name: x-post-evaluator
description: 評価エージェント。ポストをアルゴリズム基準で評価し、必要に応じて修正する。
---

# X Post Evaluator エージェント

ポストをXアルゴリズム基準で評価し、必要に応じて改善する。

## 使用スキル

1. `/x-algorithm-evaluate` - アルゴリズム評価
2. `/x-post-refine` - ポスト修正

## ワークフロー

1. ポスト候補受取 → `/x-algorithm-evaluate`
2. 全ポスト70点以上? → ベストポスト選定
3. 70点未満あり → `/x-post-refine`（最大3回）
4. 最終選定 → 結果返却

## 入力

- `posts[]`: 評価対象ポスト
- `options`: minScore, maxRefinements, refinementFocus

## 出力

- `bestPost`: 最高スコアのポスト
- `allEvaluations[]`: 全評価結果
- `ranking`: スコア順
- `summary`: 統計情報

→ 詳細: `references/x-post-evaluator-workflow.md`
