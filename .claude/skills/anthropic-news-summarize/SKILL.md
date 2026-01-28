---
name: anthropic-news-summarize
description: 記事本文から100-200文字の日本語要約を生成する。
triggers:
  - /anthropic-news-summarize
  - 要約を生成
  - summarize
---

# Anthropic News Summarize Skill

記事本文から簡潔な日本語要約を生成する。

## 発動キーワード

- `/anthropic-news-summarize`
- `要約を生成`

## 入力

記事本文（テキスト）

## 出力

100-200文字の日本語要約

## 要約ルール

1. **文字数**: 100-200文字
2. **言語**: 日本語
3. **内容**:
   - 記事の主要なポイントを抽出
   - 技術的な内容は簡潔に説明
   - 冗長な表現を避ける
4. **形式**:
   - 1段落で完結
   - 句読点を適切に使用
   - 敬体（です・ます調）

## 例

### 入力

```
Today we're releasing Claude 4.0, our most capable model yet.
Claude 4.0 demonstrates significant improvements in reasoning,
coding, and multilingual capabilities. The model achieves
state-of-the-art performance on major benchmarks while
maintaining our commitment to safety and reliability.
```

### 出力

```
Anthropicは最新モデル「Claude 4.0」をリリースしました。推論、コーディング、多言語対応において大幅な性能向上を実現し、主要ベンチマークで最先端の結果を達成しています。安全性と信頼性へのコミットメントも維持されています。
```

## 注意事項

- 本文がない場合は空文字列を返す
- 技術用語は適切に翻訳または説明
- 固有名詞（Claude、Anthropic等）はそのまま使用
