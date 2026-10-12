import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {restoreDonorSource, auditOptionalModules, DONOR_ALLOWLIST} from '../donor-source.mjs';

function fixture() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-donor-test-'));
  const donor = path.join(temp, 'donor', 'src');
  const workspace = path.join(temp, 'workspace');
  for (const f of DONOR_ALLOWLIST) {
    const p = path.join(donor, f.slice(4));
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, '// original source: ' + f + '\nexport const fromDonor = true;\n');
  }
  fs.mkdirSync(workspace);
  return {temp, donor, workspace, clean: () => fs.rmSync(temp, {recursive:true, force:true})};
}

test('restores only reviewed donor originals with immutable provenance', () => {
  const f = fixture();
  try {
    const report = restoreDonorSource(f.workspace, f.donor);
    assert.equal(report.status, 'pinned-donor-applied');
    assert.equal(report.imported.length, DONOR_ALLOWLIST.length);
    assert.ok(report.imported.every(x => /^[a-f0-9]{64}$/.test(x.sha256)));
    assert.equal(restoreDonorSource(f.workspace, f.donor).imported.length, 0);
    assert.equal(restoreDonorSource(f.workspace, f.donor).preserved.length, DONOR_ALLOWLIST.length);
  } finally { f.clean(); }
});

test('preserves real recovered code, replaces only AUTO-STUB and shadow stub', () => {
  const f = fixture();
  try {
    const existing = path.join(f.workspace, 'src/types/message.ts');
    fs.mkdirSync(path.dirname(existing), {recursive:true});
    fs.writeFileSync(existing, '// actual recovered type\n');
    const stub = path.join(f.workspace, 'src/constants/querySource.ts');
    fs.mkdirSync(path.dirname(stub), {recursive:true});
    fs.writeFileSync(stub, '// AUTO-STUB: dummy\n');
    fs.writeFileSync(stub.slice(0, -3) + '.js', '// AUTO-STUB: shadow\n');
    const report = restoreDonorSource(f.workspace, f.donor);
    assert.ok(report.preserved.includes('src/types/message.ts'));
    assert.equal(fs.readFileSync(existing, 'utf8'), '// actual recovered type\n');
    assert.ok(fs.readFileSync(stub, 'utf8').includes('fromDonor'));
    assert.equal(fs.existsSync(stub.slice(0, -3) + '.js'), false);
  } finally { f.clean(); }
});

test('fails closed if an expected donor original is missing', () => {
  const f = fixture();
  try {
    fs.unlinkSync(path.join(f.donor, 'types/message.ts'));
    assert.throws(() => restoreDonorSource(f.workspace, f.donor), /Pinned donor source missing/);
  } finally { f.clean(); }
});

test('compatibility module is not mistaken for functional source', () => {
  const f = fixture();
  try {
    const p = path.join(f.workspace,'src/proactive/index.js');
    fs.mkdirSync(path.dirname(p),{recursive:true});
    fs.writeFileSync(p,'// JARVIS-RECONSTRUCTED: compatibility\n');
    const a = auditOptionalModules(f.workspace);
    assert.equal(a['PROACTIVE/KAIROS'].status, 'partial-or-unavailable');
    assert.equal(a['PROACTIVE/KAIROS'].modules[0].state, 'compatibility-fallback-not-full-featured');
    assert.equal(a['HISTORY_SNIP'].status, 'partial-or-unavailable');
  } finally { f.clean(); }
});
