import {makeTypeWithCodecs,completeSchema,ref,hash,JSON_TYPES,title,clone} from '../common.mjs';
import {reviewedModels,canonicalModels,newModels,pruneDefinitions} from './models.mjs';

const PACK='pack_azure_devops';
const nullableScalars={string:'def_a653164ce2cf',number:'def_a5280518223d',integer:'def_a5280518223d',boolean:'def_23b3031131b2'};
const listIds={def_5a8136d830f9:'def_0a4c70eebc54',def_f49f4e8525d4:'def_88140ac12ecd',def_ad0ca30fedc5:'def_d569f619a7d3',def_1926ed9218fc:'def_289e2b7d4de1',def_fbfde301b93a:'def_f8b0558dcd62',def_3e18b735f947:'def_16bc81fa0d51',def_8afceecb46a9:'def_c850f415899e',def_b04c995df0e8:'def_229c6c3d99d6',def_8ef7a4264c48:'def_ab89812db64b',def_4432f688a6fa:'def_e27b741f52a0',def_82f86ac04dd6:'def_f11f6f4cbfa8',def_6dcdbdc1614a:'def_81e15216440a'};
const nullableIds={def_44192693c980:'def_5bc5fd5c5d1c',def_41fde3cc1c55:'def_99975831cddc',def_b04c995df0e8:'def_7dd413df5a94',def_1d820ba689db:'def_cdbdd9b99490',def_1b7a9641535c:'def_d7234d364ad3',def_690ea53cafe0:'def_67bfba897ba3',def_16bc81fa0d51:'def_2ad437a9b5ab',def_5a8136d830f9:'def_15e49cb73eb6',def_289e2b7d4de1:'def_82a5c7caff0d',def_f8b0558dcd62:'def_2b452095e539',def_56b3651cf5d5:'def_b3cd59e8b693',def_0a4c70eebc54:'def_245259e2101b',def_b98f4c89c425:'def_14514780139e',def_206a5dc8ef29:'def_78107927949c',def_f49f4e8525d4:'def_3eea0a961e4c',def_88140ac12ecd:'def_5fc92db04df6',def_b280f2f17ed0:'def_bde25ef2bb69',def_920eb19728df:'def_2dedfa102748',def_371896985f1d:'def_d48abc86263b',def_d569f619a7d3:'def_01228bedc428',def_e2221b999f1a:'def_ccc883684386',def_f18cc5eaac5a:'def_5d32ad86c995',def_c850f415899e:'def_9305acb042b6',def_8afceecb46a9:'def_7a18d8eb83c3',def_7a4abdbacfa8:'def_f9371779c8b5'};
const slug=value=>value.replace(/[^A-Za-z0-9_.-]+/g,'-');
const ctl=(id,name=id)=>({id,name,type:'control'});
const port=(id,type,required=false)=>({id,name:title(id),...type,...(required?{required:true}:{})});
const jsonRef={$ref:'#/definitions/ONFJsonValue'};

// Only schema keywords emitted by the reviewed structural models are interpreted.
// ONF additionally validates exact pinned input/output schemas at the boundary.
export function matchesContract(schema,value,root=schema,depth=0){
 if(depth>100||schema===false)return false;if(schema===true)return true;
 if(schema.$ref){if(!schema.$ref.startsWith('#/'))return false;const s=schema.$ref.slice(2).split('/').reduce((v,k)=>v?.[k.replaceAll('~1','/').replaceAll('~0','~')],root);return !!s&&matchesContract(s,value,root,depth+1);}
 const own=(v,k)=>v!==null&&typeof v==='object'&&Object.hasOwn(v,k);
 if(own(schema,'const')&&JSON.stringify(value)!==JSON.stringify(schema.const)||schema.enum&&!schema.enum.some(v=>JSON.stringify(v)===JSON.stringify(value)))return false;
 if(schema.anyOf&&!schema.anyOf.some(s=>matchesContract(s,value,root,depth+1)))return false;
 if(schema.oneOf&&schema.oneOf.filter(s=>matchesContract(s,value,root,depth+1)).length!==1)return false;
 const kind=value===null?'null':Array.isArray(value)?'array':typeof value;
 if(schema.type&&!([].concat(schema.type)).some(t=>t===kind||t==='integer'&&kind==='number'&&Number.isSafeInteger(value)))return false;
 if(kind==='number'&&(!Number.isFinite(value)||schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum))return false;
 if(kind==='string'&&(schema.minLength!==undefined&&value.length<schema.minLength||schema.maxLength!==undefined&&value.length>schema.maxLength||schema.pattern&&!(new RegExp(schema.pattern,'u')).test(value)))return false;
 if(kind==='array'&&(schema.maxItems!==undefined&&value.length>schema.maxItems||schema.minItems!==undefined&&value.length<schema.minItems||schema.items&&!value.every(v=>matchesContract(schema.items,v,root,depth+1))))return false;
 if(kind==='object'){
  if((schema.required??[]).some(k=>!own(value,k)))return false;
  for(const[k,v]of Object.entries(value))if(own(schema.properties??{},k)){if(!matchesContract(schema.properties[k],v,root,depth+1))return false;}else if(schema.additionalProperties===false||typeof schema.additionalProperties==='object'&&!matchesContract(schema.additionalProperties,v,root,depth+1))return false;
 }
 return true;
}

