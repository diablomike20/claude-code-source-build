import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Files present in the user's original claude-code/main but absent from
// source-build/master. Do not import payment or unaudited web-auth/PTY code.
export const DONOR_SHA = '6ee4529f1f62631c70c948b6e654ba95668d0c6e';
export const DONOR_REPOSITORY = 'diablomike20/claude-code';
export const DONOR_ALLOWLIST = Object.freeze([
  'src/bridge/stub.ts',
  'src/constants/querySource.ts',
  'src/query/transitions.ts',
  'src/shims/bun-bundle.ts',
  'src/shims/macro.ts',
  'src/shims/preload.ts',
  'src/types/bun-bundle.d.ts',
  'src/types/bun-globals.d.ts',
  'src/types/macro.d.ts',
  'src/types/message.ts',
]);

const MODULE_GROUPS = Object.freeze([
  ['PROACTIVE/KAIROS', ['src/proactive/index', 'src/services/sessionTranscript/sessionTranscript']],
  ['EXPERIMENTAL_SKILL_SEARCH prefetch', ['src/services/skillSearch/prefetch']],
  ['HISTORY_SNIP', ['src/services/compact/snipProjection', 'src/services/compact/snipCompact']],
  ['CONTEXT_COLLAPSE', ['src/services/contextCollapse/index']],
  ['REACTIVE_COMPACT', ['src/services/compact/reactiveCompact']],
  ['CACHED_MICROCOMPACT', ['src/services/compact/cachedMicrocompact']],
]);

function locateExistingFile(base, relative) {
  return ['.ts', '.tsx', '.mjs', '.js'].map(ext => path.join(base, relative + ext))
    .find(p => fs.existsSync(p) && fs.statSync(p).isFile());
}

function isStubCode(contents) {
  return /^\/\/ (?:AUTO-STUB:|JARVIS-RECONSTRUCTED:)/.test(contents);
}

function checkNoSymlinks(root, candidate) {
  const base = path.resolve(root);
  const relative = path.relative(base, path.resolve(candidate));
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Donor path escaped expected root');
  }
  let cursor = base;
  for (const part of relative.split(path.sep)) {
    cursor = path.join(cursor, part);
    try {
      if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error('Donor source contains symlink');
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}

/**
 * Import only explicitly allowlisted originals from an externally SHA-verified
 * pinned checkout. Never clobber real source. Runs before AUTO-STUB generation.
 */
export function restoreDonorSource(workspaceRoot, donorSrcRoot) {
  if (!donorSrcRoot) return {status: 'not-configured', repository: DONOR_REPOSITORY,
    commit: DONOR_SHA, imported: [], preserved: [], reviewedAllowlist: DONOR_ALLOWLIST};
  const root = path.resolve(donorSrcRoot);
  if (!fs.statSync(root).isDirectory()) throw new Error('Donor src root missing');
  const imported = [], preserved = [];
  for (const fullRelative of DONOR_ALLOWLIST) {
    const relative = fullRelative.slice('src/'.length);
    const source = path.join(root, relative);
    checkNoSymlinks(root, source);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      throw new Error('Pinned donor source missing: ' + fullRelative);
    }
    const destination = path.join(workspaceRoot, fullRelative);
    checkNoSymlinks(workspaceRoot, destination);
    const existing = fs.existsSync(destination) && fs.statSync(destination).isFile();
    if (existing && !isStubCode(fs.readFileSync(destination, 'utf8'))) {
      preserved.push(fullRelative);
      continue;
    }
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    const content = fs.readFileSync(source);
    fs.writeFileSync(destination, content);
    // Prior AUTO-STUB .js could otherwise shadow recovered donor .ts source.
    if (fullRelative.endsWith('.ts')) {
      const shadowJs = destination.slice(0, -3) + '.js';
      if (shadowJs !== destination && fs.existsSync(shadowJs) &&
          isStubCode(fs.readFileSync(shadowJs, 'utf8'))) fs.unlinkSync(shadowJs);
    }
    imported.push({path: fullRelative, sha256: createHash('sha256').update(content).digest('hex')});
  }
  return {status: 'pinned-donor-applied', repository: DONOR_REPOSITORY,
    commit: DONOR_SHA, imported, preserved, reviewedAllowlist: DONOR_ALLOWLIST};
}

/** Stub compatibility MUST NEVER be reported as fully implemented. */
export function auditOptionalModules(workspaceRoot) {
  return Object.fromEntries(MODULE_GROUPS.map(([feature, modules]) => {
    const detail = modules.map(relative => {
      const file = locateExistingFile(workspaceRoot, relative);
      if (!file) return {module: relative, state: 'missing'};
      const body = fs.readFileSync(file, 'utf8');
      return {module: relative, state: body.startsWith('// AUTO-STUB:') ? 'generated-stub' :
        body.startsWith('// JARVIS-RECONSTRUCTED:') ? 'compatibility-fallback-not-full-featured' :
        body.startsWith('// JARVIS-IMPLEMENTED:') ? 'local-reimplementation-not-original-runtime-test-required' :
        'source-present-runtime-not-proven'};
    });
    const fullySourced = detail.every(x => x.state === 'source-present-runtime-not-proven');
    const implementedLocally = detail.every(x => x.state === 'local-reimplementation-not-original-runtime-test-required');
    return [feature, {status: fullySourced ? 'source-present-runtime-not-proven' :
      implementedLocally ? 'local-reimplementation-not-original' : 'partial-or-unavailable', modules: detail}];
  }));
}
