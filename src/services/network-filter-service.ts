import { db, schema } from '@/lib/db';
import type { NetworkFilterConfig, NetworkFilterRule } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import dns from 'dns/promises';
import { IptablesManager, iptablesManager as defaultIptablesManager } from './iptables-manager';

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

/**
 * フィルタリング適用エラー
 */
export class FilterApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilterApplicationError';
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

export interface ResolvedRule {
  ips: string[];
  port: number | null;
  description?: string;
  originalTarget: string;
}

export interface TestResult {
  allowed: boolean;
  matchedRule?: {
    id: string;
    target: string;
    port: number | null;
    description?: string;
  };
}

// DNSキャッシュエントリの型
interface DnsCacheEntry {
  ips: string[];
  expiry: number;
}

// DNSキャッシュTTL: 5分（ミリ秒）
const DNS_CACHE_TTL_MS = 5 * 60 * 1000;

// ワイルドカードドメインで解決を試行する一般的なサブドメイン
const COMMON_SUBDOMAINS = ['www', 'api', 'raw', 'gist', 'cdn', 'static', 'assets', 'media'];

// ==================== デフォルトテンプレート ====================

const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    category: 'Anthropic API',
    rules: [
      { target: 'api.anthropic.com', port: 443, description: 'Claude API' },
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
 * ネットワークフィルタリングルールのCRUD管理、DNS解決、
 * フィルタリング適用のオーケストレーションを担当する
 */
export class NetworkFilterService {

  // ==================== IptablesManager ====================

  private readonly iptablesManager: IptablesManager;

  constructor(iptablesManagerInstance?: IptablesManager) {
    this.iptablesManager = iptablesManagerInstance ?? defaultIptablesManager;
  }

  // ==================== DNSキャッシュ ====================

  private dnsCache = new Map<string, DnsCacheEntry>();

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
    if (!this.validateTarget(input.target)) {
      throw new ValidationError(`不正なターゲット形式: ${input.target}`);
    }

    if (input.port !== undefined && input.port !== null && !this.validatePort(input.port)) {
      throw new ValidationError(`不正なポート番号: ${input.port}（1-65535の範囲で指定してください）`);
    }

    logger.info('ネットワークフィルタリングルールを作成中', { environmentId, target: input.target });

    const rule = db.insert(schema.networkFilterRules)
      .values({
        environment_id: environmentId,
        target: input.target,
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
    if (input.target !== undefined && !this.validateTarget(input.target)) {
      throw new ValidationError(`不正なターゲット形式: ${input.target}`);
    }

    if (input.port !== undefined && input.port !== null && !this.validatePort(input.port)) {
      throw new ValidationError(`不正なポート番号: ${input.port}（1-65535の範囲で指定してください）`);
    }

    const updateData: Record<string, unknown> = { updated_at: new Date() };

    if (input.target !== undefined) updateData.target = input.target;
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
    return DEFAULT_TEMPLATES;
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

    for (const input of ruleInputs) {
      // 重複チェック（target と port が一致するルールを検索）
      const isDuplicate = existingRules.some(
        (r) => r.target === input.target && r.port === (input.port ?? null)
      );

      if (isDuplicate) {
        logger.debug('重複ルールをスキップ', { target: input.target, port: input.port });
        skipped++;
        continue;
      }

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

    // IPv6アドレス（コロンを含む）
    if (target.includes(':') && IPV6_PATTERN.test(target)) {
      return this.isValidIPv6(target);
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
   * IPv6アドレスが有効な形式かを簡易検証する
   * @param ip - IPv6アドレス文字列
   * @returns 有効な場合true
   */
  private isValidIPv6(ip: string): boolean {
    // :: を含む場合の簡易チェック
    if (ip === '::' || ip === '::1') return true;

    const parts = ip.split(':');
    // ダブルコロン（::）を含む場合
    if (ip.includes('::')) {
      return parts.length <= 8;
    }
    return parts.length === 8 && parts.every(p => /^[0-9a-fA-F]{0,4}$/.test(p));
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

  // ==================== DNS解決 ====================

  /**
   * ドメイン名を含むルールをDNS解決し、IPアドレスに変換する
   * - IP/CIDR形式のルールはそのまま通過
   * - 通常ドメインはIPv4/IPv6で解決
   * - ワイルドカードはベースドメインと一般的なサブドメインを解決
   * - DNS解決失敗時は警告ログを出力してスキップ
   * @param rules - 解決対象のルール一覧
   * @returns IPアドレスに変換済みのルール
   */
  async resolveDomains(rules: NetworkFilterRule[]): Promise<ResolvedRule[]> {
    const resolved: ResolvedRule[] = [];

    for (const rule of rules) {
      const target = rule.target;

      // IPアドレスまたはCIDR形式はDNS解決不要
      if (this.isIpOrCidr(target)) {
        resolved.push({
          ips: [target],
          port: rule.port,
          description: rule.description ?? undefined,
          originalTarget: target,
        });
        continue;
      }

      // ワイルドカードドメインの処理
      if (target.startsWith('*.')) {
        const baseDomain = target.slice(2); // `*.`を除去
        const ips = await this.resolveWildcardDomain(baseDomain);

        if (ips.length === 0) {
          logger.warn('ワイルドカードドメインの解決に失敗しました', { target });
          continue;
        }

        resolved.push({
          ips,
          port: rule.port,
          description: rule.description ?? undefined,
          originalTarget: target,
        });
        continue;
      }

      // 通常ドメインの解決
      const ips = await this.resolveWithCache(target);

      if (ips.length === 0) {
        logger.warn('ドメインの解決に失敗しました', { target });
        continue;
      }

      resolved.push({
        ips,
        port: rule.port,
        description: rule.description ?? undefined,
        originalTarget: target,
      });
    }

    return resolved;
  }

  /**
   * 指定した宛先への通信が許可/ブロックされるかをdry-runで判定する
   * @param environmentId - 環境ID
   * @param target - 通信先（ドメインまたはIP）
   * @param port - ポート番号（省略可）
   * @returns TestResult - 許可/ブロック結果とマッチしたルール情報
   */
  async testConnection(environmentId: string, target: string, port?: number): Promise<TestResult> {
    // フィルタリング設定を確認
    const config = await this.getFilterConfig(environmentId);

    // フィルタリングが無効、または設定がない場合は全て許可
    if (!config || !config.enabled) {
      return { allowed: true };
    }

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

  // ==================== フィルタリング適用・クリーンアップ ====================

  /**
   * コンテナ起動時にフィルタリングを適用する
   *
   * 処理フロー:
   * 1. getFilterConfig(environmentId) でフィルタリング設定を確認
   * 2. 無効なら即座にreturn
   * 3. IptablesManager.checkAvailability() で利用可否チェック → 利用不可ならエラー
   * 4. getRules(environmentId) でルール取得（enabledのみフィルタ）
   * 5. resolveDomains(rules) でDNS解決
   * 6. IptablesManager.setupFilterChain(envId, resolvedRules, subnet) でiptables適用
   * 7. 失敗時は FilterApplicationError をスロー
   *
   * @param environmentId - 環境ID
   * @param containerSubnet - コンテナのサブネット（例: 172.18.0.0/16）
   * @throws FilterApplicationError iptablesが利用不可またはルール適用に失敗した場合
   */
  async applyFilter(environmentId: string, containerSubnet: string): Promise<void> {
    // 1. フィルタリング設定を確認
    const config = await this.getFilterConfig(environmentId);

    // 2. フィルタリングが無効または設定がない場合はスキップ
    if (!config || !config.enabled) {
      logger.debug('フィルタリングが無効のためスキップ', { environmentId });
      return;
    }

    logger.info('フィルタリングの適用を開始します', { environmentId, containerSubnet });

    // 3. iptables利用可否チェック
    const available = await this.iptablesManager.checkAvailability();
    if (!available) {
      const errorMessage = `iptablesが利用不可のためフィルタリングを適用できません: environmentId=${environmentId}`;
      logger.error('フィルタリング適用に失敗しました（iptables利用不可）', { environmentId });
      throw new FilterApplicationError(errorMessage);
    }

    try {
      // 4. ルール取得（enabledのもののみ）
      const allRules = await this.getRules(environmentId);
      const enabledRules = allRules.filter((r) => r.enabled);

      // 5. DNS解決
      const resolvedRules = await this.resolveDomains(enabledRules);

      // 6. iptables適用
      await this.iptablesManager.setupFilterChain(environmentId, resolvedRules, containerSubnet);

      logger.info('フィルタリングの適用が完了しました', {
        environmentId,
        ruleCount: enabledRules.length,
        resolvedCount: resolvedRules.length,
      });
    } catch (err) {
      if (err instanceof FilterApplicationError) {
        throw err;
      }
      const errorMessage = `フィルタリング適用中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`;
      logger.error('フィルタリング適用に失敗しました', {
        environmentId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new FilterApplicationError(errorMessage);
    }
  }

  /**
   * コンテナ停止時にフィルタリングルールをクリーンアップする
   *
   * 処理フロー:
   * 1. IptablesManager.removeFilterChain(envId) でクリーンアップ
   * 2. 失敗時は警告ログのみ（エラーにしない）
   *
   * @param environmentId - 環境ID
   */
  async removeFilter(environmentId: string): Promise<void> {
    logger.info('フィルタリングのクリーンアップを開始します', { environmentId });

    try {
      await this.iptablesManager.removeFilterChain(environmentId);
      logger.info('フィルタリングのクリーンアップが完了しました', { environmentId });
    } catch (err) {
      // クリーンアップ失敗は警告のみ（エラーにしない）
      logger.warn('フィルタリングのクリーンアップ中に問題が発生しました（無視します）', {
        environmentId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * アプリケーション起動時に孤立したiptablesルールをクリーンアップする
   * TASK-012で実装予定
   */
  async cleanupOrphanedRules(): Promise<void> {
    throw new Error('Not implemented: cleanupOrphanedRules は TASK-012 で実装されます');
  }

  // ==================== DNS内部ヘルパー ====================

  /**
   * ターゲット文字列がIPアドレスまたはCIDR形式かを判定する
   * @param target - 判定する文字列
   * @returns IPまたはCIDRの場合true
   */
  private isIpOrCidr(target: string): boolean {
    // CIDR形式
    if (IPV4_CIDR_PATTERN.test(target)) return true;
    // IPv4アドレス
    if (IPV4_PATTERN.test(target)) return true;
    // IPv6アドレス（コロンを含む）
    if (target.includes(':') && IPV6_PATTERN.test(target)) return true;
    return false;
  }

  /**
   * ワイルドカードドメインのベースドメインと一般的サブドメインを解決する
   * @param baseDomain - ベースドメイン（例: github.com）
   * @returns 解決されたIPアドレスの配列
   */
  private async resolveWildcardDomain(baseDomain: string): Promise<string[]> {
    const allIps = new Set<string>();

    // ベースドメインを解決
    const baseIps = await this.resolveWithCache(baseDomain);
    baseIps.forEach(ip => allIps.add(ip));

    // 一般的なサブドメインも解決を試行
    for (const subdomain of COMMON_SUBDOMAINS) {
      const fqdn = `${subdomain}.${baseDomain}`;
      const subIps = await this.resolveWithCache(fqdn);
      subIps.forEach(ip => allIps.add(ip));
    }

    return Array.from(allIps);
  }

  /**
   * DNSキャッシュを使ってドメインを解決する
   * キャッシュヒット時はDNS解決を再実行しない
   * TTL超過時はDNS解決を再実行する
   * @param domain - 解決するドメイン名
   * @returns 解決されたIPアドレスの配列（失敗時は空配列）
   */
  private async resolveWithCache(domain: string): Promise<string[]> {
    const now = Date.now();
    const cached = this.dnsCache.get(domain);

    // キャッシュヒット（TTL内）
    if (cached && cached.expiry > now) {
      return cached.ips;
    }

    // DNS解決
    const ips: string[] = [];

    try {
      const v4Addrs = await dns.resolve4(domain);
      ips.push(...v4Addrs);
    } catch {
      // IPv4解決失敗は無視（IPv6で補完される可能性）
    }

    try {
      const v6Addrs = await dns.resolve6(domain);
      ips.push(...v6Addrs);
    } catch {
      // IPv6解決失敗は無視
    }

    // 解決成功時はキャッシュに保存
    if (ips.length > 0) {
      this.dnsCache.set(domain, {
        ips,
        expiry: now + DNS_CACHE_TTL_MS,
      });
    }

    return ips;
  }

  /**
   * 期限切れキャッシュエントリを削除する
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [domain, entry] of this.dnsCache.entries()) {
      if (entry.expiry <= now) {
        this.dnsCache.delete(domain);
      }
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

    // 完全一致（ドメインまたはIP）
    return target === ruleTarget;
  }
}

/**
 * シングルトンインスタンス
 */
export const networkFilterService = new NetworkFilterService();
