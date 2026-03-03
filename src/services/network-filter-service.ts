import { db, schema } from '@/lib/db';
import type { NetworkFilterConfig, NetworkFilterRule } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

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
  originalRule: NetworkFilterRule;
  resolvedIps: string[];
}

export interface TestResult {
  allowed: boolean;
  matchedRule?: NetworkFilterRule;
}

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

  // ==================== スタブ（後続タスクで実装） ====================

  /**
   * ドメイン名を含むルールをDNS解決し、IPアドレスに変換する
   * TASK-004で実装予定
   */
  async resolveDomains(_rules: NetworkFilterRule[]): Promise<ResolvedRule[]> {
    throw new Error('Not implemented: resolveDomains は TASK-004 で実装されます');
  }

  /**
   * コンテナ起動時にフィルタリングを適用する
   * TASK-005で実装予定
   */
  async applyFilter(_environmentId: string, _containerSubnet: string): Promise<void> {
    throw new Error('Not implemented: applyFilter は TASK-005 で実装されます');
  }

  /**
   * フィルタリングルールをクリーンアップする
   * TASK-005で実装予定
   */
  async removeFilter(_environmentId: string): Promise<void> {
    throw new Error('Not implemented: removeFilter は TASK-005 で実装されます');
  }

  /**
   * 指定した宛先への通信が許可/ブロックされるかをdry-runで判定する
   * TASK-004で実装予定
   */
  async testConnection(_environmentId: string, _target: string, _port?: number): Promise<TestResult> {
    throw new Error('Not implemented: testConnection は TASK-004 で実装されます');
  }

  /**
   * アプリケーション起動時に孤立したiptablesルールをクリーンアップする
   * TASK-012で実装予定
   */
  async cleanupOrphanedRules(): Promise<void> {
    throw new Error('Not implemented: cleanupOrphanedRules は TASK-012 で実装されます');
  }
}

/**
 * シングルトンインスタンス
 */
export const networkFilterService = new NetworkFilterService();
