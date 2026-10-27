import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import {operationContracts} from '../src/builders/structural-overlay/devops/operations.mjs';
import {reviewedOperations} from '../src/builders/structural-overlay/cloud-infra/index.mjs';
import {structuralReleases} from './build-structural.mjs';
import {publicBaseline} from '../src/builders/structural-overlay/catalog.mjs';
const baseline=publicBaseline(), result=structuralReleases(), all=[...result.entries.values()];
const latest=new Map();for(const d of all)if(!latest.has(d.id)||latest.get(d.id).version<d.version)latest.set(d.id,d);
const changed=all.filter(d=>!baseline.retained.some(old=>old.id===d.id&&old.version===d.version));
const ajv=new Ajv({allErrors:true,strict:false,validateFormats:false}),validators=new Map();
function validate(schema,value){let validator=validators.get(schema);if(!validator){validator=ajv.compile(schema);validators.set(schema,validator);}return validator(value);}
const primitive={string:{type:'string'},number:{type:'number'},boolean:{type:'boolean'},any:{},object:{type:'object'},array:{type:'array'}};
function schemaFor(port){const schema=primitive[port.type]??result.entries.get(port.type+'@'+port.typeVersion)?.schema;assert(schema,'Exact type exists '+port.type+'@'+port.typeVersion);return schema;}
const run=(definition,inputs)=>new Function('inputs','config','context',definition.code)(inputs,{},{});
function checkPorts(ports,values,name){for(const port of ports.filter(p=>p.type!=='control')){if(port.required)assert(Object.hasOwn(values,port.id),name+' required '+port.id);if(Object.hasOwn(values,port.id))assert(validate(schemaFor(port),values[port.id]),name+' '+port.id+' violates '+port.type);}}
function choose(schema,root=schema,depth=0,active=new Set()){
  if(depth>80)throw Error('Synthetic fixture recursion bound');
  if(schema.$ref){const name=schema.$ref.slice(14);assert(root.definitions?.[name],'Fixture local ref '+name);if(active.has(name))return null;return choose(root.definitions[name],root,depth+1,new Set([...active,name]));}
  if(Object.hasOwn(schema,'const'))return structuredClone(schema.const);
  if(schema.enum?.length)return structuredClone(schema.enum[0]);
  for(const branch of schema.anyOf??schema.oneOf??[]){try{const value=choose(branch,root,depth+1,active);if(validate({...schema,definitions:root.definitions},value))return value;}catch{}}
  if(schema.anyOf||schema.oneOf)throw Error('No finite union fixture');
  let value;
  for(const part of schema.allOf??[]){const v=choose(part,root,depth+1,active);value=value&&typeof value==='object'&&!Array.isArray(value)&&v&&typeof v==='object'&&!Array.isArray(v)?{...value,...v}:v;}
  const kind=Array.isArray(schema.type)?schema.type.find(type=>type!=='null')??'null':schema.type??(schema.properties?'object':schema.items?'array':undefined);
  if(kind==='object'){
    value=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    for(const key of schema.required??[])if(!Object.hasOwn(value,key)||schema.properties?.[key]&&!validate({...schema.properties[key],definitions:root.definitions},value[key]))value[key]=choose(schema.properties?.[key]??{},root,depth+1,active);
    for(let index=Object.keys(value).length;index<(schema.minProperties??0);index++)value['sample_'+index]=choose(schema.additionalProperties??{},root,depth+1,active);
    return value;
  }
  if(kind==='array'){
    return Array.from({length:schema.minItems??0},(_,index)=>choose(Array.isArray(schema.items)?schema.items[index]??schema.additionalItems??{}:schema.items??{},root,depth+1,active));
  }
  if(kind==='string'){
    const length=Math.max(schema.minLength??0,Math.min(6,schema.maxLength??6));
    const candidates=['sample','', '0','1','sample-name','https://example.com/','00000000-0000-4000-8000-000000000001','2026-10-23T00:00:00Z','10Gi','ZGVtbw==','x'.repeat(length),'a'.repeat(length),'0'.repeat(length)];
    for(let candidate of candidates){if(candidate.length<(schema.minLength??0))candidate+='a'.repeat(schema.minLength-candidate.length);if(candidate.length>(schema.maxLength??Infinity))continue;if(schema.pattern&&!new RegExp(schema.pattern,'u').test(candidate))continue;return candidate;}
    throw Error('No safe synthetic string for '+schema.pattern);
  }
  if(kind==='number'||kind==='integer'){let n=schema.minimum??(typeof schema.exclusiveMinimum==='number'?schema.exclusiveMinimum+1:0);if(kind==='integer')n=Math.ceil(n);if(schema.multipleOf)n=Math.ceil(n/schema.multipleOf)*schema.multipleOf;return n;}
  if(kind==='boolean')return false;if(kind==='null')return null;
  return value??null;
}

