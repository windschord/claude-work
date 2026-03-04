# 要件定義書: Issue #195 - ワイルドカードドメイン解決の改善

## 概要

**Issue**: #195
**タイトル**: ネットワークフィルタリング: ワイルドカードドメイン解決が不完全
**優先度**: Medium
**ステータス**: TODO

## 問題の背景

現在のネットワークフィルタリング機能において、`*.github.com` のようなワイルドカードルールを設定した場合、
`COMMON_SUBDOMAINS` に定義された8個のサブドメインのDNS解決しか行われない。
対象はwww/api/raw/gist/cdn/static/assets/mediaのみである。

実際にGitHub操作に必要なエンドポイントである `codeload.github.com`（リリースzipダウンロード）や
`objects.githubusercontent.com`（Gitオブジェクト転送）などが解決されず、フィルタリング適用時に
これらへのアクセスがブロックされる可能性がある。

## ユーザーストーリー

### US-195-01: サービス固有サブドメインの解決

**As** Dockerコンテナ環境でGitHub連携を行う開発者
**I want** `*.github.com` をワイルドカードルールとして設定した際に、codeload.github.com等の実際に使われるサブドメインも許可されるようにしたい
**So that** GitHubのすべての機能が期待通り動作すること

**受入基準**:
- `*.github.com` ルールが設定された場合、`COMMON_SUBDOMAINS` に加えてGitHub固有サブドメイン（codeload, objects, pkg, ghcr, copilot-proxy）もDNS解決される
- `*.githubusercontent.com` ルールが設定された場合、githubusercontent固有サブドメイン（raw, objects, avatars, user-images, camo）もDNS解決される
- `*.npmjs.org` / `*.npmjs.com` ルールが設定された場合、registry サブドメインもDNS解決される
- 未知のドメインに対しては、従来通り `COMMON_SUBDOMAINS` のみで解決が試みられる

### US-195-02: 既知サービスのCIDRブロック追加

**As** Dockerコンテナ環境でGitHub連携を行う開発者
**I want** `*.github.com` を指定した際にGitHubが公開しているIPレンジ（CIDR）が自動的に許可ルールに含まれるようにしたい
**So that** DNS解決でカバーできないIPアドレスへのアクセスも確実に許可されること

**受入基準**:
- `*.github.com` ルールに対して、GitHubの既知CIDRブロック（140.82.112.0/20, 192.30.252.0/22, 185.199.108.0/22, 143.55.64.0/20）が解決済みIPリストに追加される
- `*.githubusercontent.com` ルールに対して、GitHub CDNのCIDRブロック（185.199.108.0/22）が追加される
- CIDRは既存の `ResolvedRule.ips` 配列に含まれ、iptables側でそのまま利用可能
- 未知のドメインに対してはCIDR追加は行われない

### US-195-03: UIでのワイルドカード制限の明示

**As** ClaudeWorkの管理者
**I want** ワイルドカードルール入力時に、DNS解決の制限と推奨するCIDR指定について情報を得たい
**So that** より確実なフィルタリング設定ができること

**受入基準**:
- ワイルドカードドメインを入力した際のヘルプテキストに、DNS解決の制限について記載される
- より確実なフィルタリングにはCIDR形式の使用が推奨されることが明示される

## 非機能要件

### 信頼性

- 既知CIDRの情報はコード内にハードコードし、外部依存なしで動作すること
- サービス固有サブドメインのDNS解決が失敗しても、全体のルール解決処理が中断しないこと

### 保守性

- `KNOWN_SERVICE_CIDRS` と `SERVICE_SPECIFIC_SUBDOMAINS` は定数として定義し、将来の追加・変更が容易であること

### パフォーマンス

- 追加のDNS解決は既存の `resolveWithCache` メカニズムを通じて行われ、重複解決を避けること

## 関連ドキュメント

- [ネットワークフィルタリング設計書](../../design/network-filtering/index.md)
- [ネットワークフィルタリングタスク](../../tasks/network-filtering/index.md)
- GitHub公式IPレンジ情報: https://api.github.com/meta
