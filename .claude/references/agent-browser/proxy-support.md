# Proxy Support

地理テスト、レート制限回避、企業環境向けプロキシ設定。

## 基本設定

```bash
# HTTPプロキシ
export HTTP_PROXY="http://proxy.example.com:8080"
agent-browser open https://example.com

# HTTPSプロキシ
export HTTPS_PROXY="https://proxy.example.com:8080"
agent-browser open https://example.com

# 両方
export HTTP_PROXY="http://proxy.example.com:8080"
export HTTPS_PROXY="http://proxy.example.com:8080"
agent-browser open https://example.com
```

## 認証付きプロキシ

```bash
export HTTP_PROXY="http://username:password@proxy.example.com:8080"
agent-browser open https://example.com
```

## SOCKSプロキシ

```bash
# SOCKS5
export ALL_PROXY="socks5://proxy.example.com:1080"
agent-browser open https://example.com

# SOCKS5 + 認証
export ALL_PROXY="socks5://user:pass@proxy.example.com:1080"
agent-browser open https://example.com
```

## プロキシバイパス

```bash
export NO_PROXY="localhost,127.0.0.1,.internal.company.com"
agent-browser open https://internal.company.com  # 直接接続
agent-browser open https://external.com          # プロキシ経由
```

## 一般的なユースケース

### 地域テスト

```bash
#!/bin/bash
PROXIES=(
    "http://us-proxy.example.com:8080"
    "http://eu-proxy.example.com:8080"
    "http://asia-proxy.example.com:8080"
)

for proxy in "${PROXIES[@]}"; do
    export HTTP_PROXY="$proxy"
    export HTTPS_PROXY="$proxy"

    region=$(echo "$proxy" | grep -oP '^\w+-\w+')
    echo "テスト中: $region"

    agent-browser --session "$region" open https://example.com
    agent-browser --session "$region" screenshot "./screenshots/$region.png"
    agent-browser --session "$region" close
done
```

### ローテーティングプロキシ

```bash
#!/bin/bash
PROXY_LIST=(
    "http://proxy1.example.com:8080"
    "http://proxy2.example.com:8080"
    "http://proxy3.example.com:8080"
)

URLS=(
    "https://site.com/page1"
    "https://site.com/page2"
    "https://site.com/page3"
)

for i in "${!URLS[@]}"; do
    proxy_index=$((i % ${#PROXY_LIST[@]}))
    export HTTP_PROXY="${PROXY_LIST[$proxy_index]}"
    export HTTPS_PROXY="${PROXY_LIST[$proxy_index]}"

    agent-browser open "${URLS[$i]}"
    agent-browser get text body > "output-$i.txt"
    agent-browser close

    sleep 1  # 礼儀正しく待機
done
```

### 企業ネットワーク

```bash
#!/bin/bash
export HTTP_PROXY="http://corpproxy.company.com:8080"
export HTTPS_PROXY="http://corpproxy.company.com:8080"
export NO_PROXY="localhost,127.0.0.1,.company.com"

# 外部サイトはプロキシ経由
agent-browser open https://external-vendor.com

# 内部サイトはプロキシバイパス
agent-browser open https://intranet.company.com
```

## プロキシ接続確認

```bash
agent-browser open https://httpbin.org/ip
agent-browser get text body
# プロキシのIP表示（自分の実IPではない）
```

## トラブルシューティング

### プロキシ接続失敗

```bash
# 先にプロキシ接続性を確認
curl -x http://proxy.example.com:8080 https://httpbin.org/ip

# 認証が必要か確認
export HTTP_PROXY="http://user:pass@proxy.example.com:8080"
```

### SSL/TLSエラー

一部プロキシはSSLインスペクションを行う:

```bash
# テスト用のみ - 本番非推奨
agent-browser open https://example.com --ignore-https-errors
```

### パフォーマンス低下

```bash
# 必要な時のみプロキシ使用
export NO_PROXY="*.cdn.com,*.static.com"  # CDN直接アクセス
```

## ベストプラクティス

1. **環境変数を使用**: プロキシ認証情報をハードコードしない
2. **NO_PROXYを適切に設定**: ローカルトラフィックをプロキシ経由にしない
3. **自動化前にプロキシをテスト**: シンプルなリクエストで接続確認
4. **プロキシ障害に対応**: 不安定なプロキシ用にリトライロジック
5. **大規模スクレイピングはプロキシローテーション**: 負荷分散とBAN回避