test('release inventories preserve every historical byte and exact dependency',()=>{
 const names=new Set(baseline.definitions.map(d=>d.name));for(const row of result.additions){assert(!names.has(row.definition.name),'Unique semantic name '+row.definition.name);names.add(row.definition.name);}
 assert.equal(result.releases.length,34);assert.equal(result.updates.length,846);assert.equal(result.additions.length,2565);
 for(const old of baseline.retained)assert.deepEqual(result.entries.get(old.id+'@'+old.version),old);
 for(const release of result.releases){assert(Buffer.byteLength(release.bytes)<=8*1024*1024);const manifest=JSON.parse(release.bytes);assert(manifest.definitions.length<=2000);assert.equal(manifest.version,'2.1.0');assert(!/onf\.lan|openclaw|chatjimmy|polarmonitoring|TempIt|AllanV3/i.test(release.bytes));}
});
test('every new contract and executable meets app bounds and compiles without provider execution',()=>{
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 for(const d of changed){assert(d.name.length<=120,d.name);assert((d.code??'').length<=250000,d.name);assert(d.inputs.length<=100&&d.outputs.length<=100,d.name);if(d.kind==='type')assert.doesNotThrow(()=>validate(d.schema,{}),d.name);else if(d.runtime!=='python')assert.doesNotThrow(()=>new AsyncFunction('inputs','config','context',d.code),d.name);for(const p of [...d.inputs,...d.outputs].filter(p=>p.type!=='control'))schemaFor(p);}
});
test('all structural type codec pairs preserve synthetic values and validated socket contracts',()=>{
 let count=0;
 for(const type of changed.filter(d=>d.kind==='type')){
  const encode=[...latest.values()].find(d=>(result.metadata.get(d.id)?.codec?.mode==='encode'||d.name.startsWith('Encode '))&&d.outputs.some(p=>p.id==='value'&&p.type===type.id&&p.typeVersion===type.version));
  const decode=encode&&([...latest.values()].find(d=>(result.metadata.get(d.id)?.codec?.mode==='decode'||d.name.startsWith('Decode '))&&d.inputs.some(p=>p.id==='value'&&p.type===type.id&&p.typeVersion===type.version)));
  assert(encode&&decode,'Reciprocal codecs for '+type.name);if(result.metadata.get(decode.id)?.codec)assert.equal(result.metadata.get(decode.id).codec.pairId,encode.id);
  const value=choose(type.schema);assert(validate(type.schema,value),'Fixture '+type.name);
  const fixtures=[value];
  if(type.schema.type==='object'){
   for(const [key,property] of Object.entries(type.schema.properties??{})){
    try{const exemplar={...value,[key]:choose(property,type.schema)};if(validate(type.schema,exemplar))fixtures.push(exemplar);}catch{}
    const explicitNull={...value,[key]:null};if(validate(type.schema,explicitNull))fixtures.push(explicitNull);
   }
  }
  if(type.schema.type==='array'){try{const item=choose(type.schema.items,type.schema);if(validate(type.schema,[item]))fixtures.push([item]);}catch{}}
if(type.schema.type==='object'&&type.schema.additionalProperties!==false){const extra={...value,__synthetic_extension:{zero:0,no:false,empty:'',nil:null}};if(validate(type.schema,extra))fixtures.push(extra);}
  for(const fixture of fixtures){const fields=run(decode,{value:structuredClone(fixture)});checkPorts(decode.outputs,fields,decode.name);checkPorts(encode.inputs,fields,encode.name);const output=run(encode,fields);checkPorts(encode.outputs,output,encode.name);assert.deepEqual(JSON.parse(JSON.stringify(output.value)),fixture,type.name);}
  count++;
 }assert(count>=850);
});

