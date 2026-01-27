# Video Recording

デバッグ、ドキュメント作成、検証用にブラウザ自動化セッションを録画。

## 基本録画

```bash
# 録画開始
agent-browser record start ./demo.webm

# 操作実行
agent-browser open https://example.com
agent-browser snapshot -i
agent-browser click @e1
agent-browser fill @e2 "test input"

# 停止＋保存
agent-browser record stop
```

## コマンド

```bash
agent-browser record start ./output.webm  # 録画開始
agent-browser record stop                 # 停止
agent-browser record restart ./take2.webm # 停止＋新規開始
```

## ユースケース

### デバッグ用録画

```bash
#!/bin/bash
agent-browser record start ./debug-$(date +%Y%m%d-%H%M%S).webm

agent-browser open https://app.example.com
agent-browser snapshot -i
agent-browser click @e1 || {
    echo "クリック失敗 - 録画を確認"
    agent-browser record stop
    exit 1
}

agent-browser record stop
```

### ドキュメント生成

```bash
#!/bin/bash
agent-browser record start ./docs/how-to-login.webm

agent-browser open https://app.example.com/login
agent-browser wait 1000  # 視認性のため一時停止

agent-browser snapshot -i
agent-browser fill @e1 "demo@example.com"
agent-browser wait 500

agent-browser fill @e2 "password"
agent-browser wait 500

agent-browser click @e3
agent-browser wait --load networkidle
agent-browser wait 1000  # 結果表示

agent-browser record stop
```

### CI/CDテストエビデンス

```bash
#!/bin/bash
TEST_NAME="${1:-e2e-test}"
RECORDING_DIR="./test-recordings"
mkdir -p "$RECORDING_DIR"

agent-browser record start "$RECORDING_DIR/$TEST_NAME-$(date +%s).webm"

if run_e2e_test; then
    echo "テスト成功"
else
    echo "テスト失敗 - 録画保存済み"
fi

agent-browser record stop
```

## ベストプラクティス

### 1. 視聴者のため一時停止を入れる

```bash
agent-browser click @e1
agent-browser wait 500  # 結果を見せる
```

### 2. ファイル名に説明を入れる

```bash
agent-browser record start ./recordings/login-flow-2024-01-15.webm
agent-browser record start ./recordings/checkout-test-run-42.webm
```

### 3. エラー時も録画を保存

```bash
#!/bin/bash
set -e

cleanup() {
    agent-browser record stop 2>/dev/null || true
    agent-browser close 2>/dev/null || true
}
trap cleanup EXIT

agent-browser record start ./automation.webm
# ... 自動化ステップ ...
```

### 4. スクリーンショットと組み合わせ

```bash
agent-browser record start ./flow.webm

agent-browser open https://example.com
agent-browser screenshot ./screenshots/step1-homepage.png

agent-browser click @e1
agent-browser screenshot ./screenshots/step2-after-click.png

agent-browser record stop
```

## 出力形式

- デフォルト: WebM (VP8/VP9コーデック)
- 全モダンブラウザ/動画プレーヤー互換
- 圧縮されつつ高品質

## 制限事項

- 録画は自動化にわずかなオーバーヘッドを追加
- 大きな録画はディスク容量を消費
- 一部ヘッドレス環境ではコーデック制限あり
