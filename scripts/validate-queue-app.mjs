import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import Ajv from 'ajv';
if(process.argv[2]!=='--app'||!process.argv[3]||process.argv.length!==4)throw Error('Usage: node --import <v2 tsx loader> scripts/validate-queue-app.mjs --app <v2 checkout>');
const app=pathToFileURL(resolve(process.argv[3])+'/'),pkg=JSON.parse(readFileSync(new URL('package.json',app)));
assert(pkg.version.startsWith('2.')&&pkg.name==='@opennodeflow/app');
const {StorageService}=await import(new URL('server/platform-storage.ts',app));
const {storageJsonSchemas}=await import(new URL('shared/storage-model.ts',app));
const snapshot=JSON.parse(readFileSync(new URL('../src/builders/work-queue-contracts.json',import.meta.url)));
for(const [operation,contract]of Object.entries(snapshot))assert.deepEqual(storageJsonSchemas[operation],contract,'Queue schema snapshot drift: '+operation);
const definitions=JSON.parse(readFileSync(new URL('../packages/runtime/2.2.0.json',import.meta.url))).definitions;
const ajv=new Ajv({strict:false,validateFormats:false}),validators=new Map(definitions.filter(d=>d.kind==='type').map(d=>[d.id,ajv.compile(d.schema)]));
const db=new DatabaseSync(':memory:'),key=randomBytes(32);let now=Date.parse('2026-10-27T12:00:00Z');
const seal=text=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),body].map(v=>v.toString('base64')).join('.');};
const unseal=value=>{const[iv,tag,body]=value.split('.').map(v=>Buffer.from(v,'base64')),cipher=createDecipheriv('aes-256-gcm',key,iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(body),cipher.final()]).toString('utf8');};
const service=new StorageService(db,seal,unseal,ws=>ws==='synthetic',()=>now);
const actions=new Set();
async function call(action,request){const node=definitions.find(d=>d.id==='runtime.queue.'+action);assert(node);const input=node.inputs.find(p=>p.id==='request'),output=node.outputs.find(p=>p.id==='result');assert(validators.get(input.type)(request),JSON.stringify(validators.get(input.type).errors));let emitted=false;
 const result=await new(Object.getPrototypeOf(async function(){}).constructor)('inputs','config','context',node.code)({request},{namespace:'example'},{storage:namespace=>({request:(op,args)=>service.dispatch('synthetic',namespace,{op,args})}),emit:port=>{assert.equal(port,'next');emitted=true;}});
 assert(emitted);assert(validators.get(output.type)(result.result),JSON.stringify(validators.get(output.type).errors));actions.add(action);return result.result;}
try{
 let q=await call('create',{queue:'jobs',config:{maxItems:10}});q=await call('configure',{queue:'jobs',expectedVersion:q.version,config:{concurrency:2}});assert.equal(q.config.concurrency,2);
 await call('inspect',{queue:'jobs'});assert.equal((await call('listQueues',{})).items.length,1);
 const first=await call('enqueue',{queue:'jobs',key:'one',dedupKey:'one',payload:{message:'hello'}});assert.equal((await call('enqueue',{queue:'jobs',key:'one',dedupKey:'one',payload:{message:'hello'}})).key,first.key);
 await call('get',{queue:'jobs',key:'one'});await call('list',{queue:'jobs',includeData:true});
 let item=await call('claim',{queue:'jobs'});const token=item.leaseToken;const fence=()=>({queue:'jobs',key:item.key,expectedVersion:item.version,leaseToken:token});
 item=await call('start',fence());item=await call('heartbeat',fence());item=await call('ack',{...fence(),result:{done:true}});assert.equal(item.status,'completed');
 let second=await call('enqueue',{queue:'jobs',key:'two',dedupKey:'two',payload:null});second=await call('cancel',{queue:'jobs',key:second.key,expectedVersion:second.version,reason:'Synthetic cancellation'});assert.equal(second.status,'cancelled');
 await call('enqueue',{queue:'jobs',key:'three',dedupKey:'three',payload:[]});let third=await call('claim',{queue:'jobs'});third=await call('fail',{queue:'jobs',key:third.key,expectedVersion:third.version,leaseToken:third.leaseToken,error:{message:'synthetic'},retryable:false});assert.equal(third.status,'dead');
 third=await call('recover',{queue:'jobs',key:third.key,expectedVersion:third.version,action:'discard',reason:'Synthetic reconciliation'});assert.equal(third.status,'cancelled');
 now+=1000;const prune=await call('prune',{queue:'jobs',before:new Date(now).toISOString(),reason:'Synthetic retention'});assert.equal(prune.deleted,3);
 assert.equal((await call('enqueue',{queue:'jobs',key:'one-again',dedupKey:'one',payload:null})).key,'one-again');assert.equal(actions.size,15);
 console.log(JSON.stringify({operations:actions.size,method:'Actual Runtime package node bodies and named socket schemas against encrypted in-memory v2 StorageService',providerCalls:0,persistentFiles:0}));
}finally{db.close();}
