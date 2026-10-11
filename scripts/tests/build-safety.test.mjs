// Execute exactly the builder's extraction validation without running a build.
// This is not a reimplementation: VM evaluates the function from build-cli.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fs.readFileSync(new URL('../build-cli.mjs', import.meta.url), 'utf8');
const begin = script.indexOf('function validatedWorkspaceDestination(');
const end = script.indexOf('function prepareWorkspace(', begin);
assert(begin >= 0 && end > begin, 'builder extraction guard must exist');
const implementation = script.slice(begin, end);

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-source-map-test-'));
  const verify = vm.runInNewContext(implementation + '\nvalidatedWorkspaceDestination', {
    fs, path, workspaceRoot: dir,
  });
  return {dir, verify, close: () => fs.rmSync(dir, {recursive: true, force: true})};
}

test('valid nested source-map paths stay inside workspace', () => {
  const env = fixture();
  try {
    assert.equal(env.verify('src/utils/sample.ts'), path.join(env.dir, 'src', 'utils', 'sample.ts'));
  } finally { env.close(); }
});

test('parent traversal, absolute paths and drive paths fail closed', () => {
  const env = fixture();
  try {
    for (const dangerous of [
      '../sibling', 'src/../../escape', '/etc/passwd',
      'C:\\Windows\\System32\\drivers\\etc\\hosts',
      '..\\\\outside', './', '', '..', 'src\\\\..\\\\x',
    ]) {
      assert.throws(() => env.verify(dangerous), /Unsafe|escaped|symlink/);
    }
  } finally { env.close(); }
});

test('existing symlinks in extraction path are rejected', t => {
  const env = fixture();
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-extract-target-'));
  try {
    try {
      fs.symlinkSync(external, path.join(env.dir, 'escape'), 'dir');
    } catch (e) {
      if (e.code === 'EPERM' || e.code === 'EACCES') { t.skip('symlink permission unavailable'); return; }
      throw e;
    }
    assert.throws(() => env.verify('escape/file.ts'), /symlink/);
  } finally { env.close(); fs.rmSync(external, {recursive: true, force: true}); }
});

test('cache validates content SHA-256 instead of only size and mtime', () => {
  assert.match(script, /marker\.sourceMapSha256 === sourceMapSha256/);
  assert.match(script, /sourceMapSha256,\s*version:/);
  assert.match(script, /createHash\('sha256'\)\.update\(sourceMapBytes\)/);
});
