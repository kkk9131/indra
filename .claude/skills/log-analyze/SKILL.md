---
name: log-analyze
description: ログデータを解析し、統計情報・パターン・異常を検出する。
triggers:
  - /log-analyze
  - ログを解析
  - ログ解析
---

# log-analyze スキル

ログデータを解析し、統計情報を算出するスキル。

## 入力

標準入力またはファイルからJSON形式のログデータを受け取る。

```json
{
  "logs": [...],
  "metadata": { ... }
}
```

または `--input` オプションでファイルパスを指定。

## 出力

```json
{
  "stats": {
    "totalLogs": 150,
    "agentLogs": 80,
    "promptLogs": 20,
    "systemLogs": 50,
    "errorCount": 5,
    "warningCount": 10,
    "toolUsage": { "Read": 30, "Bash": 20, "Write": 10 },
    "uniqueSessions": 3
  }
}
```

## 使用方法

```bash
# パイプで入力
npx tsx log-read.ts | npx tsx log-analyze.ts

# ファイルから入力
npx tsx log-analyze.ts --input logs.json

# 出力をファイルに保存
npx tsx log-analyze.ts --input logs.json --output stats.json
```

## スクリプト

- `scripts/log-analyze.ts`: ログ解析スクリプト
