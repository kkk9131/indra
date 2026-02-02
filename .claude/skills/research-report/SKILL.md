---
name: research-report
description: WebSearchツールで情報を収集し、構造化されたリサーチレポートをMarkdown形式で作成
configSchema:
  - key: topic
    label: 調査トピック
    type: text
    placeholder: "例: AIエージェント最新動向"
    required: true
  - key: depth
    label: 調査深度
    type: select
    options:
      - value: quick
        label: クイック
      - value: normal
        label: 標準
      - value: deep
        label: 詳細
    defaultValue: normal
  - key: language
    label: レポート言語
    type: select
    options:
      - value: ja
        label: 日本語
      - value: en
        label: English
    defaultValue: ja
---

# Research Report Skill

WebSearchツールで情報を収集し、構造化されたリサーチレポートを作成。

## 発動条件

- 「〇〇について調べて」「〇〇のリサーチレポートを作成して」
- 「〇〇について検索して教えて」「〇〇の市場調査をして」
- 「〇〇のトレンドを調査して」「〇〇について情報を集めて」

## ワークフロー

```
[Phase 1] トピック分析・検索クエリ設計
    ↓
[Phase 2] 情報収集 (WebSearch)
    ↓
[Phase 3] 情報整理・分析
    ↓
[Phase 4] レポート作成
    ↓
[Phase 5] 保存・納品
```

→ 詳細: `references/workflow.md`

## 出力先

```
agent-output/research-{YYYYMMDD}-{topic}/
├── work/                     # 作業ファイル
│   ├── search-queries.md     # 検索クエリ一覧
│   ├── raw-sources.md        # 収集した生データ
│   └── analysis.md           # 分析メモ
└── report.md                 # 最終成果物
```

→ レポート構成: `references/report-template.md`
→ 使用例: `examples/usage.md`
