import test from 'node:test';
import assert from 'node:assert/strict';
import {words, textFromInput, readLatestUserText, hasWritePivot, rankSkills} from '../runtime/skillDiscoveryCore.mjs';

const sample = [
 {name:'security-review',description:'Audit code for security vulnerabilities, SQL injection and authentication bugs',type:'prompt',loadedFrom:'skills'},
 {name:'pdf',description:'Create or modify PDF documents and forms',type:'prompt',loadedFrom:'skills'},
 {name:'excel',description:'Spreadsheet budget formulas and charts',type:'prompt',loadedFrom:'skills'},
 {name:'internal-command',description:'Audit vulnerabilities',type:'local',loadedFrom:'builtin'},
 {name:'blocked-security',description:'Audit security vulnerabilities',type:'prompt',disableModelInvocation:true},
];

test('matches an actual eligible skill on description AND name', () => {
 const r = rankSkills('Please audit security vulnerabilities in login', sample);
 assert.equal(r[0]?.name,'security-review');
 assert.ok(r.every(x=>x.name!=='blocked-security'));
 assert.ok(r.every(x=>x.name!=='internal-command'));
});

test('matches descriptions without depending on a paid or remote model', () => {
 assert.equal(rankSkills('Build spreadsheet budget formulas', sample)[0]?.name,'excel');
 assert.equal(rankSkills('Create a PDF document', sample)[0]?.name,'pdf');
});

test('avoids irrelevant skill injection on generic prompts', () => {
 assert.deepEqual(rankSkills('Hello, how are you?',sample),[]);
 assert.deepEqual(rankSkills('',sample),[]);
 assert.deepEqual(rankSkills('!!',sample),[]);
});

test('user is not presented with disabled commands, or previous discoveries', () => {
 const enabled = [{...sample[0],isEnabled:()=>false}, sample[1]];
 assert.deepEqual(rankSkills('security vulnerabilities',enabled),[]);
 assert.deepEqual(rankSkills('create a PDF document',sample,new Set(['pdf'])),[]);
});

test('bound result size and avoid long user-provided skill descriptions', () => {
 const many=Array.from({length:40},(_,i)=>({name:'pdf'+i,description:'PDF documents '+('X'.repeat(1000)),type:'prompt'}));
 const r=rankSkills('PDF documents',many);
 assert.ok(r.length>0 && r.length<=5);
 assert.ok(r.every(x=>x.description.length<=480));
});

test('normalize accented Hungarian input and avoid command execution',()=>{
 assert.deepEqual(words('Készíts kérlek költségvetés táblázatot'),['költségvetés','táblázatot']);
 let invoked=0;
 const cmd={name:'költségvetés',description:'költségvetés táblázat',type:'prompt',call:()=>invoked++};
 assert.equal(rankSkills('Készíts költségvetés táblázatot',[cmd])[0]?.name,'költségvetés');
 assert.equal(invoked,0);
});

test('turn-zero text block extraction and latest human input',()=>{
 assert.equal(textFromInput([{type:'image',source:{}},{type:'text',text:'PDF form'}]),'PDF form');
 const messages=[{type:'user',message:{content:'old user request'}},{type:'assistant',message:{content:[]}},{type:'user',message:{content:'latest PDF request'},isMeta:false}];
 assert.equal(readLatestUserText(messages),'latest PDF request');
});

test('inter-turn prefetch gates on actual write pivots, not reads',()=>{
 const mk=name=>[{type:'assistant',message:{content:[{type:'tool_use',name,input:{}}]}}];
 assert.equal(hasWritePivot(mk('Read')),false);
 assert.equal(hasWritePivot(mk('Edit')),true);
 assert.equal(hasWritePivot(mk('Write')),true);
 assert.equal(hasWritePivot([]),false);
});
