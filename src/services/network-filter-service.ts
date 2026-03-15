import { db, schema } from '@/lib/db';
import type { NetworkFilterConfig, NetworkFilterRule } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { ProxyClient } from '@/services/proxy-client';
// ==================== エラークラス ====================

/**
 * バリデーションエラー
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ==================== 入出力型定義 ====================

export interface CreateRuleInput {
  target: string;
  port?: number | null;
  description?: string;
}

export interface UpdateRuleInput {
  target?: string;
  port?: number | null;
  description?: string;
  enabled?: boolean;
}

export interface DefaultTemplate {
  category: string;
  rules: { target: string; port: number; description: string }[];
}

export interface TestResult {
  allowed: boolean;
  matchedRule?: {
    id: string;
    target: string;
    port: number | null;
    description?: string;
  };
  /** 結果の注記 */
  note: string;
  /** proxyの稼働状態（フィルタリング有効時のみ設定） */
  proxyStatus?: 'running' | 'not_running';
}

// ==================== デフォルトテンプレート ====================

const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    category: 'Anthropic API',
    rules: [
      { target: 'api.anthropic.com', port: 443, description: 'Claude API' },
      { target: 'statsig.anthropic.com', port: 443, description: 'Claude telemetry' },
      { target: 'sentry.io', port: 443, description: 'Error reporting' },
      { target: '*.sentry.io', port: 443, description: 'Error reporting' },
      { target: 'platform.claude.com', port: 443, description: 'Claude authentication' },
    ],
  },
  {
    category: 'npm',
    rules: [
      { target: '*.npmjs.org', port: 443, description: 'npm registry' },
      { target: '*.npmjs.com', port: 443, description: 'npm registry' },
    ],
  },
  {
    category: 'GitHub',
    rules: [
      { target: 'github.com', port: 443, description: 'GitHub' },
      { target: '*.github.com', port: 443, description: 'GitHub' },
      { target: '*.githubusercontent.com', port: 443, description: 'GitHub content' },
    ],
  },
  {
    category: 'PyPI',
    rules: [
      { target: 'pypi.org', port: 443, description: 'Python Package Index' },
      { target: '*.pythonhosted.org', port: 443, description: 'PyPI packages' },
    ],
  },
  {
    category: 'Docker Hub',
    rules: [
      { target: '*.docker.io', port: 443, description: 'Docker Hub' },
      { target: '*.docker.com', port: 443, description: 'Docker Hub' },
    ],
  },
];

// ==================== バリデーション正規表現 ====================

/**
 * IPv4アドレスのパターン
 */
const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;

/**
 * IPv4 CIDRのパターン
 */
const IPV4_CIDR_PATTERN = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

/**
 * IPv6アドレスのパターン（簡易版）
 */
const IPV6_PATTERN = /^[0-9a-fA-F:]+$/;

/**
 * ワイルドカードドメインのパターン（*.example.com 形式）
 */
const WILDCARD_DOMAIN_PATTERN = /^\*\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

/**
 * 通常のドメイン名のパターン（RFC準拠）
 */
const DOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

// ==================== サービスクラス ====================

/**
 * NetworkFilterService
 *
 * ネットワークフィルタリングルールのCRUD管理、
 * フィルタリング設定の管理を担当する
 */
export class NetworkFilterService {

  // ==================== ターゲット正規化 ====================

  /**
   * ターゲット文字列を正規化する（trim + ドメインは小文字化）
   * IPv4/CIDRはそのまま、ドメイン系は小文字化して保存の一貫性を保つ
   */
  private normalizeTarget(target: string): string {
    const t = target.trim();
    if (IPV4_PATTERN.test(t) || IPV4_CIDR_PATTERN.test(t)) return t;
    return t.toLowerCase();
  }

  // ==================== ルールCRUD ====================

  /**
   * 指定環境のフィルタリングルール一覧を取得する
   * @param environmentId - 環境ID
   * @returns ルール一覧
   */
  async getRules(environmentId: string): Promise<NetworkFilterRule[]> {
    const rules = db.select()
      .from(schema.networkFilterRules)
      .where(eq(schema.networkFilterRules.environment_id, environmentId))
      .all();

    return rules;
  }

