# API設計: Registry Firewall API

## 概要

registry-firewallのヘルスステータス、ブロックログ、管理UIへのプロキシを提供するAPIエンドポイント群。

## 対応要件

REQ-008, REQ-009, REQ-010

## エンドポイント

### GET /api/registry-firewall/health

registry-firewallのヘルスステータスを返す。

**レスポンス (200)**:
```json
{
  "status": "healthy",
  "registries": ["npm", "pypi", "go", "cargo", "docker"],
  "version": "0.1.0"
}
```

**レスポンス (200, 停止時)**:
```json
{
  "status": "stopped"
}
```

### GET /api/registry-firewall/blocks

registry-firewallのブロックログを返す。

**クエリパラメータ**:
- `limit`: 取得件数 (デフォルト: 10, 最大: 100)

**レスポンス (200)**:
```json
{
  "blocks": [
    {
      "timestamp": "2026-03-15T10:30:00Z",
      "package_name": "evil-pkg",
      "registry": "npm",
      "reason": "OSV: GHSA-xxxx-yyyy-zzzz",
      "severity": "critical"
    }
  ],
  "total": 42
}
```

**レスポンス (503, registry-firewall停止時)**:
```json
{
  "error": "Registry firewall is not available"
}
```

### GET /api/registry-firewall/ui

registry-firewallの管理UIトップページへリダイレクト。

**レスポンス (302)**: Location: registry-firewallの`/ui`にリダイレクト

**実装方法**: Next.jsのrewrites設定でプロキシ

```typescript
// next.config.ts
async rewrites() {
  return [
    {
      source: '/api/registry-firewall/ui/:path*',
      destination: `${process.env.REGISTRY_FIREWALL_URL || 'http://registry-firewall:8080'}/ui/:path*`,
    },
  ];
}
```

## ファイル構成

```
src/app/api/registry-firewall/
├── health/
│   └── route.ts
└── blocks/
    └── route.ts
```

UIプロキシはnext.config.tsのrewritesで処理。
