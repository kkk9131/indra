---
name: log-read
description: LogStoreからログを読み取る。期間指定・タイプフィルタに対応。
triggers:
  - /log-read
  - ログを読み取る
  - ログ取得
---

# log-read スキル

LogStoreからログエントリを読み取るスキル。

## 入力

| パラメータ | 型     | デフォルト | 説明                                             |
| ---------- | ------ | ---------- | ------------------------------------------------ |
| `since`    | string | 24時間前   | ISO 8601形式の開始日時                           |
| `type`     | string | `"all"`    | `"all"` \| `"agent"` \| `"prompt"` \| `"system"` |

## 出力

```json
{
  "logs": [...],
  "metadata": {
    "totalCount": 150,
    "periodStart": "2025-01-27T00:00:00.000Z",
    "periodEnd": "2025-01-28T00:00:00.000Z"
  }
}
```

## 使用方法

```bash
# 過去24時間のすべてのログを取得
npx tsx scripts/log-read.ts

# 過去1週間のエージェントログを取得
npx tsx scripts/log-read.ts --since "2025-01-21T00:00:00Z" --type agent

# 出力をファイルに保存
npx tsx scripts/log-read.ts --output logs.json
```

## スクリプト

- `scripts/log-read.ts`: ログ読み取りスクリプト
