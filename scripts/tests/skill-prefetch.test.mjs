import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

// Load the REAL production prefetch module with only the two external
// Claude API imports replaced by controlled test doubles. No reimplementation
// of getTurnZeroSkillDiscovery/start/collect in the test code.
const base = path.dirname(fileURLToPath(import.meta.url));
const filename = path.join(base,'../runtime/skillPrefetch.mjs');
let code = fs.readFileSync(filename,'utf8');
const commandsImport = "import { getSkillToolCommands, getMcpSkillCommands } from '../../commands.js';";
const stateImport = "import { getProjectRoot } from '../../bootstrap/state.js';";
assert.ok(code.includes(commandsImport));
assert.ok(code.includes(stateImport));
code = code.replace(commandsImport, 'const {getSkillToolCommands,getMcpSkillCommands} = globalThis.__JARVIS_PREFETCH_TEST__;');
code = code.replace(stateImport, 'const {getProjectRoot} = globalThis.__JARVIS_PREFETCH_TEST__;');
code = code.replace("'./discoveryCore.js'", JSON.stringify(pathToFileURL(path.join(base,'../runtime/skillDiscoveryCore.mjs')).href));
let skills=[{name:'security-review',type:'prompt',description:'Audit security vulnerabilities in application authentication'}];
globalThis.__JARVIS_PREFETCH_TEST__={
 getSkillToolCommands:async () => skills,
 getMcpSkillCommands:commands => commands,
 getProjectRoot:()=>'/fixture',
};
const module = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

function context(){
 return {
  abortController:{signal:{aborted:false}},
  discoveredSkillNames:new Set(),
  getAppState:()=>({mcp:{commands:[]}}),
 };
}

test('turn-zero discovery returns a real model-visible skill_discovery attachment',async()=>{
 const ctx=context();
 const result=await module.getTurnZeroSkillDiscovery('Please audit security vulnerabilities',[],ctx);
 assert.equal(result.length,1);
 assert.equal(result[0].type,'skill_discovery');
 assert.equal(result[0].signal,'user_input');
 assert.equal(result[0].source,'native');
 assert.equal(result[0].skills[0].name,'security-review');
 assert.equal(ctx.discoveredSkillNames.has('security-review'),true);
});

test('prior discoveries are not injected twice during same turn',async()=>{
 const ctx=context();
 assert.equal((await module.getTurnZeroSkillDiscovery('audit security vulnerabilities',[],ctx)).length,1);
 assert.deepEqual(await module.getTurnZeroSkillDiscovery('audit security vulnerabilities',[],ctx),[]);
});

test('asynchronous prefetch starts only on write-pivot and can be collected once',async()=>{
 const ctx=context();
 const messages=[
  {type:'user',message:{content:'Audit security vulnerabilities'}},
  {type:'assistant',message:{content:[{type:'tool_use',name:'Write',input:{file_path:'app.ts'}}]}},
 ];
 assert.equal(module.startSkillDiscoveryPrefetch(null,[messages[0]],ctx),null);
 const pending=module.startSkillDiscoveryPrefetch(null,messages,ctx);
 assert.ok(pending?.promise instanceof Promise);
 const result=await module.collectSkillDiscoveryPrefetch(pending);
 assert.equal(result.length,1);
 assert.equal(result[0].signal,'assistant_turn');
 assert.deepEqual(await module.collectSkillDiscoveryPrefetch(pending),[]);
});

test('aborts and missing skill service never break main model query',async()=>{
 const ctx=context();
 ctx.abortController.signal.aborted=true;
 assert.deepEqual(await module.getTurnZeroSkillDiscovery('audit security vulnerabilities',[],ctx),[]);
 assert.equal(module.startSkillDiscoveryPrefetch(null,[{type:'assistant',message:{content:[{type:'tool_use',name:'Edit'}]}}],ctx),null);
 ctx.abortController.signal.aborted=false;
 const old = skills; skills=[];
 try{assert.deepEqual(await module.getTurnZeroSkillDiscovery('audit security vulnerabilities',[],ctx),[]);}
 finally{skills=old;}
});
