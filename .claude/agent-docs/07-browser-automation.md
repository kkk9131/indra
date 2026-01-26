# indra - ブラウザ自動化

## 1. 概要

### agent-browserの選定理由

| ツール        | 特徴                   | 評価                 |
| ------------- | ---------------------- | -------------------- |
| agent-browser | Rust CLI + Node daemon | 採用: 高速、LLM不要  |
| browser-use   | 自然言語でブラウザ操作 | 不採用: LLMコスト高  |
| Clawdbot内蔵  | 高機能ブラウザAPI      | 不採用: 統合コスト高 |

### ユースケース

- **SNS投稿**: X/noteへの自動投稿（承認後）
- **ニュース取得**: RSS非対応サイトからの情報収集
- **ログイン認証**: OAuth非対応サービスの操作

## 2. インストール・セットアップ

```bash
# グローバルインストール
npm install -g agent-browser

# ブラウザ（Chromium）のインストール
agent-browser install

# バージョン確認
agent-browser --version
```

## 3. 基本コマンド

| コマンド     | 説明                       | 例                                     |
| ------------ | -------------------------- | -------------------------------------- |
| `open`       | URLを開く                  | `agent-browser open https://x.com`     |
| `snapshot`   | アクセシビリティツリー取得 | `agent-browser snapshot --interactive` |
| `click`      | 要素をクリック             | `agent-browser click @e3`              |
| `fill`       | テキスト入力               | `agent-browser fill @e5 "投稿内容"`    |
| `screenshot` | スクリーンショット保存     | `agent-browser screenshot output.png`  |
| `close`      | ブラウザを閉じる           | `agent-browser close`                  |
| `scroll`     | スクロール                 | `agent-browser scroll down`            |
| `wait`       | 待機                       | `agent-browser wait 2000`              |

### 要素参照（@e形式）

`snapshot`コマンドで取得したアクセシビリティツリーの要素を`@e1`, `@e2`形式で参照:

```bash
# スナップショットを取得（インタラクティブモード）
agent-browser snapshot --interactive
# 出力例:
# @e1 [button] ログイン
# @e2 [textbox] ユーザー名
# @e3 [textbox] パスワード

# 要素を操作
agent-browser fill @e2 "username"
agent-browser fill @e3 "password"
agent-browser click @e1
```

## 4. Indraでの活用パターン

### SNS自動投稿フロー（X）

```typescript
import { execSync } from "child_process";

async function postToX(content: string): Promise<void> {
  // プロファイル付きでブラウザ起動
  execSync("agent-browser open https://x.com --profile x-account");

  // 投稿ボタンをクリック
  execSync('agent-browser click @e[aria-label="Post"]');

  // 投稿内容を入力
  execSync(`agent-browser fill @e[role="textbox"] "${content}"`);

  // 投稿ボタンをクリック
  execSync('agent-browser click @e[data-testid="tweetButton"]');

  // 完了待機
  execSync("agent-browser wait 2000");
}
```

### ニュース取得フロー

```typescript
async function scrapeNews(url: string): Promise<string> {
  execSync(`agent-browser open ${url}`);

  // スナップショットからテキスト抽出
  const snapshot = execSync("agent-browser snapshot --format json");
  const tree = JSON.parse(snapshot.toString());

  // 記事本文を抽出
  const articles = extractArticles(tree);

  execSync("agent-browser close");
  return articles;
}
```

### ログイン状態管理（プロファイル）

```bash
# 名前付きプロファイルでセッション永続化
agent-browser open https://x.com --profile my-x-account

# 同じプロファイルを再利用（ログイン状態維持）
agent-browser open https://x.com --profile my-x-account
```

## 5. API統合

### Node.jsラッパー

