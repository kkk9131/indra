# Snapshot + Refs Workflow

agent-browserの核心: AIエージェント向けコンパクトな要素参照でトークン使用量を劇的に削減。

## 仕組み

### 従来の問題

```
Full DOM/HTML送信 → AI解析 → CSSセレクタ生成 → 実行
~3000-5000 tokens/操作
```

### 解決策

```
コンパクトスナップショット → @ref割当 → ref直接操作
~200-400 tokens/操作
```

## Snapshotコマンド

```bash
agent-browser snapshot        # 基本（ページ構造表示）
agent-browser snapshot -i     # インタラクティブのみ（推奨）
```

### 出力形式

```
Page: Example Site - Home
URL: https://example.com

@e1 [header]
  @e2 [nav]
    @e3 [a] "Home"
    @e4 [a] "Products"
  @e6 [button] "Sign In"

@e7 [main]
  @e9 [form]
    @e10 [input type="email"] placeholder="Email"
    @e11 [input type="password"] placeholder="Password"
    @e12 [button type="submit"] "Log In"
```

## Refの使用

```bash
agent-browser click @e6                    # Sign Inボタンクリック
agent-browser fill @e10 "user@example.com" # メール入力
agent-browser fill @e11 "password123"      # パスワード入力
agent-browser click @e12                   # フォーム送信
```

## Refライフサイクル

**重要**: ページ変更時にRefは無効化される

```bash
agent-browser snapshot -i
# @e1 [button] "Next"

agent-browser click @e1        # ページ遷移

# 必ず再スナップショット
agent-browser snapshot -i
# @e1 [h1] "Page 2"  ← 別の要素
```

## ベストプラクティス

### 1. 操作前に必ずスナップショット

```bash
# 正しい
agent-browser open https://example.com
agent-browser snapshot -i
agent-browser click @e1

# 間違い
agent-browser open https://example.com
agent-browser click @e1  # refが存在しない
```

### 2. ナビゲーション後は再スナップショット

```bash
agent-browser click @e5        # ページ遷移
agent-browser snapshot -i      # 新しいref取得
agent-browser click @e1        # 新refを使用
```

### 3. 動的変更後も再スナップショット

```bash
agent-browser click @e1        # ドロップダウン開く
agent-browser snapshot -i      # ドロップダウン項目を見る
agent-browser click @e7        # 項目選択
```

### 4. 特定領域のスナップショット

```bash
agent-browser snapshot @e9     # フォームのみ
```

## Ref記法

```
@e1 [tag type="value"] "text content" placeholder="hint"
│    │   │             │               │
│    │   │             │               └─ 追加属性
│    │   │             └─ 表示テキスト
│    │   └─ 主要属性
│    └─ HTMLタグ
└─ 一意のref ID
```

### 一般的なパターン

```
@e1 [button] "Submit"                    # ボタン
@e2 [input type="email"]                 # メール入力
@e3 [input type="password"]              # パスワード入力
@e4 [a href="/page"] "Link Text"         # リンク
@e5 [select]                             # ドロップダウン
@e6 [textarea] placeholder="Message"     # テキストエリア
@e9 [checkbox] checked                   # チェック済み
@e10 [radio] selected                    # 選択済みラジオ
```

## トラブルシューティング

### "Ref not found" エラー

```bash
# refが変わった可能性 - 再スナップショット
agent-browser snapshot -i
```

### 要素がスナップショットに出ない

```bash
# スクロールで表示
agent-browser scroll --bottom
agent-browser snapshot -i

# または動的コンテンツを待機
agent-browser wait 1000
agent-browser snapshot -i
```

### 要素が多すぎる

```bash
# 特定コンテナのみ
agent-browser snapshot @e5

# またはテキストのみ抽出
agent-browser get text @e5
```
