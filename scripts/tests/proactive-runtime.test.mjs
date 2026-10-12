import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import test from 'node:test'

const builder = fs.readFileSync(new URL('../build-cli.mjs', import.meta.url), 'utf8')
const begin = builder.indexOf('function restoreJarvisProactiveRuntime() {')
const end = builder.indexOf('function patchJarvisCliUnhandledStartup()', begin)
assert.ok(begin >= 0 && end > begin, 'builder must preserve proactive recovery')

function fixture() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-proactive-'))
  const generated = path.join(workspaceRoot, 'src', 'proactive', 'index.js')
  const restore = vm.runInNewContext(
    builder.slice(begin, end) + '\nrestoreJarvisProactiveRuntime',
    {
      fs, path, workspaceRoot,
      isFile: p => fs.existsSync(p) && fs.statSync(p).isFile(),
    },
  )
  return {workspaceRoot, generated, restore,
    close: () => fs.rmSync(workspaceRoot, {recursive: true, force: true})}
}

test('missing proactive runtime reconstructs an opt-in finite-state controller', () => {
  const env = fixture()
  try {
    env.restore()
    const source = fs.readFileSync(env.generated, 'utf8')
    assert.match(source, /JARVIS-RECONSTRUCTED/)
    const runtime = vm.runInNewContext(
      source.replace(/^export /gm, '') +
      '\n({ isProactiveActive, isProactivePaused, activateProactive, deactivateProactive, pauseProactive, resumeProactive, setProactivePaused })',
    )
    assert.equal(runtime.isProactiveActive(), false)
    assert.equal(runtime.isProactivePaused(), false)
    runtime.activateProactive('command')
    assert.equal(runtime.isProactiveActive(), true)
    runtime.pauseProactive()
    assert.equal(runtime.isProactivePaused(), true)
    runtime.resumeProactive()
    assert.equal(runtime.isProactivePaused(), false)
    runtime.setProactivePaused(true)
    assert.equal(runtime.isProactivePaused(), true)
    runtime.deactivateProactive()
    assert.equal(runtime.isProactiveActive(), false)
    assert.equal(runtime.isProactivePaused(), false)
  } finally { env.close() }
})

test('recovered real modules must never be overwritten', () => {
  const env = fixture()
  try {
    fs.mkdirSync(path.dirname(env.generated), {recursive: true})
    const real = 'export function isProactiveActive() { return true }\n'
    fs.writeFileSync(env.generated, real)
    env.restore()
    assert.equal(fs.readFileSync(env.generated, 'utf8'), real)
  } finally { env.close() }
})

test('generated AUTO-STUB can be safely replaced', () => {
  const env = fixture()
  try {
    fs.mkdirSync(path.dirname(env.generated), {recursive: true})
    fs.writeFileSync(env.generated, '// AUTO-STUB: missing\n')
    env.restore()
    assert.match(fs.readFileSync(env.generated, 'utf8'), /JARVIS-RECONSTRUCTED/)
  } finally { env.close() }
})
