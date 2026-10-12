// JARVIS-IMPLEMENTED: deterministic skill metadata retrieval, no paid service.
const STOP = new Set([
  'a','az','és','vagy','egy','ezt','ennek','ami','hogy','hogyan','kell','nekem','meg','van','lesz','ezzel','kérlek','legyen','azt','tudsz','szeretnék','csinálj','csinalj','készíts','keress','tedd','with','the','and','for','from','into','how','what','make','please','using','use','can','you','this','that','are','your','have','need','want','create','some','about','then','them','also','like','should','would','could'
]);
const MAX_CANDIDATES = 5;
const MAX_QUERY_CHARS = 10000;
const MAX_DESCRIPTION = 480;

export function words(value) {
  if (typeof value !== 'string') return [];
  return (value.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
    .filter(x => !STOP.has(x) && !/^\d+$/.test(x));
}

export function textFromInput(input) {
  if (typeof input === 'string') return input.slice(0, MAX_QUERY_CHARS);
  if (!Array.isArray(input)) return '';
  return input.filter(v => v && typeof v === 'object' && v.type === 'text' && typeof v.text === 'string')
    .map(v => v.text).join(' ').slice(0, MAX_QUERY_CHARS);
}

export function readLatestUserText(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= Math.max(0, messages.length - 24); i--) {
    const msg = messages[i];
    if (msg?.type === 'user' && msg.message && !msg.isMeta) {
      const text = textFromInput(msg.message.content);
      if (text.trim()) return text;
    }
  }
  return '';
}

export function hasWritePivot(messages) {
  if (!Array.isArray(messages)) return false;
  const start = Math.max(0, messages.length - 14);
  for (let i = messages.length - 1; i >= start; i--) {
    const msg = messages[i];
    if (msg?.type !== 'assistant' || !Array.isArray(msg.message?.content)) continue;
    if (msg.message.content.some(block =>
      block?.type === 'tool_use' && ['Write', 'Edit', 'NotebookEdit', 'MultiEdit'].includes(block.name)
    )) return true;
  }
  return false;
}

// Each item is metadata for an already loaded and model-invocable Command.
// Merely discovering a skill does NOT execute or load its instructions.
export function rankSkills(query, commands, alreadyDiscovered = new Set(), limit = MAX_CANDIDATES) {
  const original = String(query ?? '').slice(0, MAX_QUERY_CHARS).normalize('NFKC').toLowerCase();
  const terms = [...new Set(words(original))].slice(0, 64);
  if (terms.length === 0 || !Array.isArray(commands)) return [];
  const found = [];
  for (const cmd of commands.slice(0, 2000)) {
    if (!cmd || typeof cmd.name !== 'string' || !cmd.name.trim() ||
        cmd.type !== 'prompt' || cmd.disableModelInvocation === true ||
        cmd.isEnabled === false || (typeof cmd.isEnabled === 'function' && !cmd.isEnabled())) continue;
    if (alreadyDiscovered?.has(cmd.name)) continue;
    const name = cmd.name.toLowerCase().replace(/[._/:-]+/g, ' ');
    const description = [cmd.description, cmd.whenToUse].filter(x => typeof x === 'string').join(' ').toLowerCase();
    const nameTokens = new Set(words(name));
    const descTokens = new Set(words(description));
    let score = 0;
    const namePhrase = name.trim();
    if (namePhrase.length > 2 && original.includes(namePhrase)) score += 8;
    for (const term of terms) {
      if (nameTokens.has(term)) score += 5;
      else if ([...nameTokens].some(t => t.startsWith(term) || (term.length >= 5 && term.startsWith(t)))) score += 3;
      if (descTokens.has(term)) score += 2;
    }
    const exactCount = terms.filter(t => descTokens.has(t) || nameTokens.has(t)).length;
    if (exactCount > 1) score += Math.min(5, exactCount);
    if (score >= 5 && exactCount > 0) found.push({cmd, score});
  }
  found.sort((a,b)=> b.score - a.score || a.cmd.name.localeCompare(b.cmd.name));
  return found.slice(0, Math.max(0, Math.min(MAX_CANDIDATES, limit))).map(({cmd}) => ({
    name: cmd.name,
    description: String(cmd.description || cmd.whenToUse || '').slice(0, MAX_DESCRIPTION),
  }));
}
