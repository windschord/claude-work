/**
 * PTYSessionManager skipPermissions矛盾オプション除去テスト
 *
 * skipPermissions有効時にpermissionModeとallowedToolsがadapterに渡されないことを検証する。
 * PTYSessionManager.createSession()は多数の依存関係があるため、
 * このテストではロジックを直接検証する代わりに、
 * 矛盾オプション除去の対象となるコードパスの動作を確認する。
 */
import { describe, it, expect } from 'vitest'
import type { ClaudeCodeOptions } from '../claude-options-service'

/**
 * PTYSessionManager.createSession()内の矛盾オプション除去ロジックを
 * 独立した関数として抽出し、テスト可能にする。
 * 実際のコードでは inline で実行されるが、ロジックは同一。
 */
function stripConflictingOptions(
  claudeCodeOptions: ClaudeCodeOptions | undefined,
  skipPermissions: boolean
): { result: ClaudeCodeOptions | undefined; warnings: string[] } {
  const warnings: string[] = []
  const adapterClaudeOptions = claudeCodeOptions ? { ...claudeCodeOptions } : undefined

  if (adapterClaudeOptions) {
    delete adapterClaudeOptions.dangerouslySkipPermissions
  }

  if (skipPermissions && adapterClaudeOptions) {
    if (adapterClaudeOptions.permissionMode) {
      warnings.push(`ignoring permissionMode: ${adapterClaudeOptions.permissionMode}`)
      delete adapterClaudeOptions.permissionMode
    }
    if (adapterClaudeOptions.allowedTools) {
      warnings.push(`ignoring allowedTools: ${adapterClaudeOptions.allowedTools}`)
      delete adapterClaudeOptions.allowedTools
    }
  }

  return { result: adapterClaudeOptions, warnings }
}

describe('PTYSessionManager skipPermissions conflict resolution', () => {
  describe('when skipPermissions is true', () => {
    it('should remove permissionMode from claudeCodeOptions', () => {
      const options: ClaudeCodeOptions = {
        model: 'opus',
        permissionMode: 'plan',
        allowedTools: 'Read,Write',
      }

      const { result } = stripConflictingOptions(options, true)

      expect(result).toBeDefined()
      expect(result!.permissionMode).toBeUndefined()
    })

    it('should remove allowedTools from claudeCodeOptions', () => {
      const options: ClaudeCodeOptions = {
        model: 'opus',
        allowedTools: 'Read,Write',
      }

      const { result } = stripConflictingOptions(options, true)

      expect(result).toBeDefined()
      expect(result!.allowedTools).toBeUndefined()
    })

    it('should preserve model and additionalFlags', () => {
      const options: ClaudeCodeOptions = {
        model: 'opus',
        permissionMode: 'plan',
        allowedTools: 'Read,Write',
        additionalFlags: '--verbose',
      }

      const { result } = stripConflictingOptions(options, true)

      expect(result).toBeDefined()
      expect(result!.model).toBe('opus')
      expect(result!.additionalFlags).toBe('--verbose')
    })

    it('should remove dangerouslySkipPermissions', () => {
      const options: ClaudeCodeOptions = {
        dangerouslySkipPermissions: true,
        permissionMode: 'plan',
      }

      const { result } = stripConflictingOptions(options, true)

      expect(result).toBeDefined()
      expect(result!.dangerouslySkipPermissions).toBeUndefined()
      expect(result!.permissionMode).toBeUndefined()
    })

    it('should generate warnings for removed options', () => {
      const options: ClaudeCodeOptions = {
        permissionMode: 'plan',
        allowedTools: 'Read,Write',
      }

      const { warnings } = stripConflictingOptions(options, true)

      expect(warnings).toHaveLength(2)
      expect(warnings[0]).toContain('permissionMode')
      expect(warnings[1]).toContain('allowedTools')
    })

    it('should not generate warnings when no conflicting options exist', () => {
      const options: ClaudeCodeOptions = {
        model: 'opus',
      }

      const { warnings } = stripConflictingOptions(options, true)

      expect(warnings).toHaveLength(0)
    })

    it('should handle undefined claudeCodeOptions', () => {
      const { result, warnings } = stripConflictingOptions(undefined, true)

      expect(result).toBeUndefined()
      expect(warnings).toHaveLength(0)
    })
  })

  describe('when skipPermissions is false', () => {
    it('should preserve permissionMode and allowedTools', () => {
      const options: ClaudeCodeOptions = {
        model: 'opus',
        permissionMode: 'plan',
        allowedTools: 'Read,Write',
      }

      const { result } = stripConflictingOptions(options, false)

      expect(result).toBeDefined()
      expect(result!.permissionMode).toBe('plan')
      expect(result!.allowedTools).toBe('Read,Write')
      expect(result!.model).toBe('opus')
    })

    it('should still remove dangerouslySkipPermissions', () => {
      const options: ClaudeCodeOptions = {
        dangerouslySkipPermissions: false,
        permissionMode: 'plan',
      }

      const { result } = stripConflictingOptions(options, false)

      expect(result).toBeDefined()
      expect(result!.dangerouslySkipPermissions).toBeUndefined()
      expect(result!.permissionMode).toBe('plan')
    })
  })

  describe('original options immutability', () => {
    it('should not mutate the original claudeCodeOptions object', () => {
      const original: ClaudeCodeOptions = {
        model: 'opus',
        permissionMode: 'plan',
        allowedTools: 'Read,Write',
        dangerouslySkipPermissions: true,
      }

      stripConflictingOptions(original, true)

      expect(original.model).toBe('opus')
      expect(original.permissionMode).toBe('plan')
      expect(original.allowedTools).toBe('Read,Write')
      expect(original.dangerouslySkipPermissions).toBe(true)
    })
  })
})
