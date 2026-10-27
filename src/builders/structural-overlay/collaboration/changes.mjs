import{ownedPacks,createContracts,descriptorFor,rewriteObjectCodecs}from './contracts.mjs';import{clone,completeSchema,ref,JSON_TYPES,hash}from '../common.mjs';
const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).filter(k=>!['description','documentation','definitions','$schema','$id','title'].includes(k)).sort().map(k=>[k,sort(value[k])]));return value;}
function objectLike(schema){return schema?.type==='object'&&Object.keys(schema.properties??{}).length;}
function stripDefinitions(schema){if(Array.isArray(schema))return schema.map(stripDefinitions);if(!schema||typeof schema!=='object')return schema;return Object.fromEntries(Object.entries(schema).filter(([key])=>key!=='definitions').map(([key,value])=>[key,stripDefinitions(value)]));}
function collectDefinitions(schema,out){if(!schema||typeof schema!=='object')return;for(const[key,value]of Object.entries(schema.definitions??{}))if(key!=='ONFJsonValue')out[key]=value;for(const[key,value]of Object.entries(schema))if(key!=='definitions'&&value&&typeof value==='object')for(const child of Array.isArray(value)?value:[value])collectDefinitions(child,out);}
export function buildChanges(snapshot){
 const {additions,replacements,fieldRefs,extraDefinitions,special,sources}=createContracts(snapshot);
 const byId=new Map(snapshot.definitions.map(d=>[d.id,d])),metadata=new Map(snapshot.library.assets.map(d=>[d.definitionId,d]));
 const owned=snapshot.definitions.filter(d=>ownedPacks.includes(metadata.get(d.id)?.packId));
 const matches=new Map([...replacements].filter(([id])=>objectLike(byId.get(id).schema)||byId.get(id).schema.type==='array').map(([id,replacement])=>[metadata.get(id).packId+'|'+canonical(byId.get(id).schema),{id,schema:replacement.schema}]));
 function rewrite(value,visited=new Set(),packId){
  if(!value||typeof value!=='object')return value;
  const replacement=matches.get(packId+'|'+canonical(value));
  if(replacement&&!visited.has(replacement.id))return rewrite(replacement.schema,new Set([...visited,replacement.id]),packId);
  if(Array.isArray(value))return value.map(child=>rewrite(child,visited,packId));
  return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,key==='definitions'?clone(child):rewrite(child,visited,packId)]));
 }
 const globalDefinitions=clone(extraDefinitions);for(const replacement of replacements.values())collectDefinitions(replacement.schema,globalDefinitions);for(const row of additions)collectDefinitions(row.definition.schema,globalDefinitions);
 function finalize(schema,packId){const defs={};collectDefinitions(schema,defs);let value=stripDefinitions(schema);const needed=new Set();const scan=x=>{if(!x||typeof x!=='object')return;if(x.$ref?.startsWith('#/definitions/'))needed.add(x.$ref.slice(14));for(const child of Object.values(x))scan(child);};scan(value);let changed=true;while(changed){changed=false;for(const key of [...needed])if(key!=='ONFJsonValue'&&!Object.hasOwn(defs,key)){const def=globalDefinitions[key];if(!def)throw Error('Unresolved local schema definition '+key);defs[key]=stripDefinitions(rewrite(def,new Set(),packId));scan(defs[key]);changed=true;}}
  return completeSchema({...value,...(Object.keys(defs).length?{definitions:defs}:{})});
 }
 const changes=new Map();
 for(const definition of owned.filter(d=>d.kind==='type')){
  const direct=replacements.get(definition.id),packId=metadata.get(definition.id).packId,schema=finalize(rewrite(direct?.schema??definition.schema,new Set(direct?[definition.id]:[]),packId),packId);
  if(canonical(schema)!==canonical(definition.schema))changes.set(definition.id,{id:definition.id,expectedVersion:definition.version,patch:{schema},reason:direct?.reason??'Propagate the reviewed semantic contract through an existing embedded list, field or provider response schema.'});
 }
 for(const row of additions)if(row.definition.schema)row.definition.schema=finalize(rewrite(row.definition.schema,new Set(),row.packId),row.packId);
 const semantic=new Map();for(const definition of owned.filter(d=>d.kind==='type'&&objectLike(d.schema)))semantic.set(metadata.get(definition.id).packId+'|'+canonical(changes.get(definition.id)?.patch.schema??definition.schema),ref(definition.id,definition.version+(changes.has(definition.id)?1:0)));for(const row of additions.filter(row=>row.definition.kind==='type'))semantic.set(row.packId+'|'+canonical(row.definition.schema),ref('@'+row.key));
 function descriptors(definition,encode){const schema=changes.get(definition.id)?.patch.schema??definition.schema;return Object.fromEntries(Object.entries(schema.properties??{}).map(([field,property])=>{
   const original=encode.inputs.find(p=>p.id===field||p.id==='field_'+field||field==='$schema'&&p.id==='schema_url');const explicit=fieldRefs.get(definition.id)?.[field];const nonnull=property.anyOf?.find(branch=>branch.type!=='null')??property;
   const inferred=semantic.get(metadata.get(definition.id).packId+'|'+canonical(nonnull));return [field,explicit??inferred??(original?{type:original.type,...(original.typeVersion?{typeVersion:original.typeVersion}:{})}:descriptorFor(property))];
  }));}
 for(const definition of owned.filter(d=>d.kind==='type'&&changes.has(d.id)&&objectLike(changes.get(d.id).patch.schema))){
  const encode=owned.find(d=>metadata.get(d.id)?.codec?.mode==='encode'&&d.outputs.some(p=>p.id==='value'&&p.type===definition.id));
  const decode=encode&&byId.get(metadata.get(encode.id)?.codec?.pairId);
  if(!encode||!decode||metadata.get(decode.id)?.codec?.pairId!==encode.id)continue;
  // JSON text codecs and whole-value adapters keep their existing public sockets and behavior.
  if(!encode.inputs.some(port=>port.id==='remainder')||!decode.outputs.some(port=>port.id==='remainder'))continue;
  const enc=clone(encode),dec=clone(decode);rewriteObjectCodecs(enc,dec,changes.get(definition.id).patch.schema,descriptors(definition,encode),ref(definition.id,definition.version+1));
  for(const [before,after]of[[encode,enc],[decode,dec]])changes.set(before.id,{id:before.id,expectedVersion:before.version,patch:{inputs:after.inputs,outputs:after.outputs,code:after.code,documentation:before.documentation+'\n\n2026-10-23 contract audit: known nested fields use semantic sockets. Unknown extensions stay in remainder. Structured nulls stay in remainder when the corresponding field socket is nonnull; absent and falsy fields remain exact.'},reason:'Expose the updated structural provider members through reciprocal field codecs without losing optional nulls or future extension fields.'});
 }
 for(const[id,target,select]of[['def_dac707ce922b',special.transitions,true],['def_d691320bb95a',special.permalink,false]]){
  const definition=byId.get(id);const outputs=definition.outputs.map(port=>port.id==='value'?{...port,...target.ref}:clone(port));
  const patch={outputs,documentation:definition.documentation+'\n\n2026-10-23 contract audit: value is now '+target.key+'. '+(select?'The documented transitions array is selected from the transport envelope.':'The documented ok/channel/permalink response has its own structural contract.')};
  if(select)patch.code='const result = await (async () => {\n'+definition.code+'\n})();\nif(!result.value||!Array.isArray(result.value.transitions))throw Error("Expected Jira transitions array");\nreturn {...result,value:result.value.transitions};';
  changes.set(id,{id,expectedVersion:definition.version,patch,reason:select?'Documented transition records were exposed as an unstructured JSON transport envelope.':'The documented permalink result was incorrectly exposed as generic JSON.'});
 }
 for(const[id,fields]of[['def_938bf8e951c2',{fields:special.jiraFields.ref}],['def_e5b3b83b6736',{parent:special.notionParent.ref,properties:special.notionProperties.ref}],['def_f6919912ad76',{properties:special.notionProperties.ref}],['def_3a907888c3c2',{projects:ref('def_e80efa95bff5')}]] ){
  const definition=byId.get(id);changes.set(id,{id,expectedVersion:definition.version,patch:{inputs:definition.inputs.map(port=>fields[port.id]?{...port,...fields[port.id]}:clone(port))},reason:'Replace generic request dictionaries/lists with reviewed semantic contracts while retaining tenant-defined extension keys and existing socket IDs.'});
 }
 const exceptions={pack_hubspot:['CRM property maps and search results are keyed by tenant-defined property names; scalar propertyValue follows the configured remote property type.','Association grouping keys depend on the requested object family. Provider extension members are retained.'],pack_google_analytics:['Named row dictionary keys are request-selected dimension/metric names, with structural string/numeric-value contracts. Metadata extensions remain finite JSON.'],pack_google_ads:['GAQL permits selected resources beyond the installed common campaign/customer fields. Unknown selected resource fields remain explicit extensions.'],pack_websocket:['Decoded frame JSON and correlation values are protocol-defined, not an ONF-owned provider record.'],pack_jira:['Custom field IDs and values, screen configuration, and ADF node attributes depend on site schema; known issue/transition/ADF envelopes are structural.'],pack_notion:['Page/data-source property keys and polymorphic formula/rollup values follow user-defined schemas; new mention and block kinds remain extensions.'],pack_sentry:['SDK event interface data varies by interface type and platform, including arbitrary application context. Interface type and known envelope fields are structural.'],pack_microsoft_teams:['Adaptive Card custom actions submit user/application data. Unknown supported host-specific card elements remain typed extension dictionaries.']};
 function dynamicPaths(schema,path='$',root=schema,seen=new Set()){
  if(!schema||typeof schema!=='object')return[];
  if(schema.$ref){if(/(?:ONFJsonValue|json_value|json_record|json_list)$/.test(schema.$ref))return[path];if(seen.has(schema.$ref))return[];return dynamicPaths(root.definitions?.[schema.$ref.slice(14)],path,root,new Set([...seen,schema.$ref]));}
  const paths=[];for(const[key,value]of Object.entries(schema.properties??{}))paths.push(...dynamicPaths(value,path+'.'+key,root,seen));if(schema.items)paths.push(...dynamicPaths(schema.items,path+'[]',root,seen));
  for(const branch of schema.anyOf??schema.oneOf??[])paths.push(...dynamicPaths(branch,path,root,seen));
  if(schema.additionalProperties&&typeof schema.additionalProperties==='object')paths.push(...dynamicPaths(schema.additionalProperties,path+'.*',root,seen));return [...new Set(paths)];
 }
 const audit=owned.map(definition=>{const packId=metadata.get(definition.id).packId,composition=Boolean(definition.subflow||definition.collection||definition.repeat),after={...definition,...changes.get(definition.id)?.patch};
  const contracts=definition.kind==='type'?[{side:'schema',schema:after.schema}]:['inputs','outputs'].flatMap(side=>after[side].filter(port=>port.type!=='control').map(port=>({side,id:port.id,type:port.type,version:port.typeVersion,schema:(byId.get(port.type)?.kind==='type'?(changes.get(port.type)?.patch.schema??byId.get(port.type).schema):null)??additions.find(row=>'@'+row.key===port.type)?.definition.schema})));
  const dynamic=contracts.flatMap(contract=>dynamicPaths(contract.schema).map(path=>({boundary:contract.side+(contract.id?'.'+contract.id:''),path,reason:path.endsWith('.*')?'Unknown provider extensions remain finite JSON.':(exceptions[packId]??['Provider-defined extension payload; known named resource members are structural.']).join(' ')})));
  return{id:definition.id,name:definition.name,version:definition.version,kind:definition.kind,packId,verdict:changes.has(definition.id)?'update-structural-contract':composition?'retain-pinned-composition':definition.kind==='type'?'retain-structural-contract':'retain-code-and-exact-provider-contract',source:sources[packId.replace('pack_','')],reason:changes.get(definition.id)?.reason??(composition?'Exact inner definitions/public bindings retained; migration requires an explicit coherent composition revision.':'Reviewed actual code/socket result path and recursive known schema; existing nominal contracts are retained.'),evidence:{codeHash:hash(definition.code??''),providerPaths:[...new Set([...String(definition.code).matchAll(/"path":"([^"\n]+)"/g)].map(match=>match[1]))].slice(-6),contracts:contracts.map(({schema,...contract})=>({...contract,shape:schema?.type??(schema?.anyOf||schema?.oneOf?'union':schema?.$ref?'reference':'primitive'),knownFields:Object.keys(schema?.properties??{})})),composition},dynamicExceptions:dynamic};});
 return{updates:[...changes.values()],additions,audit};
}
