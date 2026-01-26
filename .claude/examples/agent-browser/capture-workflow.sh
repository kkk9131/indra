#!/bin/bash
# Template: Content Capture Workflow
# Webページからコンテンツ抽出（認証オプション付き）

set -euo pipefail

TARGET_URL="${1:?Usage: $0 <url> [output-dir]}"
OUTPUT_DIR="${2:-.}"

echo "Capturing content from: $TARGET_URL"
mkdir -p "$OUTPUT_DIR"

# オプション: 必要に応じて認証状態を読み込み
# if [[ -f "./auth-state.json" ]]; then
#     agent-browser state load "./auth-state.json"
# fi

# ターゲットページに移動
agent-browser open "$TARGET_URL"
agent-browser wait --load networkidle

# ページメタデータ取得
echo "Page title: $(agent-browser get title)"
echo "Page URL: $(agent-browser get url)"

# フルページスクリーンショット
agent-browser screenshot --full "$OUTPUT_DIR/page-full.png"
echo "Screenshot saved: $OUTPUT_DIR/page-full.png"

# ページ構造取得
agent-browser snapshot -i > "$OUTPUT_DIR/page-structure.txt"
echo "Structure saved: $OUTPUT_DIR/page-structure.txt"

# メインコンテンツ抽出
# ターゲットサイト構造に合わせてセレクタ調整
# agent-browser get text @e1 > "$OUTPUT_DIR/main-content.txt"

# 特定要素抽出（必要に応じてコメント解除）
# agent-browser get text "article" > "$OUTPUT_DIR/article.txt"
# agent-browser get text "main" > "$OUTPUT_DIR/main.txt"
# agent-browser get text ".content" > "$OUTPUT_DIR/content.txt"

# フルページテキスト取得
agent-browser get text body > "$OUTPUT_DIR/page-text.txt"
echo "Text content saved: $OUTPUT_DIR/page-text.txt"

# オプション: PDF保存
agent-browser pdf "$OUTPUT_DIR/page.pdf"
echo "PDF saved: $OUTPUT_DIR/page.pdf"

# オプション: 無限スクロールページ用のスクロール＋キャプチャ
# scroll_and_capture() {
#     local count=0
#     while [[ $count -lt 5 ]]; do
#         agent-browser scroll down 1000
#         agent-browser wait 1000
#         ((count++))
#     done
#     agent-browser screenshot --full "$OUTPUT_DIR/page-scrolled.png"
# }
# scroll_and_capture

# クリーンアップ
agent-browser close

echo ""
echo "Capture complete! Files saved to: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"