export function contractRegistry(snapshot){
 const current=new Map(snapshot.definitions.map(d=>[d.id,d]));
 const metadata=new Map(snapshot.library.assets.map(m=>[m.definitionId,m]));
 const models=reviewedModels(),entries=new Map(),sourceModels=new Map();
 const updates=new Map(),additions=[];
 const folderId=metadata.get('def_b04c995df0e8')?.folderId;
 const options={packId:PACK,folderId,tags:['azure-devops','contract-audit','typed'],category:'Azure DevOps/Contracts',color:'#e99a54'};
 const documentation='Source-backed Azure DevOps contract. Known fields are structural, with explicit nullable values and recursive finite JSON only for documented provider extension bags. Unknown extension fields roundtrip through remainder; absence and explicit null remain distinct. Source: https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.1 and Microsoft azure-devops-node-api DTO declarations captured in devops/sources/manifest.json. Pure transformation; no provider calls or state changes.';
 for(const[id,spec]of Object.entries({...canonicalModels,...newModels}))sourceModels.set('sdk_'+spec.space+'_'+spec.name,id);
 sourceModels.set('sdk_GitInterfaces_IdentityRefWithVote','def_5a8136d830f9');
 // Base/reference DTOs denote the same provider entity, not separate identities.
 sourceModels.set('sdk_CoreInterfaces_TeamProject','def_b04c995df0e8');
 sourceModels.set('sdk_CoreInterfaces_TeamProjectReference','def_b04c995df0e8');
 sourceModels.set('sdk_ReleaseInterfaces_ProjectReference','def_b04c995df0e8');
 sourceModels.set('sdk_GitInterfaces_GitRepositoryRef','def_690ea53cafe0');

 function change(id,patch,reason){
  const old=current.get(id);if(!old)throw Error('Missing owned contract '+id);
  updates.set(id,{id,expectedVersion:old.version,patch:{...(updates.get(id)?.patch??{}),...patch},reason:[updates.get(id)?.reason,reason].filter(Boolean).join('; ')});
 }
 function descriptor(entry){return ref(current.has(entry.id)?entry.id:'@'+entry.id,current.has(entry.id)?current.get(entry.id).version+1:1);}
 function declare(id,name,schema,kind='object',extra={}){
  if(entries.has(id))return entries.get(id);
  const old=current.get(id),entry={id,name:old?.name??name,schema:pruneDefinitions(schema),kind:kind==='object'&&!Object.keys(schema.properties??{}).length?'dictionary':kind,...extra};entries.set(id,entry);
  if(old)change(id,{schema:entry.schema,documentation:(old.documentation??'')+'\n\n23 October 2026 contract correction: '+documentation},'Replace permissive or incomplete known fields with source-backed recursive structural contracts');
  return entry;
 }
 for(const[id,model]of models.entries)declare(id,model.label??model.name,model.schema,model.schema.type??'union',{source:model,});

 function listOf(item){
  if(item.type==='string')return {type:'def_e80efa95bff5',typeVersion:1};
  if(item.type==='number')return {type:'def_9c3eb215c8f4',typeVersion:current.get('def_9c3eb215c8f4').version};
  const itemEntry=entryFor(item),id=listIds[itemEntry.id]??itemEntry.id+'.list';
  const e=declare(id,itemEntry.name+' List',completeSchema({type:'array',items:clone(itemEntry.schema),definitions:clone(itemEntry.schema.definitions??{})}),'array',{itemType:item});return descriptor(e);
 }
 function entryFor(d){const id=d.type.startsWith('@')?d.type.slice(1):d.type;return entries.get(id)??{id,name:current.get(id)?.name??id,schema:current.get(id)?.schema};}
 function nullableOf(base){
  if(nullableScalars[base.type])return ref(nullableScalars[base.type],1);
  if(base.type==='def_e80efa95bff5'){const e=declare('def_732548a778bf','Nullable Text List',completeSchema({anyOf:[{type:'array',items:{type:'string'}},{type:'null'}]}),'nullable',{baseType:base});return descriptor(e);}
  if(base.type===JSON_TYPES.record)return ref('def_3e907b41dc80',1);
  if(base.type===JSON_TYPES.list)return ref('def_ff189562fe7c',1);
  if(base.type===JSON_TYPES.json)return base; // Finite JSON already includes explicit null.
  const target=entryFor(base),id=nullableIds[target.id]??target.id+'.nullable';
  const e=declare(id,'Nullable '+target.name,completeSchema({anyOf:[clone(target.schema),{type:'null'}],definitions:clone(target.schema.definitions??{})}),'nullable',{baseType:base});return descriptor(e);
 }
 function sourceType(name,root){
  const aliases={sdk_ReleaseInterfaces_Demand:'sdk_BuildInterfaces_Demand',sdk_TaskAgentInterfaces_Demand:'sdk_BuildInterfaces_Demand',sdk_ReleaseInterfaces_Issue:'sdk_BuildInterfaces_Issue',sdk_TaskAgentInterfaces_Issue:'sdk_BuildInterfaces_Issue',sdk_TaskAgentInterfaces_TaskAgentPoolReference:'sdk_BuildInterfaces_TaskAgentPoolReference'};
  if(aliases[name])return sourceType(aliases[name],{...root,definitions:{...root.definitions,[aliases[name]]:models.definitions[aliases[name]]}});
  const known=sourceModels.get(name);
  if(known)return descriptor(entries.get(known));
  const schema=root.definitions?.[name]??root.$defs?.[name]??models.definitions[name];if(!schema)throw Error('Missing SDK nested structure '+name);
  if(schema.type==='object'&&!Object.keys(schema.properties??{}).length&&schema.additionalProperties?.$ref?.endsWith('/ONFJsonValue'))return ref(JSON_TYPES.record,1);
  const label=name==='sdk_PipelinesInterfaces_Repository'?'Azure Pipeline Repository':'Azure '+title(name.replace(/^sdk_[A-Za-z]+Interfaces_/,'').replace(/_([a-f0-9]{10})$/,''));
  const id='devops.model.'+name.replace(/^sdk_/,'');
  const e=declare(id,label,{...clone(schema),definitions:clone(root.definitions??models.definitions)},schema.type??'union');
  sourceModels.set(name,id);return descriptor(e);
 }
 function socketFor(schema,root,label,field){
  if(schema.title){const named=[...entries.values()].find(e=>e.name===schema.title);if(named)return descriptor(named);}
  if(schema.$ref){const name=schema.$ref.split('/').at(-1);if(name==='ONFJsonValue')return ref(JSON_TYPES.json,1);return sourceType(name,root);}
  const branches=schema.anyOf??schema.oneOf;
  if(branches){
   const nonnull=branches.filter(s=>s.type!=='null');
   if(nonnull.length===1&&nonnull.length!==branches.length)return nullableOf(socketFor(nonnull[0],root,label,field));
   const id='devops.union.'+slug(schema.title??label+' '+field);
   const name=label==='Azure Work Item Context'&&field==='relations'?'Azure Work Item Relation State':schema.title??label+' '+title(field);
   return descriptor(declare(id,name,{...clone(schema),definitions:clone(root.definitions??{})},'union'));
  }
  if(schema.type==='string'||schema.type==='number'||schema.type==='integer'||schema.type==='boolean')return ref(schema.type==='integer'?'number':schema.type);
  if(Array.isArray(schema.type))return socketFor({anyOf:schema.type.map(type=>({...schema,type}))},root,label,field);
  if(schema.const!==undefined||schema.enum){const values=schema.enum??[schema.const];if(values.every(v=>Array.isArray(v)&&v.every(i=>typeof i==='string')))return ref('def_e80efa95bff5',1);return ref(typeof values[0]==='boolean'?'boolean':typeof values[0]==='number'?'number':'string');}
  if(schema.type==='array')return listOf(socketFor(schema.items,root,label,title(field)+' Item'));
  if(schema.type==='object'){
   if(field==='_links')return descriptor(entries.get('def_41fde3cc1c55'));
   if(field==='fields'&&['Azure Work Item Context','WorkItem','Azure Work Item Revision'].includes(label))return descriptor(entries.get('devops.work-item-fields'));
   if(!Object.keys(schema.properties??{}).length&&schema.additionalProperties?.$ref?.endsWith('/ONFJsonValue'))return ref(JSON_TYPES.record,1);
   const id='devops.structure.'+slug(schema.title??label+' '+field);
   return descriptor(declare(id,schema.title??label+' '+title(field),{...clone(schema),definitions:clone(root.definitions??{})},Object.keys(schema.properties??{}).length?'object':'dictionary'));
  }
  throw Error('No meaningful socket schema for '+label+'.'+field);
 }
 function pairDefinitions(entry){
  const name=entry.name,root=descriptor(entry);
  const base={category:options.category,color:options.color,runtime:'javascript',kind:'node',description:'Lossless '+name+' transformation.',documentation,configSchema:{type:'object',properties:{},additionalProperties:false},inputs:[ctl('exec','Execute')],outputs:[ctl('next','Next')]};
  if(entry.kind==='nullable'){
   return [{...clone(base),name:name+' Encode',inputs:[...base.inputs,port('is_null',ref('boolean'),true),port('value',entry.baseType)],outputs:[...base.outputs,port('value',root,true)],code:"if(typeof inputs.is_null!=='boolean')throw Error('Select explicit null state');if(inputs.is_null){if(Object.hasOwn(inputs,'value'))throw Error('Null has no non-null value');return {value:null};}if(!Object.hasOwn(inputs,'value')||inputs.value===null)throw Error('Non-null value is required');return {value:inputs.value};"},{...clone(base),name:name+' Decode',inputs:[...base.inputs,port('value',root,true)],outputs:[...base.outputs,port('is_null',ref('boolean'),true),port('value',entry.baseType)],code:"return inputs.value===null?{is_null:true}:{is_null:false,value:inputs.value};"}];
  }
  if(entry.kind==='dictionary'){
   const itemType=socketFor(entry.schema.additionalProperties,entry.schema,name,'Entry'),keys=['rest','key','item','count'];
   return [{...clone(base),name:name+' Encode',inputs:[...base.inputs,port('rest',root,true),port('key',ref('string')),port('item',itemType)],outputs:[...base.outputs,port('value',root,true)],code:"const value=Object.fromEntries(Object.entries(inputs.rest));if(Object.hasOwn(inputs,'key')!==Object.hasOwn(inputs,'item'))throw Error('A key and item must be supplied together');if(Object.hasOwn(inputs,'key')){if(Object.hasOwn(value,inputs.key))throw Error('Dictionary key collision');Object.defineProperty(value,inputs.key,{value:structuredClone(inputs.item),enumerable:true,writable:true,configurable:true});}return {value};"},{...clone(base),name:name+' Decode',inputs:[...base.inputs,port('value',root,true),port('key',ref('string'))],outputs:[...base.outputs,port('rest',root,true),port('key',ref('string')),port('item',itemType),port('count',ref('number'),true)],code:"const rest=Object.fromEntries(Object.entries(inputs.value)),key=inputs.key??Object.keys(rest)[0],out={rest,count:Object.keys(rest).length};if(key!==undefined&&Object.hasOwn(rest,key)){out.key=key;out.item=rest[key];delete rest[key];}return out;"}];
  }
  if(entry.kind==='union'){
   const variants=entry.schema.anyOf??entry.schema.oneOf;if(!variants)throw Error('Union lacks alternatives '+entry.id);
   const fields=variants.map((schema,index)=>({id:'variant_'+index,schema:pruneDefinitions({...clone(schema),definitions:clone(entry.schema.definitions??{})}),type:schema.type==='null'?undefined:socketFor(schema,entry.schema,name,'Variant '+(index+1))}));
   const serialized=JSON.stringify(fields.map(({id,schema})=>({id,schema}))),matcher=matchesContract.toString();
   return [{...clone(base),name:name+' Encode',inputs:[...base.inputs,port('variant',ref('string'),true),...fields.filter(f=>f.type).map(f=>port(f.id,f.type))],outputs:[...base.outputs,port('value',root,true)],code:`const fields=${serialized},matchesContract=${matcher};const selected=fields.find(f=>f.id===inputs.variant);if(!selected)throw Error('Unknown union variant');for(const field of fields)if(field!==selected&&Object.hasOwn(inputs,field.id))throw Error('Only one union alternative may be supplied');const value=selected.schema.type==='null'?null:inputs[selected.id];if(!matchesContract(selected.schema,value))throw Error('Invalid union variant value');return {value};`},{...clone(base),name:name+' Decode',inputs:[...base.inputs,port('value',root,true)],outputs:[...base.outputs,port('variant',ref('string'),true),...fields.filter(f=>f.type).map(f=>port(f.id,f.type))],code:`const fields=${serialized},matchesContract=${matcher};const selected=fields.find(f=>matchesContract(f.schema,inputs.value));if(!selected)throw Error('Unsupported union value');return selected.schema.type==='null'?{variant:selected.id}:{variant:selected.id,[selected.id]:inputs.value};`}];
  }
  const fieldTypes=entry.kind==='array'?{}:Object.fromEntries(Object.entries(entry.schema.properties??{}).map(([name,schema])=>[name,socketFor(schema,entry.schema,entry.name,name)]));
  if(entry.kind==='array'&&!entry.itemType)entry.itemType=socketFor(entry.schema.items,entry.schema,name,'Item');
  const rows=makeTypeWithCodecs(entry.id,name,entry.schema,fieldTypes,{...options,documentation,itemType:entry.itemType});
  const result=rows.slice(1).map(row=>row.definition);
  for(const d of result)for(const p of [...d.inputs,...d.outputs])if(p.type==='@'+entry.id)Object.assign(p,root);
  return result;
 }
 function finish(){
  // Growing iteration is deliberate: a nested semantic record/list is declared
  // once, shared by all referring codecs, and receives its own functional pair.
  const generated=new Set();
  for(const entry of entries.values()){
   if(generated.has(entry.id))continue;generated.add(entry.id);
   // Existing Azure Comment field codecs intentionally expose native content/
   // author/details while retaining the exact source path/nullable multipart
   // layout. Their lossless ABI is tested separately; do not derive wrapper
   // variant/part types from that historical transport representation.
   if(entry.id==='def_0cc521d85b7d'||entry.preserveCodec){entry.reusedSpecialCodec=true;continue;}
   const [encode,decode]=pairDefinitions(entry),old=current.get(entry.id);
   const pair=old?[...metadata.values()].filter(m=>m.codec?.mode==='encode').map(m=>({meta:m,encode:current.get(m.definitionId),decode:current.get(m.codec.pairId)})).find(p=>p.encode?.outputs.some(port=>port.id==='value'&&port.type===entry.id)&&p.decode?.inputs.some(port=>port.id==='value'&&port.type===entry.id)):undefined;
   if(old){
    if(pair){for(const [previous,next]of[[pair.encode,encode],[pair.decode,decode]]){const error=previous.outputs.find(p=>p.id==='error'&&p.type==='control');if(error&&!next.outputs.some(p=>p.id==='error'))next.outputs.push(error);change(previous.id,{inputs:next.inputs,outputs:next.outputs,code:next.code,documentation:next.documentation},'Regenerate coherent lossless codecs for the corrected structural contract');}}
    else additions.push({key:entry.id+'.encode',definition:encode,...options,codec:{pairKey:entry.id+'.decode',mode:'encode',name:entry.name}},{key:entry.id+'.decode',definition:decode,...options,codec:{pairKey:entry.id+'.encode',mode:'decode',name:entry.name}});
   }else{
    additions.push({key:entry.id,definition:{name:entry.name,kind:'type',description:'Reusable '+entry.name+' structural contract.',documentation,category:options.category,color:options.color,inputs:[],outputs:[],code:'',schema:entry.schema},...options});
    additions.push({key:entry.id+'.encode',definition:encode,...options,codec:{pairKey:entry.id+'.decode',mode:'encode',name:entry.name}},{key:entry.id+'.decode',definition:decode,...options,codec:{pairKey:entry.id+'.encode',mode:'decode',name:entry.name}});
   }
  }
  return {updates:[...updates.values()],additions,entries,exceptions:models.exceptions};
 }
 return {entries,models,change,declare,descriptor,socketFor,nullableOf,listOf,finish,current};
}
