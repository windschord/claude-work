/**
 * ClaudeOptionsService.stripConflictingOptions テスト
 *
 * skipPermissions有効時にpermissionModeとallowedToolsが除去されることを検証する。
 * PTYSessionManager.createSession()内で呼び出される共通ロジック。
 */
import { describe, it, expect } from 'vitest'
import { ClaudeOptionsService } from '../claude-options-service'
import type { ClaudeCodeOptions } from '../claude-options-service'

describe('ClaudeOptionsService.stripConflictingOptions', () => {
  describe('when skipPermissions is true', () => {
    it('should remove permissionMode from claudeCodeOptions', () => {
      const options: ClaudeCodeOptions = {
        model: 'opus',
        permissionMode: 'plan',
        allowedTools: 'Read,Write',
      }

      const { result } = ClaudeOptionsService.stripConflictingOptions(options, true)

      expect(result).toBeDefined()
      expect(result!.permissionMode).toBeUndefined()
    })

    it('should remove allowedTools from claudeCodeOptions', () => {
      const options: ClaudeCodeOptions = {
        model: 'opus',
        allowedTools: 'Read,Write',
      }

      const { result } = ClaudeOptionsService.stripConflictingOptions(options, true)

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

      const { result } = ClaudeOptionsService.stripConflictingOptions(options, true)

      expect(result).toBeDefined()
      expect(result!.model).toBe('opus')
      expect(result!.additionalFlags).toBe('--verbose')
    })

    it('should remove dangerouslySkipPermissions', () => {
      const options: ClaudeCodeOptions = {
        dangerouslySkipPermissions: true,
        permissionMode: 'plan',
      }

      const { result } = ClaudeOptionsService.stripConflictingOptions(options, true)

      expect(result).toBeDefined()
      expect(result!.dangerouslySkipPermissions).toBeUndefined()
      expect(result!.permissionMode).toBeUndefined()
    })

    it('should generate warnings for removed options', () => {
      const options: ClaudeCodeOptions = {
        permissionMode: 'plan',
        allowedTools: 'Read,Write',
      }

      const { warnings } = ClaudeOptionsService.stripConflictingOptions(options, true)

      expect(warnings).toHaveLength(2)
      expect(warnings[0]).toContain('permissionMode')
      expect(warnings[1]).toContain('allowedTools')
    })

    it('should not generate warnings when no conflicting options exist', () => {
      const options: ClaudeCodeOptions = {
        model: 'opus',
      }

      const { warnings } = ClaudeOptionsService.stripConflictingOptions(options, true)

      expect(warnings).toHaveLength(0)
    })

    it('should handle undefined claudeCodeOptions', () => {
      const { result, warnings } = ClaudeOptionsService.stripConflictingOptions(undefined, true)

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

      const { result } = ClaudeOptionsService.stripConflictingOptions(options, false)

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

      const { result } = ClaudeOptionsService.stripConflictingOptions(options, false)

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

      ClaudeOptionsService.stripConflictingOptions(original, true)

      expect(original.model).toBe('opus')
      expect(original.permissionMode).toBe('plan')
      expect(original.allowedTools).toBe('Read,Write')
      expect(original.dangerouslySkipPermissions).toBe(true)
    })
  })
})