const snapshot=baseline,updated=changed,byId=new Map(baseline.definitions.map(d=>[d.id,d]));
const checkOutputs=(d,out)=>checkPorts(d.outputs,out,d.name);
test('known nested fields reject incorrect primitive/object values instead of broad JSON fallbacks',()=>{
  const cases=[['azure-aks','cluster-get',['properties','kubernetesVersion'],42],['kubernetes','get-deployment',['spec','replicas'],'two'],['loki','query-range',['result'],[{stream:{job:3},values:[['1792663200000000000','ready']]}]],['grafana','get-dashboard',['spec','title'],false]];
  for(const[family,key,path,bad]of cases){const op=reviewedOperations(snapshot).find(r=>r.family.id===family&&r.operation.key===key);const next=updated.find(d=>d.id===op.definition.id),port=next.outputs.find(p=>['item','value'].includes(p.id)),schema=schemaFor(port),value=choose(schema);let parent=value;for(const part of path.slice(0,-1))parent=parent[part]??={};parent[path.at(-1)]=bad;assert(!validate(schema,value),family+'.'+key+' rejects '+path.join('.'));}
});
test('PromQL and LogQL discriminator shapes, falsy sample strings and nanosecond strings remain exact',()=>{
  for(const family of ['prometheus','loki']){
    const row=reviewedOperations(snapshot).find(r=>r.family.id===family&&r.operation.key==='query'),d=updated.find(d=>d.id===row.definition.id),schema=schemaFor(d.outputs.find(p=>p.id==='item'));
    assert(!validate(schema,{resultType:'scalar',result:[]}));
    for(const value of ['0','NaN','+Inf','-Inf',''])assert(validate(schema,{resultType:'vector',result:[{metric:{job:'synthetic'},value:[0,value]}]}));
    if(family==='loki')assert(validate(schema,{resultType:'streams',result:[{stream:{job:'synthetic'},values:[['1792663200000000001','',{}]]}]}));
  }
});
test('all307 operation wire contracts retain request/auth/effect/paging behavior and safe mock replies validate',async()=>{
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  for(const row of reviewedOperations(snapshot)){
    const definition=updated.find(d=>d.id===row.definition.id)??row.definition,port=definition.outputs.find(p=>['item','items','value'].includes(p.id));
    let response=structuredClone(row.operation.sampleResponse);
    if(port&&row.compiled){const schema=schemaFor(port),selected=choose(schema);if(row.operation.response.kind==='list'&&selected.length===0){const element=choose(schema.items,schema);if(validate(schema,[element]))selected.push(element);}if(!(row.operation.response.path??[]).length)response=selected;else{response=response&&typeof response==='object'?response:{};let parent=response;const path=row.operation.response.path;for(const key of path.slice(0,-1))parent=parent[key]??={};parent[path.at(-1)]=selected;}}
    let calls=0;const fetch=async(url,options)=>{calls++;assert.equal(options.method,row.operation.method);assert(String(url).startsWith('http://127.0.0.1:19099/'));return new Response(row.operation.response.kind==='empty'?null:row.operation.response.kind==='text'?String(response):JSON.stringify(response),{status:row.operation.sampleStatus??200,headers:{'content-type':row.operation.response.kind==='text'?'text/plain':'application/json',...(row.operation.sampleHeaders??{})}});};
    const result=await new AsyncFunction('inputs','config','context','fetch',definition.code)(row.operation.sampleInputs,{baseUrl:'http://127.0.0.1:19099',allowHttp:true,confirmWrites:true,maxPages:1,maxItems:1000,$retries:0},{secrets:{get:()=> 'synthetic-only-token'},connection:{config:{}}},fetch);
    assert.equal(calls,1,row.definition.name);checkOutputs(definition,result);
  }
});

test('adapted structural source fingerprints match the reviewed provenance',()=>{const root=new URL('../',import.meta.url),provenance=JSON.parse(readFileSync(new URL('PROVENANCE-STRUCTURAL.json',root),'utf8'));for(const row of provenance.files)assert.equal(createHash('sha256').update(readFileSync(new URL(row.destination,root))).digest('hex'),row.adaptedSha256,row.destination);});

