---
name: glm-analyze
description: GLM (Z.ai) APIを使用してログを深層分析し、インサイトを抽出する。
triggers:
  - /glm-analyze
  - GLMで分析
  - AI分析
---

# glm-analyze スキル

GLM (Z.ai) APIを使用してログデータを深層分析し、重要なインサイトを抽出するスキル。

## 入力

標準入力またはファイルからJSON形式のログ+統計データを受け取る。

```json
{
  "logs": [...],
  "stats": {
    "totalLogs": 150,
    "agentLogs": 80,
    ...
  }
}
```

## 出力

```json
{
  "summary": "日本語要約（100-200文字）",
  "items": [
    {
      "severity": "error",
      "category": "error",
      "title": "エラー検出",
      "description": "詳細な説明"
    }
  ]
}
```

## 使用方法

```bash
# パイプで入力
cat combined.json | npx tsx glm-analyze.ts

# ファイルから入力
npx tsx glm-analyze.ts --input combined.json

# 出力をファイルに保存
npx tsx glm-analyze.ts --input combined.json --output analysis.json
```

## 環境変数

- `ZAI_API_KEY`: Z.ai APIキー（必須）

## スクリプト

- `scripts/glm-analyze.ts`: GLM分析スクリプト