  /**
   * 新しいフィルタリングルールを作成する
   * @param environmentId - 環境ID
   * @param input - ルール作成入力
   * @returns 作成されたルール
   * @throws ValidationError targetまたはportの形式が不正な場合
   */
  async createRule(environmentId: string, input: CreateRuleInput): Promise<NetworkFilterRule> {
    const normalizedTarget = this.normalizeTarget(input.target);

    if (!this.validateTarget(normalizedTarget)) {
      throw new ValidationError(`不正なターゲット形式: ${input.target}`);
    }

    if (input.port !== undefined && input.port !== null && !this.validatePort(input.port)) {
      throw new ValidationError(`不正なポート番号: ${input.port}（1-65535の範囲で指定してください）`);
    }

    logger.info('ネットワークフィルタリングルールを作成中', { environmentId, target: normalizedTarget });

    const rule = db.insert(schema.networkFilterRules)
      .values({
        environment_id: environmentId,
        target: normalizedTarget,
        port: input.port ?? null,
        description: input.description,
        enabled: true,
      })
      .returning()
      .get();

    if (!rule) {
      throw new Error('ルールの作成に失敗しました');
    }

    logger.info('ネットワークフィルタリングルールを作成しました', { ruleId: rule.id, target: rule.target });

    return rule;
  }

  /**
   * 既存ルールを更新する
   * @param ruleId - ルールID
   * @param input - ルール更新入力
   * @returns 更新されたルール
   * @throws ValidationError targetまたはportの形式が不正な場合
   */
  async updateRule(ruleId: string, input: UpdateRuleInput): Promise<NetworkFilterRule> {
    const normalizedTarget = input.target !== undefined ? this.normalizeTarget(input.target) : undefined;

    if (normalizedTarget !== undefined && !this.validateTarget(normalizedTarget)) {
      throw new ValidationError(`不正なターゲット形式: ${input.target}`);
    }

    if (input.port !== undefined && input.port !== null && !this.validatePort(input.port)) {
      throw new ValidationError(`不正なポート番号: ${input.port}（1-65535の範囲で指定してください）`);
    }

    const updateData: Record<string, unknown> = { updated_at: new Date() };

    if (normalizedTarget !== undefined) updateData.target = normalizedTarget;
    if (input.port !== undefined) updateData.port = input.port;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    logger.info('ネットワークフィルタリングルールを更新中', { ruleId });

    const rule = db.update(schema.networkFilterRules)
      .set(updateData)
      .where(eq(schema.networkFilterRules.id, ruleId))
      .returning()
      .get();

    if (!rule) {
      throw new Error(`ルールが見つかりません: ${ruleId}`);
    }

    logger.info('ネットワークフィルタリングルールを更新しました', { ruleId });

    return rule;
  }

  /**
   * ルールを削除する
   * @param ruleId - ルールID
   */
  async deleteRule(ruleId: string): Promise<void> {
    logger.info('ネットワークフィルタリングルールを削除中', { ruleId });

    db.delete(schema.networkFilterRules)
      .where(eq(schema.networkFilterRules.id, ruleId))
      .run();

    logger.info('ネットワークフィルタリングルールを削除しました', { ruleId });
  }

  // ==================== Docker Compose環境対応 ====================

  /**
   * Docker Compose環境かどうかを検出する
   *
   * COMPOSE_PROJECT環境変数の存在で判定する。
   * Docker Composeで起動した場合、この変数にプロジェクト名が設定される。
   * 検出失敗時（変数未設定）はfalseを返し、スタンドアロンDockerと同じ方式にフォールバックする。
   *
   * @returns Docker Compose環境の場合true、それ以外はfalse
   */
  isDockerComposeEnvironment(): boolean {
    return !!process.env.COMPOSE_PROJECT;
  }

  /**
   * フィルタリング用ネットワーク名を生成する
   *
   * 既存のDocker Composeネットワークとの衝突を回避するため、
   * `claudework-filter-` プレフィックスに環境IDの先頭8文字を付与する。
   * これにより、環境ごとに一意なネットワーク名が生成される。
   *
   * @param environmentId - 環境ID
   * @returns フィルタリング用ネットワーク名（例: claudework-filter-abcdef12）
   */
  getFilterNetworkName(environmentId: string): string {
    return `claudework-filter-${environmentId.slice(0, 8)}`;
  }

  // ==================== フィルタリング設定 ====================

  /**
   * 環境のフィルタリング設定を取得する
   * @param environmentId - 環境ID
   * @returns フィルタリング設定、未設定時はnull
   */
  async getFilterConfig(environmentId: string): Promise<NetworkFilterConfig | null> {
    const config = db.select()
      .from(schema.networkFilterConfigs)
      .where(eq(schema.networkFilterConfigs.environment_id, environmentId))
      .get();

    return config ?? null;
  }

  /**
   * フィルタリングが有効かどうかを確認するヘルパーメソッド
   * @param environmentId - 環境ID
   * @returns フィルタリングが有効な場合true、設定が存在しないまたは無効な場合false
   */
  async isFilterEnabled(environmentId: string): Promise<boolean> {
    const config = await this.getFilterConfig(environmentId);
    return config !== null && config.enabled;
  }

