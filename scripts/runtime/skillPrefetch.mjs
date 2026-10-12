// JARVIS-IMPLEMENTED: real local skill discovery and asynchronous metadata prefetch.
// The original private AKI classifier is not available. This is a tested,
// deterministic alternative: search actual loaded skills without model/API calls.
import { getSkillToolCommands, getMcpSkillCommands } from '../../commands.js';
import { getProjectRoot } from '../../bootstrap/state.js';
import { rankSkills, readLatestUserText, hasWritePivot, textFromInput } from './discoveryCore.js';

async function discover(query, context, signal) {
  if (!query || context?.abortController?.signal?.aborted) return [];
  const local = await getSkillToolCommands(getProjectRoot());
  if (context?.abortController?.signal?.aborted) return [];
  let mcp = [];
  try {
    const commands = context?.getAppState?.()?.mcp?.commands;
    if (Array.isArray(commands)) mcp = getMcpSkillCommands(commands);
  } catch {
    // Local skills remain discoverable without an MCP state snapshot.
  }
  const known = context?.discoveredSkillNames instanceof Set
    ? context.discoveredSkillNames : new Set();
  const deduped = new Map();
  for (const cmd of [...local, ...mcp]) {
    if (!deduped.has(cmd.name)) deduped.set(cmd.name, cmd);
  }
  const matching = rankSkills(query, [...deduped.values()], known);
  if (matching.length === 0) return [];
  // Source 'native' means local metadata scoring, not proprietary AKI.
  const valid = matching.filter(x => !known.has(x.name));
  if (!valid.length) return [];
  for (const skill of valid) known.add(skill.name);
  return [{type:'skill_discovery', skills:valid, signal, source:'native'}];
}

export async function getTurnZeroSkillDiscovery(input, _messages, context) {
  try {
    return await discover(textFromInput(input), context, 'user_input');
  } catch {
    // Discovery is non-critical. Do not block the user's main request.
    return [];
  }
}

export function startSkillDiscoveryPrefetch(_input, messages, context) {
  if (!hasWritePivot(messages) || context?.abortController?.signal?.aborted) return null;
  const query = readLatestUserText(messages);
  if (!query) return null;
  const pending = {promise:null, settledAt:null, collected:false};
  pending.promise = discover(query, context, 'assistant_turn')
    .catch(() => [])
    .then(result => { pending.settledAt = Date.now(); return result; });
  return pending;
}

export async function collectSkillDiscoveryPrefetch(pending) {
  if (!pending || pending.collected) return [];
  pending.collected = true;
  try {
    const result = await pending.promise;
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}
