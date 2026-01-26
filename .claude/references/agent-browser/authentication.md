# Authentication Patterns

ログインフロー、セッション永続化、認証済みブラウジングのパターン。

## 基本ログインフロー

```bash
# ログインページに移動
agent-browser open https://app.example.com/login
agent-browser wait --load networkidle

# フォーム要素を取得
agent-browser snapshot -i
# 出力: @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Sign In"

# 認証情報入力
agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"

# 送信
agent-browser click @e3
agent-browser wait --load networkidle

# ログイン成功確認
agent-browser get url  # ダッシュボードになっているはず
```

## 認証状態の保存

ログイン後に状態を保存:

```bash
agent-browser open https://app.example.com/login
agent-browser snapshot -i
agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3
agent-browser wait --url "**/dashboard"

# 認証済み状態を保存
agent-browser state save ./auth-state.json
```

## 認証の復元

保存した状態を読み込んでログインをスキップ:

```bash
agent-browser state load ./auth-state.json
agent-browser open https://app.example.com/dashboard
agent-browser snapshot -i
```

## OAuth / SSOフロー

OAuthリダイレクト対応:

```bash
# OAuthフロー開始
agent-browser open https://app.example.com/auth/google

# リダイレクト待機
agent-browser wait --url "**/accounts.google.com**"
agent-browser snapshot -i

# Google認証情報入力
agent-browser fill @e1 "user@gmail.com"
agent-browser click @e2  # Nextボタン
agent-browser wait 2000
agent-browser snapshot -i
agent-browser fill @e3 "password"
agent-browser click @e4  # Sign in

# アプリへのリダイレクト待機
agent-browser wait --url "**/app.example.com**"
agent-browser state save ./oauth-state.json
```

## 二要素認証 (2FA)

手動介入が必要な2FA:

```bash
# 認証情報でログイン
agent-browser open https://app.example.com/login --headed  # ブラウザ表示
agent-browser snapshot -i
agent-browser fill @e1 "user@example.com"
agent-browser fill @e2 "password123"
agent-browser click @e3

# ユーザーが手動で2FA完了するのを待機
echo "ブラウザウィンドウで2FAを完了してください..."
agent-browser wait --url "**/dashboard" --timeout 120000

# 2FA後に状態保存
agent-browser state save ./2fa-state.json
```

## HTTP Basic認証

Basic認証を使用するサイト:

```bash
agent-browser set credentials username password
agent-browser open https://protected.example.com/api
```

## Cookie認証

認証Cookieを手動設定:

```bash
agent-browser cookies set session_token "abc123xyz"
agent-browser open https://app.example.com/dashboard
```

## トークン更新処理

期限切れトークン対応:

```bash
#!/bin/bash
STATE_FILE="./auth-state.json"

if [[ -f "$STATE_FILE" ]]; then
    agent-browser state load "$STATE_FILE"
    agent-browser open https://app.example.com/dashboard

    URL=$(agent-browser get url)
    if [[ "$URL" == *"/login"* ]]; then
        echo "セッション期限切れ、再認証中..."
        agent-browser snapshot -i
        agent-browser fill @e1 "$USERNAME"
        agent-browser fill @e2 "$PASSWORD"
        agent-browser click @e3
        agent-browser wait --url "**/dashboard"
        agent-browser state save "$STATE_FILE"
    fi
else
    # 初回ログイン
    agent-browser open https://app.example.com/login
    # ... ログインフロー ...
fi
```

## セキュリティベストプラクティス

1. **状態ファイルをコミットしない**: セッショントークンが含まれる

   ```bash
   echo "*.auth-state.json" >> .gitignore
   ```

2. **環境変数で認証情報管理**

   ```bash
   agent-browser fill @e1 "$APP_USERNAME"
   agent-browser fill @e2 "$APP_PASSWORD"
   ```

3. **自動化後にクリーンアップ**

   ```bash
   agent-browser cookies clear
   rm -f ./auth-state.json
   ```

4. **CI/CDでは短命セッション使用**
   ```bash
   # CIでは状態を永続化しない
   agent-browser open https://app.example.com/login
   # ... ログインと操作 ...
   agent-browser close  # セッション終了、何も永続化されない
   ```
