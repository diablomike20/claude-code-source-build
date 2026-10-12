/** Reconstructed review/hunter skill.
 * The recovered CLI sourcemap omitted this private module; this implementation
 * supplies a real review workflow rather than a silent AUTO-STUB.
 */
import { registerBundledSkill } from '../bundledSkills.js'

export function registerHunterSkill(): void {
  registerBundledSkill({
    name: 'hunter',
    description: 'Investigate a suspected regression or defect, collect evidence and suggest a verified fix.',
    whenToUse: 'When a user explicitly requests a bug hunt, defect investigation, or systematic regression review.',
    argumentHint: '[problem or component]',
    userInvocable: true,
    async getPromptForCommand(args) {
      return [{ type: 'text', text: `# Defect hunt

Scope: ${args.trim() || 'Inspect the current project for reproducible defects.'}

1. Identify the affected behavior and expected outcome.
2. Find the responsible source files and tests; never report a speculative issue as confirmed.
3. Reproduce safely using the smallest deterministic test possible.
4. Record exact commands, errors, and files involved, with sensitive data redacted.
5. Propose a minimal fix, implement only when authorized, and run relevant regression checks.
6. Report confirmed findings, unverified hypotheses, and remaining risks separately.

Do not delete data, publish reports externally, or apply irreversible changes without user authorization.` }]
    },
  })
}
