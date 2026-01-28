---
name: report-generate
description: 分析結果からDailyReport/NewsArticle形式のレポートを生成する。
triggers:
  - /report-generate
  - レポートを生成
  - レポート生成
---

# report-generate スキル

分析結果からDailyReportおよびNewsArticle形式のレポートを生成するスキル。

## 入力

標準入力またはファイルからJSON形式のデータを受け取る。

```json
{
  "stats": {
    "totalLogs": 150,
    ...
  },
  "analysis": {
    "summary": "...",
    "items": [...]
  },
  "period": {
    "start": "2025-01-27T00:00:00.000Z",
    "end": "2025-01-28T00:00:00.000Z"
  }
}
```

## 出力

```json
{
  "report": {
    "id": "...",
    "source": "log-analysis",
    "title": "Daily Log Report - 2025/1/28",
    "summary": "...",
    "stats": {...},
    "items": [...],
    "periodStart": "...",
    "periodEnd": "...",
    "generatedAt": "..."
  },
  "article": {
    "id": "...",
    "source": "log-analysis",
    "title": "...",
    "summary": "...",
    "url": "#report/...",
    "publishedAt": "...",
    "fetchedAt": "...",
    "body": "...",
    "imageUrl": null
  }
}
```

## 使用方法

```bash
# パイプで入力
cat input.json | npx tsx report-generate.ts

# ファイルから入力
npx tsx report-generate.ts --input input.json

# 出力をファイルに保存
npx tsx report-generate.ts --input input.json --output report.json
```

## スクリプト

- `scripts/report-generate.ts`: レポート生成スクリプト
