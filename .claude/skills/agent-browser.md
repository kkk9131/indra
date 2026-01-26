---
name: agent-browser
description: ブラウザ自動化（Web操作、フォーム入力、スクリーンショット、データ抽出）。ユーザーがWebサイト操作、フォーム入力、スクショ取得、Webテスト、情報抽出を必要とする場合に使用。
triggers:
  - ブラウザ自動化
  - Web操作
  - フォーム入力
  - スクリーンショット
  - ページ取得
  - ログイン自動化
  - スクレイピング
allowed-tools: Bash(agent-browser:*)
---

# Browser Automation with agent-browser

## Quick Start

```bash
agent-browser open <url>        # ページを開く
agent-browser snapshot -i       # インタラクティブ要素を@ref付きで取得
agent-browser click @e1         # @refでクリック
agent-browser fill @e2 "text"   # @refで入力
agent-browser close             # ブラウザを閉じる
```

## Core Workflow

1. **Navigate**: `agent-browser open <url>`
2. **Snapshot**: `agent-browser snapshot -i` → `@e1`, `@e2`形式のref取得
3. **Interact**: refを使って操作
4. **Re-snapshot**: ナビゲーション/DOM変更後は再取得必須

## 主要コマンド

| カテゴリ | コマンド                           | 説明                 |
| -------- | ---------------------------------- | -------------------- |
| 移動     | `open`, `back`, `forward`, `close` | ナビゲーション       |
| 分析     | `snapshot -i`                      | 要素を@ref付きで取得 |
| 操作     | `click`, `fill`, `type`, `select`  | 要素操作             |
| 取得     | `get text/url/title`               | 情報取得             |
| 保存     | `screenshot`, `pdf`                | 画面保存             |
| 待機     | `wait @e1`, `wait 2000`            | 要素/時間待機        |

## セッション管理

```bash
agent-browser --session auth open https://app.com     # 分離セッション
agent-browser state save ./auth.json                  # 状態保存
agent-browser state load ./auth.json                  # 状態復元
```

## References

詳細は以下を参照:

| ドキュメント                                     | 内容                                 |
| ------------------------------------------------ | ------------------------------------ |
| `references/agent-browser/commands.md`           | 全コマンド詳細                       |
| `references/agent-browser/snapshot-refs.md`      | @refライフサイクル、トラブルシュート |
| `references/agent-browser/session-management.md` | 並列セッション、状態永続化           |
| `references/agent-browser/authentication.md`     | ログインフロー、OAuth、2FA           |
| `references/agent-browser/video-recording.md`    | デバッグ用録画                       |
| `references/agent-browser/proxy-support.md`      | プロキシ設定                         |

## Examples

実行可能なワークフローテンプレート:

| テンプレート                                      | 内容                     |
| ------------------------------------------------- | ------------------------ |
| `examples/agent-browser/form-automation.sh`       | フォーム入力・送信       |
| `examples/agent-browser/authenticated-session.sh` | ログイン→状態保存→再利用 |
| `examples/agent-browser/capture-workflow.sh`      | コンテンツ抽出+スクショ  |
