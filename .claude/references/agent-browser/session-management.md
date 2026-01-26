# Session Management

複数の分離ブラウザセッションを並行実行＋状態永続化。

## Named Sessions

`--session`フラグでブラウザコンテキストを分離:

```bash
# セッション1: 認証フロー
agent-browser --session auth open https://app.example.com/login

# セッション2: 公開ブラウジング（別のCookie/ストレージ）
agent-browser --session public open https://example.com

# コマンドはセッションごとに分離
agent-browser --session auth fill @e1 "user@example.com"
agent-browser --session public get text body
```

## セッション分離プロパティ

各セッションは独立:

- Cookies
- LocalStorage / SessionStorage
- IndexedDB
- Cache
- 閲覧履歴
- 開いているタブ

## 状態の永続化

### 保存

```bash
agent-browser state save /path/to/auth-state.json
```

### 読み込み

```bash
agent-browser state load /path/to/auth-state.json
agent-browser open https://app.example.com/dashboard
```

### 状態ファイル構造

```json
{
  "cookies": [...],
  "localStorage": {...},
  "sessionStorage": {...},
  "origins": [...]
}
```

## 一般的なパターン

### 認証済みセッション再利用

```bash
#!/bin/bash
STATE_FILE="/tmp/auth-state.json"

if [[ -f "$STATE_FILE" ]]; then
    agent-browser state load "$STATE_FILE"
    agent-browser open https://app.example.com/dashboard
else
    agent-browser open https://app.example.com/login
    agent-browser snapshot -i
    agent-browser fill @e1 "$USERNAME"
    agent-browser fill @e2 "$PASSWORD"
    agent-browser click @e3
    agent-browser wait --load networkidle
    agent-browser state save "$STATE_FILE"
fi
```

### 並行スクレイピング

```bash
#!/bin/bash
# 全セッション開始
agent-browser --session site1 open https://site1.com &
agent-browser --session site2 open https://site2.com &
agent-browser --session site3 open https://site3.com &
wait

# 各セッションから抽出
agent-browser --session site1 get text body > site1.txt
agent-browser --session site2 get text body > site2.txt
agent-browser --session site3 get text body > site3.txt

# クリーンアップ
agent-browser --session site1 close
agent-browser --session site2 close
agent-browser --session site3 close
```

### A/Bテストセッション

```bash
agent-browser --session variant-a open "https://app.com?variant=a"
agent-browser --session variant-b open "https://app.com?variant=b"

agent-browser --session variant-a screenshot /tmp/variant-a.png
agent-browser --session variant-b screenshot /tmp/variant-b.png
```

## デフォルトセッション

`--session`省略時はデフォルトセッション使用:

```bash
agent-browser open https://example.com
agent-browser snapshot -i
agent-browser close  # デフォルトセッション終了
```

## クリーンアップ

```bash
agent-browser --session auth close  # 特定セッション終了
agent-browser session list          # アクティブセッション一覧
```

## ベストプラクティス

1. **意味のある名前をつける**: `--session github-auth`
2. **必ずクリーンアップ**: 終了時にclose
3. **状態ファイルは安全に**: `.gitignore`に追加
4. **長時間セッションにはタイムアウト**: `timeout 60 agent-browser ...`
