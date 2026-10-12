import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Run the actual production reactive module with mocked Claude dependencies;
// this tests the real module functions, not duplicated implementation.
const base=path.dirname(fileURLToPath(import.meta.url));
let source=fs.readFileSync(path.join(base,'../runtime/reactiveCompact.mjs'),'utf8');
const replacements=[
 ["import { compactConversation } from './compact.js';","const {compactConversation} = globalThis.__JARVIS_REACTIVE_TEST__;"],
 ["import { isAutoCompactEnabled } from './autoCompact.js';","const {isAutoCompactEnabled} = globalThis.__JARVIS_REACTIVE_TEST__;"],
 ["import { isPromptTooLongMessage } from '../api/errors.js';","const {isPromptTooLongMessage} = globalThis.__JARVIS_REACTIVE_TEST__;"],
];
for(const [from,to] of replacements){assert.ok(source.includes(from));source=source.replace(from,to);}
let enabled=true,fail=false,calls=[];
globalThis.__JARVIS_REACTIVE_TEST__={
 isAutoCompactEnabled:()=>enabled,
 isPromptTooLongMessage:msg=>msg.isApiErrorMessage===true&&msg.message?.content?.some(v=>v.type==='text'&&v.text.startsWith('Prompt is too long')),
 compactConversation:async (...args)=>{
  calls.push(args);
  if(fail) throw new Error('Provider unavailable');
  return {summaryMessages:[{type:'user',message:{content:'Conversation summary'}}],attachments:[],hookResults:[]};
 },
};
const rt=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const params=()=>({
 hasAttempted:false,
 aborted:false,
 querySource:'sdk',
 messages:[{type:'user',message:{content:'previous conversation'}}],
 cacheSafeParams:{toolUseContext:{abortController:{signal:{aborted:false}}},systemPrompt:'system'},
});
const err=()=>({type:'assistant',isApiErrorMessage:true,message:{content:[{type:'text',text:'Prompt is too long: 200000 tokens > 180000 maximum'}]}});

test('only actual API prompt overflow is withheld for real recovery',()=>{
 enabled=true;
 assert.equal(rt.isWithheldPromptTooLong(err()),true);
 assert.equal(rt.isWithheldPromptTooLong({type:'assistant',isApiErrorMessage:false}),false);
 assert.equal(rt.isWithheldMediaSizeError(err()),false);
});

test('uses original compactor with actual conversation, hooks and no truncation',async()=>{
 enabled=true;fail=false;calls=[];
 const p=params();
 const result=await rt.tryReactiveCompact(p);
 assert.equal(calls.length,1);
 assert.equal(calls[0][0],p.messages);
 assert.equal(calls[0][1],p.cacheSafeParams.toolUseContext);
 assert.equal(calls[0][2],p.cacheSafeParams);
 assert.deepEqual(calls[0].slice(3),[true,undefined,true]);
 assert.equal(result.summaryMessages[0].message.content,'Conversation summary');
});

test('user may disable automatic compaction, with no error suppression',async()=>{
 calls=[];enabled=false;
 assert.equal(rt.isReactiveCompactEnabled(),false);
 assert.equal(rt.isWithheldPromptTooLong(err()),false);
 assert.equal(await rt.tryReactiveCompact(params()),null);
 assert.equal(calls.length,0);
 enabled=true;
});

test('no retry loops on aborted, already-retried or compact-agent calls',async()=>{
 calls=[];
 for(const override of [
  {aborted:true}, {hasAttempted:true}, {querySource:'compact'}, {querySource:'session_memory'},
 ]) assert.equal(await rt.tryReactiveCompact({...params(),...override}),null);
 let p=params();p.cacheSafeParams.toolUseContext.abortController.signal.aborted=true;
 assert.equal(await rt.tryReactiveCompact(p),null);
 assert.equal(calls.length,0);
});

test('on unavailable provider, does not fabricate compaction success',async()=>{
 calls=[];fail=true;
 assert.equal(await rt.tryReactiveCompact(params()),null);
 assert.equal(calls.length,1);
 fail=false;
});
