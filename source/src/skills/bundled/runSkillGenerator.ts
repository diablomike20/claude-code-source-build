/** Reconstructed skill-generator entrypoint for maximum-feature builds.
 * The proprietary module is absent from recovered source; this is an actual
 * skill-definition workflow and must not be represented as the original one.
 */
import { registerBundledSkill } from '../bundledSkills.js'

export function registerRunSkillGeneratorSkill(): void {
  registerBundledSkill({
    name: 'run-skill-generator',
    description: 'Create and verify a reusable project-specific SKILL.md workflow from user requirements.',
    whenToUse: 'Use when the user requests generating, defining, or testing a reusable AI skill.',
    argumentHint: '<skill objective>',
    userInvocable: true,
    async getPromptForCommand(args) {
      const requirement = args.trim()
      return [{ type: 'text', text: `# Skill generator

User requirement: ${requirement || '(not provided)'}

If no requirement is supplied, ask for the skill objective instead of guessing.

1. Determine the precise intended input, tools, output and success checks.
2. Inspect the project for existing overlapping skills; prefer extending an existing implementation when appropriate.
3. Draft a SKILL.md with name, description, trigger criteria, instructions and concrete verification steps.
4. Save only in a location explicitly approved by the user. Never overwrite existing files without approval.
5. Validate links, commands, arguments, permissions and security-sensitive operations.
6. Test the skill on an innocuous example and state which capabilities were actually exercised.
7. Explain any original proprietary functionality that is unavailable; do not claim parity without evidence.

The resulting skill is a user-reviewable artifact; do not execute destructive actions as part of generation.` }]
    },
  })
}
