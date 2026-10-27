import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {preparePackageReleases} from './package-releases.mjs';
import {foundationAdditions} from '../src/builders/foundations.mjs';

const stamp='2026-10-27T12:00:00.000Z';
export function foundationReleases(root=new URL('../',import.meta.url)) {
  preparePackageReleases(fileURLToPath(root),[]);
  const catalog=JSON.parse(readFileSync(new URL('onf-packages.json',root),'utf8'));
  const entries=new Map(),latest=new Map(),metadata=new Map(),packs=new Map(),families=new Map();
  for(const entry of catalog.packages.filter(e=>['2.0.0','2.1.0'].includes(e.version))) {
    const manifest=JSON.parse(readFileSync(new URL(entry.path,root),'utf8'));families.set(entry.id,entry);
    for(const d of manifest.definitions){entries.set(d.id+'@'+d.version,d);if(!latest.has(d.id)||latest.get(d.id).version<d.version)latest.set(d.id,d);}
    for(const m of manifest.libraryMetadata)metadata.set(m.definitionId,m);
    for(const p of manifest.libraryPacks)packs.set(p.id,p);
  }
  const oldMetadata=new Map(metadata),oldPacks=new Map(packs);
  function move(id,packId){const old=metadata.get(id);assert(old,id);if(old.packId!==packId)metadata.set(id,{...old,packId,revision:old.revision+1,updatedAt:stamp});}
  function describe(id,description){const old=packs.get(id);packs.set(id,{...old,description,revision:old.revision+1,updatedAt:stamp});}
  describe('onf.core','Essential entries, constants and custom code for every workflow.');
  describe('onf.runtime','Durable workflow state, work queues, variables, waits and execution coordination.');
  describe('onf.types','General JSON, nullable, list and dictionary contracts without provider dependencies.');
  describe('onf.utilities','General HTTP, text, date, collection, file, database and serialization tools.');
  packs.set('onf.logic',{id:'onf.logic',name:'Logic',description:'Reusable branching, comparison, selection, validation and boolean logic.',color:'#a4a0ff',revision:1,createdAt:stamp,updatedAt:stamp});
  families.set('onf.logic',{id:'onf.logic',name:'Logic',path:'packages/onf-logic/2.2.0.json'});
  for(const d of latest.values())if(metadata.get(d.id)?.packId==='onf.types'&&d.name.startsWith('Azure '))move(d.id,'pack_azure_devops');
  const logicNames=/^(Boolean (NOT|AND|OR|XOR|Branch|List Reduce)|Compare (Numbers|Text)|Number In Range|Select (JSON Value|Number|Text|Boolean)|Default (Nullable Number|Nullable Boolean|Nullable Text|JSON Value)|First Non-Null JSON Value|JSON Deep Equal|Inspect JSON Presence|Route Scalar Value|Switch Text Cases|Assert Condition|Raise Failure)$/;
  for(const d of latest.values())if(metadata.get(d.id)?.packId==='onf.utilities'&&logicNames.test(d.name))move(d.id,'onf.logic');
  move('core.condition','onf.logic');move('core.delay','onf.runtime');
  // Historical schema matching chose provider-branded dictionaries for general codecs.
  // Keep the codec identity and behavior, replacing only the public socket type reference.
  for(const before of [...latest.values()])if(metadata.get(before.id)?.packId==='onf.utilities') {
    const next=structuredClone(before);let changed=false;
    for(const port of [...next.inputs,...next.outputs]){
      const generic={'def_2209ce57ec00':'def_f9962f86c7f4','def_2a0d2bd7bab9':'def_e80efa95bff5'}[port.type];
      if(generic){port.type=generic;port.typeVersion=latest.get(generic).version;changed=true;}
    }
    if(changed){next.version++;next.updatedAt=stamp;entries.set(next.id+'@'+next.version,next);latest.set(next.id,next);}
  }
  const added=foundationAdditions(latest);
  for(const {definition,packId} of added){assert(!latest.has(definition.id),'New identity collision');entries.set(definition.id+'@'+definition.version,definition);latest.set(definition.id,definition);metadata.set(definition.id,{definitionId:definition.id,revision:1,tags:[packId.split('.').at(-1)],packId,updatedAt:stamp});}
  const primitive=new Set(['any','string','number','boolean','object','array','control']);
  const dependencies=new Map();
  for(const [pin,d]of entries){const refs=new Set();function walk(v){if(!v||typeof v!=='object')return;for(const [key,version]of [['type','typeVersion'],['definitionId','definitionVersion'],['executorId','executorVersion'],['bodyDefinitionId','bodyDefinitionVersion']])if(typeof v[key]==='string'&&!primitive.has(v[key])&&v[version]){const ref=v[key]+'@'+v[version];assert(entries.has(ref),'Missing dependency '+ref+' for '+pin);refs.add(ref);}for(const child of Object.values(v))walk(child);}walk(d);dependencies.set(pin,refs);}
  const releases=[];
  for(const [id,family]of families){const packId=id==='onf.azure-devops'?'pack_azure_devops':id.startsWith('onf.')&& !packs.has(id)?'pack_'+id.slice(4).replaceAll('-','_'):id;assert(packs.has(packId),'Unknown '+id+' '+packId);const closure=new Set();function include(pin){if(closure.has(pin))return;closure.add(pin);for(const ref of dependencies.get(pin))include(ref);}for(const d of latest.values())if(metadata.get(d.id)?.packId===packId)include(d.id+'@'+d.version);
    const definitions=[...closure].sort().map(pin=>entries.get(pin));assert(definitions.length,'Empty package '+id);
    const libraryMetadata=[...new Set(definitions.map(d=>d.id))].map(id=>metadata.get(id));const packIds=new Set(libraryMetadata.map(m=>m.packId));const libraryPacks=[...packs.values()].filter(p=>packIds.has(p.id));
    const changedPacks=libraryPacks.filter(p=>oldPacks.has(p.id)&&JSON.stringify(p)!==JSON.stringify(oldPacks.get(p.id))).map(p=>oldPacks.get(p.id));
    const changedMetadata=libraryMetadata.filter(m=>oldMetadata.has(m.definitionId)&&JSON.stringify(m)!==JSON.stringify(oldMetadata.get(m.definitionId))).map(m=>oldMetadata.get(m.definitionId));
    const own=packs.get(packId);const manifest={schemaVersion:1,id,name:family.name,version:'2.2.0',description:own.description,permissions:{secrets:[],network:definitions.some(d=>/\bfetch\s*\(|\bWebSocket\b/.test(d.code)),filesystem:definitions.some(d=>d.runtime==='python'||/node:fs|node:sqlite|\bopen\(/.test(d.code)),description:'Installation runs no code. Review node documentation before execution. Runtime queue/state operations persist ONF data; utilities and providers may perform their explicitly configured effects.'},definitions,libraryPacks,libraryFolders:[],libraryMetadata,...(changedPacks.length||changedMetadata.length?{libraryMigrations:{packs:changedPacks,metadata:changedMetadata}}:{})};
    const folder=family.path.split('/').slice(0,-1).join('/');const path=folder+'/2.2.0.json';let bytes=JSON.stringify(manifest,null,2)+'\n';if(Buffer.byteLength(bytes)>8*1024*1024)bytes=JSON.stringify(manifest)+'\n';assert(Buffer.byteLength(bytes)<=8*1024*1024&&definitions.length<=2000,'Oversized '+id);
    releases.push({bytes,entry:{id,name:manifest.name,version:manifest.version,description:manifest.description,path,sha256:createHash('sha256').update(bytes).digest('hex'),config:folder+'/onf-package.json'}});
  }
  return {releases,entries,latest,metadata,packs,added,migrations:[...metadata.values()].filter(m=>oldMetadata.has(m.definitionId)&&m.packId!==oldMetadata.get(m.definitionId).packId)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){assert(process.argv.slice(2).every(arg=>arg==='--check'));const root=new URL('../',import.meta.url),result=foundationReleases(root),plan=preparePackageReleases(fileURLToPath(root),result.releases);if(!process.argv.includes('--check'))plan.write();console.log(JSON.stringify({addedReleases:plan.added,newAssets:result.added.length,relocatedAssets:result.migrations.length,packages:result.releases.map(r=>({id:r.entry.id,definitions:JSON.parse(r.bytes).definitions.length}))},null,2));}
