---
name: x-algorithm-evaluate
description: 生成ポストをXアルゴリズム基準で評価し、スコアと改善提案を返す。
triggers:
  - /x-algorithm-evaluate
  - アルゴリズム評価
  - evaluate post
---

# X Algorithm Evaluate Skill

生成されたXポストをアルゴリズム基準で評価し、スコアリングと改善提案を行う。

## 入力

- `posts[]`: 評価対象ポスト（id, text）

## 出力

- `evaluations[]`: 各ポストの評価結果
  - `overallScore`: 0-100
  - `breakdown`: カテゴリ別スコア
  - `positiveSignals`, `negativeSignals`
  - `suggestions`: 改善提案
- `bestPostId`: 最高スコアのポストID
- `ranking`: スコア順のID配列

## 合格基準

- 70点以上: 合格
- 50-69点: 要改善（x-post-refineで修正）
- 50点未満: 不合格

→ 詳細: `references/scoring-rules.md`
