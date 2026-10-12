// JARVIS-IMPLEMENTED: prompt-overflow reactive recovery backed by Claude's
// ORIGINAL compactConversation, not an empty compatibility stub.
// Media-specific image stripping is deliberately not claimed or enabled.
import { compactConversation } from './compact.js';
import { isAutoCompactEnabled } from './autoCompact.js';
import { isPromptTooLongMessage } from '../api/errors.js';

export function isReactiveCompactEnabled() {
  // Honor user settings DISABLE_COMPACT, DISABLE_AUTO_COMPACT and config.
  return isAutoCompactEnabled();
}

export function isWithheldPromptTooLong(message) {
  return Boolean(isReactiveCompactEnabled() &&
    message?.type === 'assistant' &&
    message.isApiErrorMessage &&
    isPromptTooLongMessage(message));
}

export function isWithheldMediaSizeError(_message) {
  // The original media-specific recovery code is not present. Returning true
  // without correct handling could silently swallow a real media error.
  return false;
}

export async function tryReactiveCompact(params) {
  if (!params || params.hasAttempted || params.aborted ||
      params.querySource === 'compact' ||
      params.querySource === 'session_memory' ||
      !isReactiveCompactEnabled() ||
      !Array.isArray(params.messages) || params.messages.length === 0 ||
      !params.cacheSafeParams?.toolUseContext) return null;
  const context = params.cacheSafeParams.toolUseContext;
  if (context.abortController?.signal?.aborted) return null;
  try {
    // Real summarization via the existing Claude compacting agent.
    // Never truncate raw conversation messages as a substitute.
    return await compactConversation(
      params.messages,
      context,
      params.cacheSafeParams,
      true,      // suppress interactive follow-up questions
      undefined, // preserve the canonical compaction prompt
      true,      // auto-compact hook semantics
    );
  } catch (error) {
    // Diagnostic only when explicitly enabled. Strip common secret/token
    // patterns and avoid dumping user messages, request bodies or headers.
    if (process.env.JARVIS_CLI_BOOT_TRACE === '1') {
      const type = error instanceof Error ? error.name : 'UnknownError';
      const raw = error instanceof Error ? String(error.message).slice(0, 180) : '';
      const safe = raw.replace(/(?:sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+|[A-Za-z0-9_-]{32,})/gi, '[REDACTED]');
      process.stderr.write('[JARVIS_REACTIVE_COMPACT_ERROR] ' + type + ' ' + safe + '\n');
    }
    // The original API 413 is surfaced by query.ts on failed recovery;
    // do not manufacture a successful compact or retry without a guard.
    return null;
  }
}
