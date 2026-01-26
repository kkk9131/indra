# agent-browser 全コマンドリファレンス

## Navigation

```bash
agent-browser open <url>      # URL移動 (aliases: goto, navigate)
                              # https://, http://, file://, about:, data:// 対応
                              # プロトコル省略時は https:// 自動付与
agent-browser back            # 戻る
agent-browser forward         # 進む
agent-browser reload          # リロード
agent-browser close           # 閉じる (aliases: quit, exit)
agent-browser connect 9222    # CDP接続
```

## Snapshot

```bash
agent-browser snapshot            # 全アクセシビリティツリー
agent-browser snapshot -i         # インタラクティブ要素のみ（推奨）
agent-browser snapshot -c         # コンパクト出力
agent-browser snapshot -d 3       # 深さ制限
agent-browser snapshot -s "#main" # CSSセレクタでスコープ
```

## Interactions

```bash
agent-browser click @e1           # クリック
agent-browser dblclick @e1        # ダブルクリック
agent-browser focus @e1           # フォーカス
agent-browser fill @e2 "text"     # クリア＋入力
agent-browser type @e2 "text"     # クリアせず入力
agent-browser press Enter         # キー押下 (alias: key)
agent-browser press Control+a     # キーコンビネーション
agent-browser keydown Shift       # キーダウン
agent-browser keyup Shift         # キーアップ
agent-browser hover @e1           # ホバー
agent-browser check @e1           # チェックボックスON
agent-browser uncheck @e1         # チェックボックスOFF
agent-browser select @e1 "value"  # ドロップダウン選択
agent-browser select @e1 "a" "b"  # 複数選択
agent-browser scroll down 500     # スクロール (default: down 300px)
agent-browser scrollintoview @e1  # 要素を表示位置にスクロール
agent-browser drag @e1 @e2        # ドラッグ＆ドロップ
agent-browser upload @e1 file.pdf # ファイルアップロード
```

## Get Information

```bash
agent-browser get text @e1        # テキスト取得
agent-browser get html @e1        # innerHTML取得
agent-browser get value @e1       # input値取得
agent-browser get attr @e1 href   # 属性取得
agent-browser get title           # ページタイトル
agent-browser get url             # 現在URL
agent-browser get count ".item"   # マッチ数カウント
agent-browser get box @e1         # バウンディングボックス
agent-browser get styles @e1      # 計算済みスタイル
```

## Check State

```bash
agent-browser is visible @e1      # 可視チェック
agent-browser is enabled @e1      # 有効チェック
agent-browser is checked @e1      # チェック状態
```

## Screenshots & PDF

```bash
agent-browser screenshot          # 一時ディレクトリに保存
agent-browser screenshot path.png # 指定パスに保存
agent-browser screenshot --full   # フルページ
agent-browser pdf output.pdf      # PDF保存
```

## Video Recording

```bash
agent-browser record start ./demo.webm    # 録画開始
agent-browser record stop                 # 録画停止＋保存
agent-browser record restart ./take2.webm # 停止＋新規開始
```

## Wait

```bash
agent-browser wait @e1                     # 要素待機
agent-browser wait 2000                    # ミリ秒待機
agent-browser wait --text "Success"        # テキスト待機 (-t)
agent-browser wait --url "**/dashboard"    # URLパターン待機 (-u)
agent-browser wait --load networkidle      # ネットワーク待機 (-l)
agent-browser wait --fn "window.ready"     # JS条件待機 (-f)
```

## Mouse Control

```bash
agent-browser mouse move 100 200      # マウス移動
agent-browser mouse down left         # ボタン押下
agent-browser mouse up left           # ボタン解放
agent-browser mouse wheel 100         # ホイールスクロール
```

## Semantic Locators

```bash
agent-browser find role button click --name "Submit"
agent-browser find text "Sign In" click
agent-browser find text "Sign In" click --exact      # 完全一致
agent-browser find label "Email" fill "user@test.com"
agent-browser find placeholder "Search" type "query"
agent-browser find alt "Logo" click
agent-browser find title "Close" click
agent-browser find testid "submit-btn" click
agent-browser find first ".item" click
agent-browser find last ".item" click
agent-browser find nth 2 "a" hover
```

## Browser Settings

```bash
agent-browser set viewport 1920 1080          # ビューポート
agent-browser set device "iPhone 14"          # デバイスエミュレーション
agent-browser set geo 37.7749 -122.4194       # 位置情報
agent-browser set offline on                  # オフラインモード
agent-browser set headers '{"X-Key":"v"}'     # HTTPヘッダー
agent-browser set credentials user pass       # Basic認証
agent-browser set media dark                  # カラースキーム
agent-browser set media light reduced-motion  # ライト+reduced-motion
```

## Cookies & Storage

```bash
agent-browser cookies                     # 全Cookie取得
agent-browser cookies set name value      # Cookie設定
agent-browser cookies clear               # Cookie削除
agent-browser storage local               # 全localStorage取得
agent-browser storage local key           # 特定キー取得
agent-browser storage local set k v       # 値設定
agent-browser storage local clear         # 全削除
```

## Network

```bash
agent-browser network route <url>              # リクエストインターセプト
agent-browser network route <url> --abort      # リクエストブロック
agent-browser network route <url> --body '{}'  # モックレスポンス
agent-browser network unroute [url]            # ルート削除
agent-browser network requests                 # トラッキング確認
agent-browser network requests --filter api    # フィルタリング
```

## Tabs & Windows

```bash
agent-browser tab                 # タブ一覧
agent-browser tab new [url]       # 新規タブ
agent-browser tab 2               # タブ切替
agent-browser tab close           # 現在タブ閉じる
agent-browser tab close 2         # 指定タブ閉じる
agent-browser window new          # 新規ウィンドウ
```

## Frames

```bash
agent-browser frame "#iframe"     # iframe切替
agent-browser frame main          # メインフレームに戻る
```

## Dialogs

```bash
agent-browser dialog accept [text]  # ダイアログ承認
agent-browser dialog dismiss        # ダイアログ却下
```

## JavaScript

```bash
agent-browser eval "document.title"   # JavaScript実行
```

## Global Options

```bash
--session <name>           # 分離セッション
--json                     # JSON出力
--headed                   # ブラウザ表示（ヘッドレスでない）
--full (-f)                # フルページスクリーンショット
--cdp <port>               # CDP接続
-p, --provider <name>      # クラウドブラウザプロバイダ
--proxy <url>              # プロキシ
--headers <json>           # HTTPヘッダー
--executable-path <path>   # カスタムブラウザ
--extension <path>         # 拡張機能（複数可）
--ignore-https-errors      # 証明書エラー無視
```

## Environment Variables

```bash
AGENT_BROWSER_SESSION            # デフォルトセッション名
AGENT_BROWSER_EXECUTABLE_PATH    # カスタムブラウザパス
AGENT_BROWSER_EXTENSIONS         # 拡張機能パス（カンマ区切り）
AGENT_BROWSER_PROVIDER           # クラウドブラウザプロバイダ
AGENT_BROWSER_STREAM_PORT        # WebSocketストリーミングポート
AGENT_BROWSER_HOME               # カスタムインストール場所
```
