#!/bin/bash
# Template: Authenticated Session Workflow
# ログイン→状態保存→再利用
#
# Usage:
#   ./authenticated-session.sh <login-url> [state-file]
#
# Setup:
#   1. 一度実行してフォーム構造を確認
#   2. フィールドの@refをメモ
#   3. LOGIN FLOWセクションのコメントを外してrefを更新

set -euo pipefail

LOGIN_URL="${1:?Usage: $0 <login-url> [state-file]}"
STATE_FILE="${2:-./auth-state.json}"

echo "Authentication workflow for: $LOGIN_URL"

# ══════════════════════════════════════════════════════════════
# 保存済み状態: 有効な状態があればログインスキップ
# ══════════════════════════════════════════════════════════════
if [[ -f "$STATE_FILE" ]]; then
    echo "Loading saved authentication state..."
    agent-browser state load "$STATE_FILE"
    agent-browser open "$LOGIN_URL"
    agent-browser wait --load networkidle

    CURRENT_URL=$(agent-browser get url)
    if [[ "$CURRENT_URL" != *"login"* ]] && [[ "$CURRENT_URL" != *"signin"* ]]; then
        echo "Session restored successfully!"
        agent-browser snapshot -i
        exit 0
    fi
    echo "Session expired, performing fresh login..."
    rm -f "$STATE_FILE"
fi

# ══════════════════════════════════════════════════════════════
# 発見モード: フォーム構造を表示（セットアップ後削除）
# ══════════════════════════════════════════════════════════════
echo "Opening login page..."
agent-browser open "$LOGIN_URL"
agent-browser wait --load networkidle

echo ""
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ LOGIN FORM STRUCTURE                                    │"
echo "├─────────────────────────────────────────────────────────┤"
agent-browser snapshot -i
echo "└─────────────────────────────────────────────────────────┘"
echo ""
echo "Next steps:"
echo "  1. Note refs: @e? = username, @e? = password, @e? = submit"
echo "  2. Uncomment LOGIN FLOW section below"
echo "  3. Replace @e1, @e2, @e3 with your refs"
echo "  4. Delete this DISCOVERY MODE section"
echo ""
agent-browser close
exit 0

# ══════════════════════════════════════════════════════════════
# LOGIN FLOW: 発見後にコメント解除してカスタマイズ
# ══════════════════════════════════════════════════════════════
# : "${APP_USERNAME:?Set APP_USERNAME environment variable}"
# : "${APP_PASSWORD:?Set APP_PASSWORD environment variable}"
#
# agent-browser open "$LOGIN_URL"
# agent-browser wait --load networkidle
# agent-browser snapshot -i
#
# # 認証情報入力（フォームに合わせてref更新）
# agent-browser fill @e1 "$APP_USERNAME"
# agent-browser fill @e2 "$APP_PASSWORD"
# agent-browser click @e3
# agent-browser wait --load networkidle
#
# # ログイン成功確認
# FINAL_URL=$(agent-browser get url)
# if [[ "$FINAL_URL" == *"login"* ]] || [[ "$FINAL_URL" == *"signin"* ]]; then
#     echo "ERROR: Login failed - still on login page"
#     agent-browser screenshot /tmp/login-failed.png
#     agent-browser close
#     exit 1
# fi
#
# # 今後の実行用に状態保存
# echo "Saving authentication state to: $STATE_FILE"
# agent-browser state save "$STATE_FILE"
# echo "Login successful!"
# agent-browser snapshot -i
