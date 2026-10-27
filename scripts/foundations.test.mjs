import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv';
import {foundationReleases} from './build-foundations.mjs';
const built=foundationReleases(), manifests=built.releases.map(r=>JSON.parse(r.bytes));
const run=(node,inputs={},context={})=>new (Object.getPrototypeOf(async function(){}).constructor)('inputs','config','context',node.code)(inputs,{namespace:'synthetic'},context);
test('foundation releases preserve original pins, isolate general defaults and relocate stable logical identities',()=>{
  assert.equal(built.releases.length,37);assert.equal(built.migrations.length,29);
  for(const id of ['onf.core','onf.runtime','onf.types','onf.utilities','onf.logic']){
    const m=manifests.find(m=>m.id===id);
    assert(m.libraryMetadata.every(a=>['onf.core','onf.runtime','onf.types','onf.utilities','onf.logic'].includes(a.packId)));
    assert(!m.definitions.some(d=>/^Azure|^HubSpot|^Xero/.test(d.name)));
  }
  const logic=manifests.find(m=>m.id==='onf.logic');assert(logic.definitions.some(d=>d.id==='core.condition'));assert(logic.definitions.some(d=>d.name==='Boolean AND'));
  for(const m of manifests)for(const previous of m.libraryMigrations?.metadata||[]){const next=m.libraryMetadata.find(a=>a.definitionId===previous.definitionId);assert(next.revision>previous.revision);}
});
test('new queue schemas and executable bodies compile; every structured type has two codecs',()=>{
  const ajv=new Ajv({strict:false,validateFormats:false});
  for(const {definition:d}of built.added){if(d.kind==='type'){ajv.compile(d.schema);assert(built.latest.has(d.id+'.encode'));assert(built.latest.has(d.id+'.decode'));}else new (Object.getPrototypeOf(async function(){}).constructor)('inputs','config','context',d.code);}
});
test('logic handles strict value semantics and invalid ranges',async()=>{
  const n=id=>built.latest.get('logic.'+id);
  assert.deepEqual(await run(n('boolean.nand'),{a:true,b:true}),{value:false});
  assert.deepEqual(await run(n('boolean.nor'),{a:false,b:false}),{value:true});
  assert.deepEqual(await run(n('boolean.implies'),{premise:false,conclusion:false}),{value:true});
  assert.deepEqual(await run(n('boolean.majority'),{a:true,b:false,c:true}),{value:true});
  assert.deepEqual(await run(n('number.finite'),{value:'12'}),{finite:false});
  assert.deepEqual(await run(n('json.kind'),{value:null}),{kind:'null'});
  assert.deepEqual(await run(n('list.length-range'),{items:[1,2],minimum:2,maximum:2}),{passed:true});
  await assert.rejects(run(n('list.length-range'),{items:[],minimum:4,maximum:2}),/Invalid/);
  await assert.rejects(run(n('list.empty'),{items:Array(10001).fill(null)}),/10000/);
});
test('queue nodes call only bounded workspace storage transport and preserve failures',async()=>{
  for(const {definition:d}of built.added.filter(({definition:d})=>d.id.startsWith('runtime.queue.')&&!d.id.includes('.type.'))){
    const calls=[],emitted=[];const request={queue:'jobs'};const result=await run(d,{request},{storage:namespace=>({request:async(op,args)=>{calls.push({namespace,op,args});return null;}}),emit:x=>emitted.push(x)});
    assert.deepEqual(result,{result:null});assert.equal(calls[0].op,'workQueue.'+d.id.split('.').at(-1));assert.equal(calls[0].args,request);assert.equal(calls[0].namespace,'synthetic');assert.deepEqual(emitted,['next']);
    await assert.rejects(run(d,{request},{storage:()=>({request:async()=>{throw Error('Lease changed');}}),emit:()=>assert.fail('Must not emit on failure')}),/Lease changed/);
  }
});
test('queue object codecs preserve optional absence, null, nested config and empty claims',async()=>{
  const operation=built.latest.get('runtime.queue.enqueue');const requestType=operation.inputs.find(p=>p.id==='request').type;
  const encoded=await run(built.latest.get(requestType+'.encode'),{queue:'jobs',dedupKey:'a',payload:null});
  assert.deepEqual({...encoded.value},{queue:'jobs',dedupKey:'a',payload:null});assert(!Object.hasOwn(encoded.value,'availableAt'));
  const decoded=await run(built.latest.get(requestType+'.decode'),encoded);assert.deepEqual({...decoded},{...encoded.value});
  const claim=built.latest.get('runtime.queue.claim');const type=claim.outputs.find(p=>p.id==='result').type;
  assert.deepEqual(await run(built.latest.get(type+'.decode'),{value:null}),{found:false});
});
test('every current package has bounded original PNG artwork and repo-defined metadata',()=>{
  for(const r of built.releases){const path=new URL('../'+r.entry.config,import.meta.url);const c=JSON.parse(readFileSync(path));assert.equal(c.schemaVersion,1);assert(c.summary.length<=180);for(const field of ['logo','banner']){const b=readFileSync(new URL(c[field],path));assert.equal(b.subarray(1,4).toString(),'PNG');assert(b.length<1024*1024);}assert.equal(c.defaultPackage,['onf.core','onf.runtime','onf.types','onf.utilities','onf.logic'].includes(r.entry.id));}
});