```typescript
import { spawn, execSync } from "child_process";

interface BrowserOptions {
  profile?: string;
  headless?: boolean;
}

class AgentBrowser {
  private options: BrowserOptions;

  constructor(options: BrowserOptions = {}) {
    this.options = options;
  }

  async open(url: string): Promise<void> {
    const args = ["open", url];
    if (this.options.profile) {
      args.push("--profile", this.options.profile);
    }
    if (this.options.headless) {
      args.push("--headless");
    }
    execSync(`agent-browser ${args.join(" ")}`);
  }

  async snapshot(): Promise<object> {
    const result = execSync("agent-browser snapshot --format json");
    return JSON.parse(result.toString());
  }

  async click(selector: string): Promise<void> {
    execSync(`agent-browser click ${selector}`);
  }

  async fill(selector: string, text: string): Promise<void> {
    execSync(`agent-browser fill ${selector} "${text}"`);
  }

  async screenshot(path: string): Promise<void> {
    execSync(`agent-browser screenshot ${path}`);
  }

  async close(): Promise<void> {
    execSync("agent-browser close");
  }
}
```

### エラーハンドリング

```typescript
async function safeExecute(command: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      return execSync(`agent-browser ${command}`).toString();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Max retries exceeded");
}
```

## 6. セッション・プロファイル管理

### 永続プロファイル

```bash
# プロファイルの保存場所
~/.agent-browser/profiles/

# プロファイル一覧
agent-browser profiles list

# プロファイル削除
agent-browser profiles delete my-profile
```

### 複数セッション

```bash
# セッションID指定で複数ブラウザ管理
agent-browser open https://x.com --session session-1
agent-browser open https://note.com --session session-2

# セッション指定で操作
agent-browser click @e1 --session session-1
```

## 7. ベストプラクティス

### 操作の基本パターン

1. **snapshot → ref(@e)で操作**: 常にsnapshotで現在の状態を確認してから操作
2. **待機条件の設定**: ページ遷移後は適切な待機を入れる
3. **エラー時のリトライ**: ネットワーク遅延を考慮したリトライ戦略

### 推奨フロー

```typescript
async function robustOperation() {
  // 1. ページを開く
  await browser.open(url);

  // 2. 読み込み待機
  await browser.wait(2000);

  // 3. スナップショットで状態確認
  const snapshot = await browser.snapshot();

  // 4. 要素の存在確認
  const target = findElement(snapshot, "button", "Submit");
  if (!target) {
    throw new Error("Target element not found");
  }

  // 5. 操作実行
  await browser.click(target.ref);

  // 6. 結果確認
  await browser.wait(1000);
  const result = await browser.snapshot();
  // 成功判定...
}
```

### 注意事項

- **レート制限**: SNSサービスのレート制限を遵守
- **利用規約**: 各サービスの利用規約を確認
- **承認フロー**: 自動投稿前に必ずユーザー承認を経由

## 8. 実装済みツール（src/tools/browser.ts）

### インポート

```typescript
import {
  browserOpen,
  browserSnapshot,
  browserClick,
  browserFill,
  browserGet,
  browserScreenshot,
  browserClose,
  // ...他のツール
} from "./tools/browser.js";
```

### 主要関数

| 関数                                    | 引数                           | 説明             |
| --------------------------------------- | ------------------------------ | ---------------- |
| `browserOpen(url, options?)`            | url: string                    | URLを開く        |
| `browserSnapshot(options?)`             | interactive?, compact?, depth? | AI向けツリー取得 |
| `browserClick(selector, options?)`      | selector: string               | 要素クリック     |
| `browserFill(selector, text, options?)` | selector, text                 | 入力欄に入力     |
| `browserType(selector, text, options?)` | selector, text                 | クリアせず入力   |
| `browserGet(what, selector?, options?)` | what: text\|url\|title等       | 情報取得         |
| `browserScreenshot(options?)`           | path?, fullPage?               | スクショ保存     |
| `browserEval(js, options?)`             | js: string                     | JS実行           |
| `browserClose(options?)`                | -                              | ブラウザ終了     |

### セッション管理

```typescript
// デフォルトセッション: "indra"
browserOpen("https://example.com"); // session=indra

// カスタムセッション
browserOpen("https://site1.com", { session: "agent1" });
browserOpen("https://site2.com", { session: "agent2" });
```

### 環境変数

- `AGENT_BROWSER_PATH`: agent-browserのパス（デフォルト: `~/.npm-global/bin/agent-browser`）

### 制限事項

- Apple Silicon (darwin-arm64) ではグローバルインストール版のみ動作
- pnpm/npmでローカルインストールしたバージョンは使用不可
