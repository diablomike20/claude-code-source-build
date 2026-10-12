/** Reconstructed manual Dream skill (the recovered sourcemap omits dream.ts).
 * Uses the same consolidation prompt as the existing autoDream service.
 * This is a real in-process bundled skill, not a no-op export placeholder.
 */
import { getOriginalCwd } from '../../bootstrap/state.js'
import { getAutoMemPath, isAutoMemoryEnabled } from '../../memdir/paths.js'
import { buildConsolidationPrompt } from '../../services/autoDream/consolidationPrompt.js'
import { getProjectDir } from '../../utils/sessionStorage.js'
import { registerBundledSkill } from '../bundledSkills.js'

export function registerDreamSkill(): void {
  registerBundledSkill({
    name: 'dream',
    description: 'Consolidate recent session lessons into organized persistent project memory.',
    whenToUse: 'When the user explicitly asks to consolidate, review, or clean up project memory.',
    userInvocable: true,
    isEnabled: isAutoMemoryEnabled,
    async getPromptForCommand(args) {
      const memoryRoot = getAutoMemPath()
      const transcriptDir = getProjectDir(getOriginalCwd())
      return [{ type: 'text', text: buildConsolidationPrompt(memoryRoot, transcriptDir, args.trim()) }]
    },
  })
}