test('Jira transitions and Slack permalink expose reviewed fields using injected transport',async()=>{
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;let calls=0;
 const mock=async url=>{calls++;return new Response(JSON.stringify(String(url).includes('transitions')?{transitions:[{id:'31',name:'Done',to:{id:'3',name:'Done'}}]}:{ok:true,channel:'CSYNTHETIC',permalink:'https://example.invalid/message'}),{headers:{'content-type':'application/json'}});};
 for(const [id,inputs] of [['def_dac707ce922b',{issueKey:'SYN-1'}],['def_d691320bb95a',{channel:'CSYNTHETIC',ts:'123.456'}]]){const d=latest.get(id),out=await new AsyncFunction('inputs','config','context','fetch',d.code)(inputs,{}, {secrets:{get:()=> 'synthetic-secret'}},mock);checkPorts(d.outputs,out,d.name);assert(id==='def_dac707ce922b'?out.value[0].id==='31':out.value.channel==='CSYNTHETIC');}
 assert.equal(calls,2);
});
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const current=latest,fixture=choose,portChecks=(d,side,out)=>checkPorts(d[side],out,d.name);
test('all 15 REST operations use bounded, authenticated documented routes and structural response pins with mocked transport',async()=>{
 const rows=operationContracts(snapshot);assert.equal(rows.length,15);
 for(const row of rows){
  const d=current.get(row.definition.id),op=row.operation,inputs=Object.fromEntries(Object.entries(op.inputs).map(([key,s])=>[key,s.type==='number'?1:s.type==='boolean'?false:'example']));
  const output=d.outputs.find(p=>['items','item','value'].includes(p.id)),schema=schemaFor(output);
  const value=fixture(schema);let calls=0;
  const mock=async(url,options)=>{calls++;const parsed=new URL(url);assert.equal(parsed.searchParams.get('api-version'),'7.1');assert.equal(options.method,op.method);assert.ok(options.headers.get('authorization').startsWith('Basic '));assert.equal(parsed.hostname,op.baseUrl?'vsrm.dev.azure.com':'dev.azure.com');assert.equal(parsed.pathname,op.path.replace(/\{(\w+)\}/g,(_,key)=>String(inputs[key])));if(op.key==='build-queue')assert.deepEqual(JSON.parse(options.body),{definition:{id:1},sourceBranch:'example'});if(op.key==='pipeline-run')assert.deepEqual(JSON.parse(options.body),{resources:{repositories:{self:{refName:'example'}}}});return new Response(JSON.stringify(op.response.kind==='list'?{count:value.length,value}:value),{status:200,headers:{'content-type':'application/json'}});};
  const executeOperation=(inputs,config={confirmWrites:true},fetcher=mock)=>new AsyncFunction('inputs','config','context','fetch',d.code)(inputs,config,{secrets:{get:()=> 'synthetic-test-token'}},fetcher);
  const out=await executeOperation(inputs);assert.equal(calls,1,d.name);portChecks(d,'outputs',out);
  const required=Object.entries(op.inputs).find(([,s])=>s.required);if(required){const bad={...inputs};delete bad[required[0]];await assert.rejects(executeOperation(bad),/required|missing|Configure/i);}
  if(op.effect==='write'){calls=0;await assert.rejects(executeOperation(inputs,{}),/confirmWrites/);assert.equal(calls,0);await assert.rejects(executeOperation(inputs,{confirmWrites:true,$retries:1}),/retries/);assert.equal(calls,0);}
  await assert.rejects(executeOperation(inputs,{confirmWrites:true},async()=>new Response('synthetic provider detail that must not leak',{status:429})),error=>!error.message.includes('synthetic provider detail')&&/429/.test(error.message));
 }
});
test('List Pipelines continuation is exposed and followed only within configured bounds',async()=>{
 const d=current.get('def_af1052cbe48c');let calls=0;
 const run=maxPages=>new AsyncFunction('inputs','config','context','fetch',d.code)({organization:'example',project:'example'},{maxPages},{secrets:{get:()=> 'synthetic-test-token'}},async url=>{calls++;const u=new URL(url);return new Response(JSON.stringify({value:[{id:calls,name:'Example'}]}),{status:200,headers:{'content-type':'application/json',...(u.searchParams.has('continuationToken')?{}:{'x-ms-continuationtoken':'next-page'})}});});
 const one=await run(1);assert.equal(one.has_more,true);assert.equal(one.continuation,'next-page');calls=0;const two=await run(2);assert.equal(calls,2);assert.equal(two.has_more,false);assert.equal(two.items.length,2);
});
