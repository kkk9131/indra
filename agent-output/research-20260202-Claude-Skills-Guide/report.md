# Claude Skills 完全ガイド - リサーチレポート

**作成日:** 2026-02-02
**トピック:** Claude Skills の構築方法と MCP との統合
**ソース:** Anthropic 公式ブログ、GitHub リポジトリ

---

## エグゼクティブサマリー

Anthropic は 2025年10月に Claude Skills をローンチし、開発者・パワーユーザー・チームが一貫したワークフロー自動化を実現できるようになった。本レポートでは、Skills の構造、MCP との統合方法、ベストプラクティスについて詳細に解説する。

**主要な発見:**

- Skills は 15-30 分で最初の動作するスキルを構築可能
- Skills と MCP を組み合わせることでトークン使用量を最大 65% 削減可能
- Skills は Claude.ai、Claude Code、API で統一的に動作

---

## 1. Skills とは何か

### 1.1 定義

Skills は「特定の領域での専門知識をフォルダに格納し、関連性に応じて動的に読み込まれる」再利用可能なワークフローである。

### 1.2 対象ユーザー

| ユーザータイプ       | ユースケース                                      |
| -------------------- | ------------------------------------------------- |
| 開発者               | Claude に特定のワークフローを一貫して実行させたい |
| パワーユーザー       | ドキュメント作成やリサーチプロセスの自動化        |
| チーム               | 組織全体で Claude の動作を標準化                  |
| MCP コネクタビルダー | 統合と信頼性の高いワークフローの組み合わせ        |

### 1.3 他のツールとの比較

| 特性       | Skills                 | プロンプト       | Projects             | MCP            |
| ---------- | ---------------------- | ---------------- | -------------------- | -------------- |
| **用途**   | 反復的な手順・専門知識 | その場限りの指示 | 継続的な背景知識     | データアクセス |
| **持続性** | 複数会話間で保持       | 単一会話内のみ   | プロジェクト内で保持 | 継続的に接続   |
| **複雑さ** | 中                     | 低               | 中                   | 高             |

---

## 2. Skills の技術構造

### 2.1 ディレクトリ構成

```
my-skill/
├── SKILL.md           # 必須: スキル定義ファイル
├── resources/         # オプション: 追加リソース
│   ├── examples/
│   └── templates/
└── scripts/           # オプション: 補助スクリプト
```

### 2.2 SKILL.md フォーマット

```yaml
---
name: my-skill-name
description: A clear description of what this skill does and when to use it
---

# My Skill Name

[Claude が従う指示をここに記述]

## Examples
- Example usage 1
- Example usage 2

## Guidelines
- Guideline 1
- Guideline 2
```

**必須フィールド:**

- `name`: スキルの一意識別子（小文字、スペースはハイフン）
- `description`: スキルの完全な説明と使用時期

### 2.3 動的ロード機構

1. Claude はまずメタデータ（フロントマター）を読み込む
2. 関連性が判断されると完全な指示がロードされる
3. コンテキストウィンドウの効率的な使用を実現

---

## 3. Skills と MCP の統合

### 3.1 役割の違い

| MCP                        | Skills                   |
| -------------------------- | ------------------------ |
| 外部システムへの**接続**   | 接続の**活用方法**       |
| リアルタイムデータアクセス | プロセスの一貫性         |
| API 統合                   | ドメイン知識のキャプチャ |

### 3.2 組み合わせの利点

1. **明確な発見**: 複数のデータソースがある場合、スキルが検索順序を指定
2. **信頼できるオーケストレーション**: 複数ステップのワークフローが一貫して実行
3. **パフォーマンス向上**: トークン使用量を最大 65% 削減可能

### 3.3 実践例: 会議準備

```
[MCP サーバー]
├── Notion MCP → ドキュメントアクセス
├── Calendar MCP → スケジュール情報
└── Slack MCP → チャンネル履歴

[Skills]
└── meeting-prep-skill
    ├── どのページを引き出すか
    ├── ドキュメントのフォーマット方法
    └── チームの標準
```

---

## 4. Skills の利用方法

### 4.1 Claude Code での使用

```bash
# マーケットプレイスからスキルを追加
/plugin marketplace add anthropics/skills

# スキルを直接インストール
/plugin install document-skills@anthropic-agent-skills
```

### 4.2 Claude.ai での使用

- 有料プランで利用可能
- プロジェクト設定からスキルを追加

### 4.3 Claude API での使用

- Skills API Quickstart で実装
- 事前構築スキルとカスタムスキルをサポート

---

## 5. Anthropic 公式スキル一覧

### 5.1 Document Skills

| スキル | 説明                  |
| ------ | --------------------- |
| `docx` | Word 文書の作成・編集 |
| `pdf`  | PDF 処理・抽出        |
| `pptx` | PowerPoint 作成       |
| `xlsx` | Excel データ処理      |

### 5.2 カテゴリ別

| カテゴリ                   | 例                                     |
| -------------------------- | -------------------------------------- |
| Creative & Design          | アート、音楽、デザイン生成             |
| Development & Technical    | Web アプリテスト、MCP サーバー生成     |
| Enterprise & Communication | 社内コミュニケーション、ブランディング |

---

## 6. ベストプラクティス

### 6.1 スキル設計

1. **明確な発動条件**: `description` でいつ使うべきかを明示
2. **段階的開示**: 詳細は別ファイルに分離し、必要時のみロード
3. **単一責任**: 1 スキル = 1 ワークフロー

### 6.2 MCP との統合

1. MCP で接続を確立
2. Skills で利用方法を定義
3. 組み合わせてエンドツーエンドの自動化を実現

### 6.3 テスト

- 実装と動作は環境によって異なる可能性あり
- 本番環境での使用前に十分なテストが必要

---

## 7. 次のステップ

### 7.1 初心者向け

1. `skill-creator` を使って最初のスキルを作成（15-30 分）
2. 自動化したいトップ 2-3 のワークフローを特定
3. 公式テンプレートを参考に実装

### 7.2 上級者向け

1. MCP サーバーとの統合を検討
2. チーム向け標準スキルライブラリを構築
3. API 経由でのスキル呼び出しを実装

---

## 参考リンク

- [A Complete Guide to Building Skills for Claude](https://claude.com/blog/complete-guide-to-building-skills-for-claude)
- [Skills Explained](https://claude.com/blog/skills-explained)
- [Extending Claude's Capabilities with Skills and MCP](https://claude.com/blog/extending-claude-capabilities-with-skills-mcp-servers)
- [GitHub: anthropics/skills](https://github.com/anthropics/skills)
- [Claude Skills Library - MCP Servers](https://mcpservers.org/claude-skills)

---

**レポート作成:** Indra Research Agent
**検証日:** 2026-02-02