  /**
   * フィルタリングの有効/無効を切り替える（upsert）
   * @param environmentId - 環境ID
   * @param enabled - 有効/無効
   * @returns 更新されたフィルタリング設定
   */
  async updateFilterConfig(environmentId: string, enabled: boolean): Promise<NetworkFilterConfig> {
    logger.info('フィルタリング設定を更新中', { environmentId, enabled });

    const config = db.insert(schema.networkFilterConfigs)
      .values({
        environment_id: environmentId,
        enabled,
      })
      .onConflictDoUpdate({
        target: schema.networkFilterConfigs.environment_id,
        set: {
          enabled,
          updated_at: new Date(),
        },
      })
      .returning()
      .get();

    if (!config) {
      throw new Error('フィルタリング設定の更新に失敗しました');
    }

    logger.info('フィルタリング設定を更新しました', { environmentId, enabled });

    return config;
  }

  // ==================== テンプレート ====================

  /**
   * デフォルトルールテンプレートを返す
   * @returns テンプレート一覧
   */
  getDefaultTemplates(): DefaultTemplate[] {
    return DEFAULT_TEMPLATES.map((template) => ({
      category: template.category,
      rules: template.rules.map((rule) => ({ ...rule })),
    }));
  }

  /**
   * テンプレートからルールを一括追加する（重複スキップ）
   * @param environmentId - 環境ID
   * @param ruleInputs - 追加するルール一覧
   * @returns 作成結果（作成数、スキップ数、作成されたルール）
   */
  async applyTemplates(
    environmentId: string,
    ruleInputs: CreateRuleInput[]
  ): Promise<{ created: number; skipped: number; rules: NetworkFilterRule[] }> {
    // 既存ルールを取得
    const existingRules = await this.getRules(environmentId);

    const createdRules: NetworkFilterRule[] = [];
    let skipped = 0;

    // 既存ルールのキーセット（同一リクエスト内の重複も検出するために使用）
    const seen = new Set(
      existingRules.map((r) => `${r.target}:${r.port ?? ''}`)
    );

    for (const input of ruleInputs) {
      const key = `${this.normalizeTarget(input.target)}:${input.port ?? ''}`;

      // 重複チェック（既存ルールおよび同一リクエスト内の重複）
      if (seen.has(key)) {
        logger.debug('重複ルールをスキップ', { target: input.target, port: input.port });
        skipped++;
        continue;
      }

      seen.add(key);
      const rule = await this.createRule(environmentId, input);
      createdRules.push(rule);
    }

    logger.info('テンプレートを適用しました', {
      environmentId,
      created: createdRules.length,
      skipped,
    });

    return {
      created: createdRules.length,
      skipped,
      rules: createdRules,
    };
  }

  // ==================== バリデーション ====================

  /**
   * ターゲット（ドメイン名、IPアドレス、ワイルドカード、CIDR）を検証する
   * @param target - 検証するターゲット文字列
   * @returns 有効な場合true
   */
  private validateTarget(target: string): boolean {
    if (!target || target.trim() === '') {
      return false;
    }

    // ワイルドカードドメイン（*.example.com）
    if (target.startsWith('*.')) {
      return WILDCARD_DOMAIN_PATTERN.test(target);
    }

    // IPv4 CIDR（192.168.0.0/24）
    if (IPV4_CIDR_PATTERN.test(target)) {
      const [ip, prefix] = target.split('/');
      return this.isValidIPv4(ip) && parseInt(prefix, 10) >= 0 && parseInt(prefix, 10) <= 32;
    }

    // IPv4アドレス
    if (IPV4_PATTERN.test(target)) {
      return this.isValidIPv4(target);
    }

    // IPv6アドレス（コロンを含む）: 未サポート（IPv4のみ対応）
    if (target.includes(':') && IPV6_PATTERN.test(target)) {
      return false;
    }

    // 通常のドメイン名
    return DOMAIN_PATTERN.test(target);
  }

