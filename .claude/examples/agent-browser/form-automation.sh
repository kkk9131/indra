#!/bin/bash
# Template: Form Automation Workflow
# フォーム入力・送信のワークフロー

set -euo pipefail

FORM_URL="${1:?Usage: $0 <form-url>}"

echo "Automating form at: $FORM_URL"

# フォームページに移動
agent-browser open "$FORM_URL"
agent-browser wait --load networkidle

# インタラクティブスナップショットでフォーム構造を確認
echo "Analyzing form structure..."
agent-browser snapshot -i

# 例: 一般的なフォームフィールド入力
# スナップショット出力のrefに合わせて修正

# テキスト入力
# agent-browser fill @e1 "John Doe"           # 名前
# agent-browser fill @e2 "user@example.com"   # メール
# agent-browser fill @e3 "+1-555-123-4567"    # 電話

# パスワード
# agent-browser fill @e4 "SecureP@ssw0rd!"

# ドロップダウン
# agent-browser select @e5 "Option Value"

# チェックボックス
# agent-browser check @e6                      # チェック
# agent-browser uncheck @e7                    # アンチェック

# ラジオボタン
# agent-browser click @e8                      # ラジオ選択

# テキストエリア
# agent-browser fill @e9 "複数行テキスト"

# ファイルアップロード
# agent-browser upload @e10 /path/to/file.pdf

# フォーム送信
# agent-browser click @e11                     # 送信ボタン

# レスポンス待機
# agent-browser wait --load networkidle
# agent-browser wait --url "**/success"        # またはリダイレクト待機

# 送信結果確認
echo "Form submission result:"
agent-browser get url
agent-browser snapshot -i

# 結果スクリーンショット
agent-browser screenshot /tmp/form-result.png

# クリーンアップ
agent-browser close

echo "Form automation complete"
