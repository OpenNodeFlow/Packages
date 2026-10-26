// Reproducible generic source build. No application installation, HTTP or provider operation.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildAll, resolveDefinition } from '../src/builders/catalog-all.mjs';
import { buildCurrentDeveloperCatalog } from '../src/builders/azure-pack-consolidation-20261022/catalog-policy.mjs';
const root=new URL('../',import.meta.url),stamp='2026-10-22T00:00:00.000Z';
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const registry=read('src/builders/registry.json'),canonical=read('src/builders/canonical-types.json');
const developer=buildCurrentDeveloperCatalog();
for(const row of developer.rows)registry[row.key]={id:row.definition.id,version:row.definition.version};
const pack=(id,name,description,color='#58afa6')=>({id,name,description,color,revision:1,createdAt:stamp,updatedAt:stamp});
const packs=new Map([
  ['onf.types',pack('onf.types','Shared types','Canonical JSON, nullable, text-list and Azure entity contracts.')],
  ['onf.utilities',pack('onf.utilities','Utilities','Typed HTTP, text, dates, collections, files, SQLite, XML, mail, codecs and reusable compositions.')],
  ...[['microsoft_teams','Microsoft Teams'],['hubspot','HubSpot'],['xero','Xero'],['google_analytics','Google Analytics 4'],['google_ads','Google Ads'],['websocket','WebSockets']].map(([id,name])=>['pack_'+id,pack('pack_'+id,name,name+' integration assets')]),
  ...developer.packs.map(p=>[p.id,pack(p.id,p.name,p.description,p.color)]),
]);
const categories={'Microsoft Teams':'pack_microsoft_teams',HubSpot:'pack_hubspot',Xero:'pack_xero','Google Analytics 4':'pack_google_analytics','Google Ads':'pack_google_ads',WebSockets:'pack_websocket'};
const entries=new Map(),owners=new Map(),tags=new Map();
const forbidden=/(?:onf\.lan|openclaw\.lan|polarmonitoring|58dc89b7-5a26-4647-9f58-9bcbb9b1204c|AllanV3|TempIt)/i;
function add(definition,owner,sourceTags=[]) {
  if(forbidden.test(JSON.stringify(definition)))throw new Error('Office-specific material is excluded: '+definition.id);
  const full={...definition,description:definition.description||definition.name,category:definition.category||'Types',color:definition.color||'#58afa6',code:definition.code||'',inputs:definition.inputs||[],outputs:definition.outputs||[],createdAt:definition.createdAt||stamp,updatedAt:definition.updatedAt||stamp,builtin:false};
  const pin=full.id+'@'+full.version;
  if(entries.has(pin))throw new Error('Duplicate definition '+pin);
  entries.set(pin,full);owners.set(full.id,owner);tags.set(full.id,[...new Set(sourceTags.map(s=>s.toLowerCase()).filter(s=>s.length<=40))].sort().slice(0,20));
}
for(const d of canonical)add(d,'onf.types',['type','shared']);
for(const row of buildAll()) {
  const identity=registry[row.key];if(!identity)throw new Error('Missing published identity '+row.key);
  const d=resolveDefinition(row.definition,registry);d.documentation+='\n\nLibrary registry key: `'+row.key+'`.';
  const owner=categories[d.category]||(row.key.startsWith('subflow.teams.')?'pack_microsoft_teams':row.key.startsWith('subflow.hubspot.')?'pack_hubspot':row.key.startsWith('subflow.xero.')?'pack_xero':row.key.startsWith('subflow.ga4.')?'pack_google_analytics':'onf.utilities');
  add({...d,...identity},owner,row.tags);
}
for(const row of developer.rows)add(resolveDefinition(row.definition,registry),row.packId,row.tags);
const primitives=new Set(['any','string','number','boolean','object','array','control']);
function dependencies(d) {
  const found=new Set();
  function walk(value) {
    if(!value||typeof value!=='object')return;
    for(const [field,version] of [['type','typeVersion'],['executorId','executorVersion'],['definitionId','definitionVersion'],['bodyDefinitionId','bodyDefinitionVersion']]) {
      if(typeof value[field]==='string'&&!primitives.has(value[field])) {
        if(field==='type'&&!value.typeVersion)continue; // JSON Schema type declarations are not socket references.
        if(!Number.isInteger(value[version])||value[version]<1)throw new Error('Dependency needs exact version '+value[field]);
        const pin=value[field]+'@'+value[version];if(!entries.has(pin))throw new Error('Missing dependency '+pin+' used by '+d.id);found.add(pin);
      }
    }
    for(const child of Object.values(value))if(child&&typeof child==='object')walk(child);
  }
  walk(d);return [...found];
}
const graph=new Map([...entries].map(([pin,d])=>[pin,dependencies(d)]));
const pairs=new Map();
for(const pair of developer.pairs) {
  pairs.set(pair.encodeId,{pairId:pair.decodeId,mode:'encode',name:pair.name});
  pairs.set(pair.decodeId,{pairId:pair.encodeId,mode:'decode',name:pair.name});
}
// Existing functional source codecs remain usable even when their historic naming is ambiguous;
// only the explicitly declared developer pair list is linked automatically.
const catalog=read('onf-packages.json');catalog.packages=catalog.packages.filter(p=>p.id==='onf.core'||p.id==='onf.runtime');
for(const [owner,libraryPack] of packs) {
  const selected=[...entries].filter(([,d])=>owners.get(d.id)===owner).map(([pin])=>pin);
  if(!selected.length)continue;
  const closure=new Set();function include(pin){if(closure.has(pin))return;closure.add(pin);for(const dependency of graph.get(pin)||[])include(dependency);}
  selected.forEach(include);
  // Reciprocal codec metadata includes both sister definitions in the same atomic package.
  for(const pin of [...closure]){const d=entries.get(pin),pair=pairs.get(d.id);if(pair){const partner=[...entries].find(([,p])=>p.id===pair.pairId);if(partner)include(partner[0]);}}
  const definitions=[...closure].sort().map(pin=>entries.get(pin));
  const ids=[...new Set(definitions.map(d=>d.id))];
  const metadata=ids.map(definitionId=>({definitionId,revision:1,tags:tags.get(definitionId)||[],packId:owners.get(definitionId),...(pairs.has(definitionId)?{codec:pairs.get(definitionId)}:{}),updatedAt:stamp}));
  const usedPacks=[...new Set(metadata.map(m=>m.packId))].sort().map(id=>packs.get(id));
  const id=owner.startsWith('pack_')?'onf.'+owner.slice(5).replaceAll('_','-'):owner;
  const manifest={schemaVersion:1,id,name:libraryPack.name,version:'2.0.0',description:libraryPack.description,permissions:{secrets:[],network:definitions.some(d=>/\bfetch\s*\(|\bWebSocket\b/.test(d.code)),filesystem:definitions.some(d=>d.runtime==='python'||/node:fs|node:sqlite|\bopen\(/.test(d.code)),description:'Provider operations may read/write/delete external resources, refresh OAuth tokens, send mail, access local files or mutate ONF state when deliberately executed. Required credential names are configured per node; inspect each pinned definition help and connection settings. Declarations are advisory, not a sandbox. Installation runs no code.'},definitions,libraryPacks:usedPacks,libraryFolders:[],libraryMetadata:metadata};
  const directory=id.replaceAll('.','-'),path=`packages/${directory}/2.0.0.json`;
  const bytes=JSON.stringify(manifest,null,2)+'\n';
  if(Buffer.byteLength(bytes)>8*1024*1024)throw new Error('Manifest exceeds loader byte bound '+id);
  if(definitions.length>2000)throw new Error('Manifest exceeds definition count bound '+id);
  mkdirSync(new URL(`packages/${directory}/`,root),{recursive:true});writeFileSync(new URL(path,root),bytes);
  catalog.packages.push({id,name:manifest.name,version:manifest.version,description:manifest.description,path,sha256:createHash('sha256').update(bytes).digest('hex')});
  console.log(`${id}: ${selected.length} owned definitions, ${definitions.length} with immutable dependency closure`);
}
writeFileSync(new URL('onf-packages.json',root),JSON.stringify(catalog,null,2)+'\n');
writeFileSync(new URL('CATALOG-SUMMARY.json',root),JSON.stringify({schemaVersion:1,ownedDefinitionCount:entries.size,packages:catalog.packages.length,historicalSourceBaseline:'Generic audited source factories 21-22 October 2026; canonical IDs/pins preserved; later structural overlay requires independent migration',excluded:['Private PR workflow controllers','Office endpoint/policy/model routing','Runtime exports/data/history/secrets','Live provider verification']},null,2)+'\n');