  /**
   * IPv4アドレスの各オクテットが有効な範囲（0-255）かを検証する
   * @param ip - IPv4アドレス文字列
   * @returns 有効な場合true
   */
  private isValidIPv4(ip: string): boolean {
    const octets = ip.split('.');
    if (octets.length !== 4) return false;
    return octets.every((octet) => {
      const num = parseInt(octet, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  }

  /**
   * ポート番号を検証する
   * @param port - ポート番号（nullまたはundefinedの場合は有効）
   * @returns 有効な場合true
   */
  private validatePort(port: number | null | undefined): boolean {
    if (port === null || port === undefined) {
      return true;
    }
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  /**
   * 指定した宛先への通信が許可/ブロックされるかをルールマッチングで判定する（内部処理）
   *
   * @param environmentId - 環境ID
   * @param target - 通信先（正規化済みドメインまたはIP）
   * @param port - ポート番号（省略可）
   * @returns TestResult（noteを除く）
   */
  private async dryRunTest(
    environmentId: string,
    target: string,
    port?: number
  ): Promise<Omit<TestResult, 'note' | 'proxyStatus'>> {
    // ルール一覧を取得
    const rules = await this.getRules(environmentId);

    // 有効なルールのみでマッチング
    for (const rule of rules) {
      if (!rule.enabled) continue;

      // ターゲットのマッチング確認
      const targetMatches = this.matchesTarget(target, rule.target);
      if (!targetMatches) continue;

      // ポートのマッチング確認
      // ルールのportがnullの場合は全ポートを許可
      // ルールのportが指定されている場合はポートが一致する必要あり
      if (rule.port !== null && rule.port !== undefined) {
        if (port === undefined || port !== rule.port) continue;
      }

      // マッチするルールが見つかった（ホワイトリスト方式：マッチ = 許可）
      return {
        allowed: true,
        matchedRule: {
          id: rule.id,
          target: rule.target,
          port: rule.port,
          description: rule.description ?? undefined,
        },
      };
    }

    // マッチするルールなし = ブロック
    return { allowed: false };
  }

  /**
   * 指定した宛先への通信が許可/ブロックされるかを判定する
   *
   * フィルタリングが有効な場合はproxyのヘルスチェックを行い、
   * proxy稼働状態をproxyStatusとして返す。
   * proxy未稼働時は既存のルールマッチング（dry-run）にフォールバックする。
   *
   * @param environmentId - 環境ID
   * @param target - 通信先（ドメインまたはIP）
   * @param port - ポート番号（省略可）
   * @returns TestResult - 許可/ブロック結果とマッチしたルール情報
   */
  async testConnection(environmentId: string, target: string, port?: number): Promise<TestResult> {
    // 入力ターゲットを正規化
    const normalizedTarget = this.normalizeTarget(target);

    // フィルタリング設定を確認
    const config = await this.getFilterConfig(environmentId);

    // フィルタリングが無効、または設定がない場合は全て許可
    if (!config || !config.enabled) {
      return { allowed: true, note: 'フィルタリングが無効のため全て許可されます' };
    }

    // ルールマッチング（dry-run）を実行
    const dryRunResult = await this.dryRunTest(environmentId, normalizedTarget, port);

    // proxyのヘルスチェックを実行してproxy稼働状態を確認
    const proxyClient = new ProxyClient();
    try {
      await proxyClient.healthCheck();
      // proxy稼働中
      return {
        ...dryRunResult,
        proxyStatus: 'running',
        note: 'proxy稼働中。ルールマッチング結果です。実際のproxy通信制御はコンテナ起動時に適用されます。',
      };
    } catch {
      // proxy未稼働の場合はdry-runにフォールバック
      return {
        ...dryRunResult,
        proxyStatus: 'not_running',
        note: 'proxy未稼働のためdry-run結果です。実際の通信制御はproxy起動後にコンテナで適用されます。',
      };
    }
  }

  /**
   * 通信ターゲットがルールにマッチするかを判定する
   * @param target - 通信先（ドメインまたはIP）
   * @param ruleTarget - ルールのターゲット（ドメイン、ワイルドカード、IP、CIDR）
   * @returns マッチする場合true
   */
  private matchesTarget(target: string, ruleTarget: string): boolean {
    // ワイルドカードルール (*.example.com)
    if (ruleTarget.startsWith('*.')) {
      const baseDomain = ruleTarget.slice(2);
      // target が baseDomain 自体、またはそのサブドメインかを確認
      return target === baseDomain || target.endsWith(`.${baseDomain}`);
    }

    // CIDR ルール（IPv4アドレスが対象の場合）
    // isIPv4InCidr を呼ぶ前に target がIPv4アドレスであることを検証する（非IPv4文字列の誤判定を防ぐ）
    if (IPV4_CIDR_PATTERN.test(ruleTarget)) {
      return this.isValidIPv4(target) && this.isIPv4InCidr(target, ruleTarget);
    }

    // 完全一致（ドメインまたはIP）
    return target === ruleTarget;
  }

  /**
   * IPv4アドレスがCIDRブロックに含まれるかを判定する
   * @param ip - 判定するIPv4アドレス
   * @param cidr - CIDRブロック（例: 192.168.0.0/24）
   * @returns 含まれる場合true
   */
  private isIPv4InCidr(ip: string, cidr: string): boolean {
    const [network, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);
    const ipNum = this.ipToNumber(ip);
    const networkNum = this.ipToNumber(network);
    const mask = ~(2 ** (32 - prefix) - 1) >>> 0;
    return (ipNum & mask) === (networkNum & mask);
  }

  /**
   * IPv4アドレスを32ビット符号なし整数に変換する
   * @param ip - IPv4アドレス文字列
   * @returns 32ビット符号なし整数
   */
  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }
}

/**
 * シングルトンインスタンス
 */
export const networkFilterService = new NetworkFilterService();
