import { describe, it, expect, vi, beforeEach } from 'vitest';

// loggerをモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { IptablesManager } from '../iptables-manager';

describe('IptablesManager', () => {
  let mockExecFileAsync: ReturnType<typeof vi.fn>;
  let manager: IptablesManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileAsync = vi.fn();
    // 依存性注入でモック関数を渡す
    manager = new IptablesManager(mockExecFileAsync);
  });

  // ============================================================
  // checkAvailability
  // ============================================================
  describe('checkAvailability', () => {
    it('iptablesが利用可能な場合trueを返す', async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: 'iptables v1.8.7', stderr: '' });

      const result = await manager.checkAvailability();

      expect(result).toBe(true);
      expect(mockExecFileAsync).toHaveBeenCalledWith('iptables', ['--version']);
    });

    it('iptablesが利用不可な場合falseを返す', async () => {
      mockExecFileAsync.mockRejectedValue(new Error('iptables: command not found'));

      const result = await manager.checkAvailability();

      expect(result).toBe(false);
    });
  });

  // ============================================================
  // setupFilterChain
  // ============================================================
  describe('setupFilterChain', () => {
    it('正しいiptablesコマンドが生成される', async () => {
      // listActiveChains用のiptables -L -n出力（該当チェインなし）
      mockExecFileAsync
        .mockResolvedValueOnce({ stdout: 'Chain INPUT\nChain FORWARD\nChain OUTPUT\n', stderr: '' }) // -L -n
        .mockResolvedValue({ stdout: '', stderr: '' }); // その後の全コマンド

      const resolvedRules = [
        { ips: ['192.168.1.1'], port: 443, description: 'test' },
      ];

      await manager.setupFilterChain('abcdef12-3456-7890', resolvedRules, '172.17.0.0/16');

      // iptables-restore が呼ばれることを確認
      const calls = mockExecFileAsync.mock.calls;
      const restoreCall = calls.find(
        (call: unknown[]) =>
          call[0] === 'iptables-restore' &&
          Array.isArray(call[1]) &&
          call[1].includes('--noflush')
      );
      expect(restoreCall).toBeDefined();

      // iptables-restoreに渡されるルールにチェイン名が含まれる
      const restoreOptions = restoreCall![2] as { input?: string };
      expect(restoreOptions?.input).toContain('CWFILTER-abcdef12');
    });

    it('既存チェインがある場合は削除してから再作成（冪等性）', async () => {
      // listActiveChains用の出力（CWFILTER-abcdef12が存在）
      const iptablesListOutput =
        'Chain INPUT (policy ACCEPT)\nChain CWFILTER-abcdef12 (0 references)\nChain OUTPUT\n';
      mockExecFileAsync
        .mockResolvedValueOnce({ stdout: iptablesListOutput, stderr: '' }) // -L -n
        .mockResolvedValue({ stdout: '', stderr: '' }); // その他コマンド

      const resolvedRules = [{ ips: ['10.0.0.1'], port: 80 }];

      await manager.setupFilterChain('abcdef12-xxxx', resolvedRules, '172.17.0.0/16');

      const calls = mockExecFileAsync.mock.calls;

      // removeFilterChain内の削除コマンド（-F）が含まれることを確認
      const flushCall = calls.find(
        (call: unknown[]) =>
          call[0] === 'iptables' &&
          Array.isArray(call[1]) &&
          call[1].includes('-F')
      );
      expect(flushCall).toBeDefined();

      // deleteChainコマンド（-X）も含まれることを確認
      const deleteChainCall = calls.find(
        (call: unknown[]) =>
          call[0] === 'iptables' &&
          Array.isArray(call[1]) &&
          call[1].includes('-X')
      );
      expect(deleteChainCall).toBeDefined();

      // その後 iptables-restore が呼ばれることを確認
      const restoreCall = calls.find(
        (call: unknown[]) =>
          call[0] === 'iptables-restore' &&
          Array.isArray(call[1]) &&
          call[1].includes('--noflush')
      );
      expect(restoreCall).toBeDefined();
    });
  });

  // ============================================================
  // removeFilterChain
  // ============================================================
  describe('removeFilterChain', () => {
    it('チェイン削除コマンドが正しく生成される', async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });

      await manager.removeFilterChain('abcdef12-3456');

      const calls = mockExecFileAsync.mock.calls;
      const chainName = 'CWFILTER-abcdef12';

      // DOCKER-USERからのジャンプルール削除
      const deleteJumpCall = calls.find(
        (call: unknown[]) =>
          call[0] === 'iptables' &&
          Array.isArray(call[1]) &&
          call[1].includes('-D') &&
          call[1].includes('DOCKER-USER') &&
          call[1].includes(chainName)
      );
      expect(deleteJumpCall).toBeDefined();

      // チェイン内ルール全削除
      const flushCall = calls.find(
        (call: unknown[]) =>
          call[0] === 'iptables' &&
          Array.isArray(call[1]) &&
          call[1].includes('-F') &&
          call[1].includes(chainName)
      );
      expect(flushCall).toBeDefined();

      // チェイン削除
      const deleteChainCall = calls.find(
        (call: unknown[]) =>
          call[0] === 'iptables' &&
          Array.isArray(call[1]) &&
          call[1].includes('-X') &&
          call[1].includes(chainName)
      );
      expect(deleteChainCall).toBeDefined();
    });

    it('チェインが存在しない場合はエラーを抑制する', async () => {
      const noChainError = new Error('iptables: No chain/target/match by that name');
      mockExecFileAsync.mockRejectedValue(noChainError);

      // エラーがスローされないことを確認
      await expect(manager.removeFilterChain('notexist-xxxx')).resolves.not.toThrow();
    });
  });

  // ============================================================
  // generateIptablesRules
  // ============================================================
  describe('generateIptablesRules', () => {
    it('iptables-restore形式のルール文字列を生成する', () => {
      const chainName = 'CWFILTER-a1b2c3d4';
      const resolvedRules = [
        { ips: ['192.168.1.1'], port: 443 },
      ];
      const containerSubnet = '172.17.0.0/16';

      const result = manager.generateIptablesRules(chainName, resolvedRules, containerSubnet);

      expect(result).toContain('*filter');
      expect(result).toContain(`:${chainName}`);
      expect(result).toContain('-I DOCKER-USER');
      expect(result).toContain(`-s ${containerSubnet}`);
      expect(result).toContain(`-j ${chainName}`);
      expect(result).toContain('-p udp --dport 53 -j ACCEPT');
      expect(result).toContain('-p tcp --dport 53 -j ACCEPT');
      expect(result).toContain('--ctstate ESTABLISHED,RELATED -j ACCEPT');
      expect(result).toContain(`-d 192.168.1.1 -p tcp --dport 443 -j ACCEPT`);
      expect(result).toContain(`-A ${chainName} -j DROP`);
      expect(result).toContain('COMMIT');
    });

    it('ポート指定なしのルールが全ポート許可になる', () => {
      const chainName = 'CWFILTER-a1b2c3d4';
      const resolvedRules = [
        { ips: ['10.0.0.1'], port: null },
      ];
      const containerSubnet = '172.17.0.0/16';

      const result = manager.generateIptablesRules(chainName, resolvedRules, containerSubnet);

      // ポート指定なし: -d <ip> -j ACCEPT（プロトコル・ポートなし）
      expect(result).toContain('-d 10.0.0.1 -j ACCEPT');
      // ポート番号が含まれないことを確認
      expect(result).not.toContain('-d 10.0.0.1 -p tcp --dport');
    });

    it('CIDR形式のルールが正しく処理される', () => {
      const chainName = 'CWFILTER-a1b2c3d4';
      const resolvedRules = [
        { ips: ['104.18.0.0/16', '140.82.112.0/20'], port: 443 },
      ];
      const containerSubnet = '172.17.0.0/16';

      const result = manager.generateIptablesRules(chainName, resolvedRules, containerSubnet);

      expect(result).toContain('-d 104.18.0.0/16 -p tcp --dport 443 -j ACCEPT');
      expect(result).toContain('-d 140.82.112.0/20 -p tcp --dport 443 -j ACCEPT');
    });

    it('ルール0件のときはデフォルトDROPのみになる', () => {
      const chainName = 'CWFILTER-a1b2c3d4';
      const resolvedRules: Array<{ ips: string[]; port: number | null }> = [];
      const containerSubnet = '172.17.0.0/16';

      const result = manager.generateIptablesRules(chainName, resolvedRules, containerSubnet);

      // DNS・conntrack・DROPは含まれる
      expect(result).toContain('-p udp --dport 53 -j ACCEPT');
      expect(result).toContain(`-A ${chainName} -j DROP`);
      // ホワイトリストルールは含まれない
      expect(result).not.toContain(' -d ');
    });
  });

  // ============================================================
  // cleanupOrphanedChains
  // ============================================================
  describe('cleanupOrphanedChains', () => {
    it('CWFILTER-プレフィックスのチェインを検出・削除する', async () => {
      const iptablesListOutput = [
        'Chain INPUT (policy ACCEPT)',
        'Chain FORWARD (policy ACCEPT)',
        'Chain OUTPUT (policy ACCEPT)',
        'Chain CWFILTER-aabbccdd (0 references)',
        'Chain CWFILTER-11223344 (0 references)',
        'Chain DOCKER (1 references)',
      ].join('\n');

      mockExecFileAsync
        .mockResolvedValueOnce({ stdout: iptablesListOutput, stderr: '' }) // iptables -L -n
        .mockResolvedValue({ stdout: '', stderr: '' }); // 削除コマンド群

      await manager.cleanupOrphanedChains();

      const calls = mockExecFileAsync.mock.calls;

      // CWFILTER-aabbccdd の削除コマンドが呼ばれる
      const flushAabb = calls.find(
        (call: unknown[]) =>
          call[0] === 'iptables' &&
          Array.isArray(call[1]) &&
          call[1].includes('-F') &&
          call[1].includes('CWFILTER-aabbccdd')
      );
      expect(flushAabb).toBeDefined();

      // CWFILTER-11223344 の削除コマンドも呼ばれる
      const flush1122 = calls.find(
        (call: unknown[]) =>
          call[0] === 'iptables' &&
          Array.isArray(call[1]) &&
          call[1].includes('-F') &&
          call[1].includes('CWFILTER-11223344')
      );
      expect(flush1122).toBeDefined();
    });

    it('CWFILTER-プレフィックスのチェインが存在しない場合は何もしない', async () => {
      const iptablesListOutput = [
        'Chain INPUT (policy ACCEPT)',
        'Chain FORWARD (policy ACCEPT)',
        'Chain OUTPUT (policy ACCEPT)',
      ].join('\n');

      mockExecFileAsync.mockResolvedValue({ stdout: iptablesListOutput, stderr: '' });

      await manager.cleanupOrphanedChains();

      // iptables -L -n の呼び出し以外は行われない
      const nonListCalls = mockExecFileAsync.mock.calls.filter(
        (call: unknown[]) =>
          !(call[0] === 'iptables' && Array.isArray(call[1]) && call[1].includes('-L'))
      );
      expect(nonListCalls.length).toBe(0);
    });
  });

  // ============================================================
  // listActiveChains
  // ============================================================
  describe('listActiveChains', () => {
    it('アクティブなCWFILTERチェインの一覧を返す', async () => {
      const iptablesListOutput = [
        'Chain INPUT (policy ACCEPT)',
        'Chain CWFILTER-aabbccdd (3 references)',
        'Chain CWFILTER-11223344 (0 references)',
        'Chain OUTPUT (policy ACCEPT)',
      ].join('\n');

      mockExecFileAsync.mockResolvedValue({ stdout: iptablesListOutput, stderr: '' });

      const result = await manager.listActiveChains();

      expect(result).toHaveLength(2);
      expect(result[0].chainName).toBe('CWFILTER-aabbccdd');
      expect(result[0].envIdPrefix).toBe('aabbccdd');
      expect(result[1].chainName).toBe('CWFILTER-11223344');
      expect(result[1].envIdPrefix).toBe('11223344');
    });
  });
});
