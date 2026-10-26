// Catalog hardening is applied before dependency resolution/publication. No network effects.
const clone=structuredClone;
const obj=(properties={},required=[],additionalProperties=false)=>({type:'object',properties,required,additionalProperties});
const str={type:'string'},integer={type:'integer'},bool={type:'boolean'};
const arr=items=>({type:'array',items});
const jsonRef={$ref:'#/definitions/ONFJsonValue'};
const jsonObject={type:'object',additionalProperties:jsonRef,description:'Explicit dynamic JSON field dictionary. Keys depend on the selected remote resource or query; values use ONFJsonValue.'};
const jsonDefinition={description:'Opaque JSON Value: null, text, finite JSON number, boolean, recursively typed list or dictionary. Only used for explicitly dynamic payloads and extension fields.',anyOf:[{type:'null'},str,{type:'number'},bool,{type:'array',items:jsonRef},{type:'object',additionalProperties:jsonRef}]};
const identity=obj({id:str,displayName:str,userIdentityType:str,applicationIdentityType:str,tenantId:str},[],true);
const identitySet=obj({user:identity,application:identity,device:identity,conversation:identity},[],true);
const mention=obj({id:{type:'integer',minimum:0},mentionText:str,mentioned:identitySet},['id','mentionText','mentioned'],true);
const cardElement=obj({type:{type:'string',minLength:1},id:str,text:str,title:str,url:str,altText:str,size:str,weight:str,color:str,wrap:bool,isVisible:bool,spacing:str,separator:bool,facts:arr(obj({title:str,value:str},['title','value'])),style:str},['type'],true);
const cardAction=obj({type:{type:'string',minLength:1},id:str,title:str,url:str,verb:str,tooltip:str,isEnabled:bool,associatedInputs:{enum:['auto','none']},data:jsonRef},['type'],true);
const notificationResource=obj({id:str,'@odata.type':str,'@odata.id':str,'@odata.etag':str,webUrl:str},[],true);
const paging=obj({next:obj({after:{type:['string','number']},link:str},[],true),prev:obj({before:{type:['string','number']},link:str},[],true)},[],true);
const associationCollection={type:'object',additionalProperties:obj({results:arr(obj({id:{type:['string','number']},type:str},['id'],true)),paging},['results'],true)};
const providerError=obj({status:str,message:str,category:str,subCategory:str,correlationId:str,id:str,code:str,context:{type:'object',additionalProperties:arr(str)},errors:arr(jsonObject)},[],true);
const dimensionMetadata=obj({apiName:str,uiName:str,description:str,customDefinition:bool,category:str,deprecatedApiNames:arr(str)},[],true);
const metricMetadata=obj({...dimensionMetadata.properties,type:str,expression:str,blockedReasons:arr(str)},[],true);
const reportMetadata=obj({dataLossFromOtherRow:bool,emptyReason:str,subjectToThresholding:bool,currencyCode:str,timeZone:str,schemaRestrictionResponse:obj({activeMetricRestrictions:arr(obj({metricName:str,restrictedMetricTypes:arr(str)},['metricName'],true))},[],true),samplingMetadatas:arr(obj({samplesReadCount:{type:'string',pattern:'^[0-9]+$'},samplingSpaceSize:{type:'string',pattern:'^[0-9]+$'}},[],true))},[],true);
const quotaStatus=obj({consumed:{type:'integer',minimum:0},remaining:{type:'integer',minimum:0}},[],true);
const quota=obj(Object.fromEntries(['tokensPerDay','tokensPerHour','concurrentRequests','serverErrorsPerProjectPerHour','potentiallyThresholdedRequestsPerHour','tokensPerProjectPerHour'].map(k=>[k,quotaStatus])),[],true);
function filterDefinition(original){
 const s=clone(original);delete s.definitions;
 const ref={$ref:'#/definitions/ONFGA4FilterExpression'};
 for(const k of ['andGroup','orGroup'])s.properties[k].properties.expressions.items=ref;
 s.properties.notExpression=ref;
 // Leaf variants are exclusive too; an empty filter object is not a usable request.
 s.properties.filter.oneOf=['stringFilter','inListFilter','numericFilter','emptyFilter'].map(k=>({required:[k]}));
 return s;
}
const isBareObject=s=>s?.type==='object'&&!s.$ref&&!Object.keys(s.properties??{}).length&&!s.patternProperties&&(s.additionalProperties===undefined||s.additionalProperties===true);
const isEmpty=s=>s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).length===0;
/** Resolve every schema locally, including embedded recursion and explicit JSON extension slots. */
export function hardenSchema(input,owner=''){
 const schema=clone(input),defs={};let jsonUsed=false;
 function visit(s,path=[]){
  if(typeof s==='boolean')return s;
  if(!s||typeof s!=='object')throw Error('Invalid schema '+owner+'/'+path.join('/'));
  const field=path.at(-1),pathText=path.join('/');
  if(s.properties?.andGroup&&s.properties?.orGroup&&s.properties?.notExpression&&s.properties?.filter){
   defs.ONFGA4FilterExpression=visitFilter(filterDefinition(s));return {$ref:'#/definitions/ONFGA4FilterExpression'};
  }
  if(isBareObject(s)){
   if(owner==='core.type.sqlResult'&&pathText==='properties/rows/items')s={type:'object',additionalProperties:{anyOf:[str,{type:'number'},{type:'null'},obj({base64:{type:'string',pattern:'^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'}},['base64'])]}};
   if(owner.startsWith('teams.')){
    if(field==='from'||field==='mentioned'||pathText.includes('from/anyOf')||(owner.includes('.from')&&pathText.includes('anyOf')))s=clone(identitySet);
    else if(field==='resourceData')s=clone(notificationResource);
    else if((owner.includes('.mentions')&&field==='items')||(pathText.includes('mentions/')&&field==='items'))s=clone(mention);
    else if((owner.includes('.actions')&&field==='items')||(pathText.includes('actions/')&&field==='items'))s=clone(cardAction);
    else if((owner.includes('.card')||owner.includes('.workflow.payload'))&&field==='items')s=clone(cardElement);
   }
   if(owner.startsWith('hubspot.')){
    if(field==='associations')s=clone(associationCollection);
    else if(field==='paging')s=clone(paging);
    else if(pathText.includes('errors/')&&field==='items')s=clone(providerError);
    else if(field==='provider')s=clone(obj({results:arr(obj({fromObjectId:{type:['string','number']},toObjectId:{type:['string','number']},associationTypes:arr(obj({category:str,typeId:integer,label:{type:['string','null']}},[],true))},[],true))},[],true));
   }
   if(owner.startsWith('ga4.')){
    if(field==='metadata')s=clone(reportMetadata);
    else if(field==='propertyQuota')s=clone(quota);
    else if(field==='dimensionMetadata')s=clone(dimensionMetadata);
    else if(field==='metricMetadata')s=clone(metricMetadata);
   }
   if(isBareObject(s)){jsonUsed=true;return clone(jsonObject);}
  }
  if(owner==='core.type.graphqlResult'&&pathText.endsWith('path/items'))return {type:['string','integer']};
  if(isEmpty(s)){jsonUsed=true;return {...jsonRef,description:'Explicit opaque JSON Value. This field is data-dependent, not a known provider record.'};}
  const out={...s};
  if(out.definitions){for(const[k,v]of Object.entries(out.definitions))defs[k]=visit(v,['definitions',k]);delete out.definitions;}
  if(out.properties){out.properties=Object.fromEntries(Object.entries(out.properties).map(([k,v])=>[k,visit(v,[...path,'properties',k])]));}
  if(out.patternProperties)out.patternProperties=Object.fromEntries(Object.entries(out.patternProperties).map(([k,v])=>[k,visit(v,[...path,'patternProperties',k])]));
  if(out.items)out.items=Array.isArray(out.items)?out.items.map((v,i)=>visit(v,[...path,'items',i])):visit(out.items,[...path,'items']);
  if(out.type==='array'&&!out.items){jsonUsed=true;out.items=clone(jsonRef);out.description??='Explicit dynamically typed JSON list; every element uses ONFJsonValue.';}
  if(out.additionalProperties===true){jsonUsed=true;out.additionalProperties=clone(jsonRef);}
  else if(out.additionalProperties&&typeof out.additionalProperties==='object')out.additionalProperties=visit(out.additionalProperties,[...path,'additionalProperties']);
  for(const key of ['anyOf','oneOf','allOf'])if(out[key])out[key]=out[key].map((v,i)=>visit(v,[...path,key,i]));
  for(const key of ['not','if','then','else','contains'])if(out[key]&&typeof out[key]==='object')out[key]=visit(out[key],[...path,key]);
  return out;
 }
 function visitFilter(s){const result=clone(s);result.properties.filter=visit(result.properties.filter,['filter']);return result;}
 const result=visit(schema);
 // A root XML # reference denotes the complete XML type; keep it intact. Other refs already use names.
 if(jsonUsed||JSON.stringify(result).includes('#/definitions/ONFJsonValue'))defs.ONFJsonValue=clone(jsonDefinition);
 if(Object.keys(defs).length)result.definitions={...(result.definitions??{}),...defs};
 return result;
}
function selfContainedSubschema(schema,root){
 const result=clone(schema),defs=clone(root.definitions??{});
 function rebase(x){if(!x||typeof x!=='object')return;for(const[k,v]of Object.entries(x)){if(k==='$ref'&&v==='#'){x[k]='#/definitions/ONFParentValue';if(!defs.ONFParentValue){const parent=clone(root);defs.ONFParentValue=parent;rebase(parent);}}else if(typeof v==='object')rebase(v);}}
 rebase(result);if(Object.keys(defs).length)result.definitions={...defs,...result.definitions};return result;
}
const genericIds=new Set(['def_c5fc8fea11ea','def_f9962f86c7f4','def_ffc66f61eee4']);
/** Specific codec fields must expose their actual shape instead of generic JSON record/list ports. */
export function hardenCatalog(original){
 const assets=clone(original),added=[],byKey=new Map(assets.map(x=>[x.key,x]));
 for(const item of assets)if(item.definition.kind==='type')item.definition.schema=hardenSchema(item.definition.schema,item.key);
 const knownSchemas=new Map(assets.filter(x=>x.definition.kind==='type').map(x=>[JSON.stringify(x.definition.schema),'@'+x.key]));
 function fieldType(schema,root,source,field){
  const existing=JSON.stringify(schema);
  if(knownSchemas.has(existing))return knownSchemas.get(existing);
  // Plain scalar sockets are already meaningful. Structural constraints remain enforced at the whole-value port.
  if(['string','boolean'].includes(schema.type))return schema.type;
  if(['number','integer'].includes(schema.type))return 'number';
  const standalone=selfContainedSubschema(schema,root),signature=JSON.stringify(standalone);
  if(knownSchemas.has(signature))return knownSchemas.get(signature);
  const key=source.key+'.field.'+field.replace(/[^a-zA-Z0-9]+/g,'.');
  if(byKey.has(key))return '@'+key;
  const name=source.definition.name+' / '+field+' Value';
  const type={key,folder:source.folder,tags:[...source.tags,'typed-field'],definition:{kind:'type',name,description:'Exact '+field+' field of '+source.definition.name+'.',category:source.definition.category,color:'#58afa6',inputs:[],outputs:[],code:'',schema:standalone,documentation:`# ${name}\n\nExact structural field contract extracted from ${source.definition.name}. Optional presence belongs to the containing node socket; null is accepted only when this schema explicitly allows it. Required object fields and list element schemas are checked at runtime. Extension values use the explicit recursive ONFJsonValue vocabulary. This type has pure JSON Encode/Decode codecs.\n\nSchema: \`${JSON.stringify(standalone)}\`.`}};
  added.push(type);byKey.set(key,type);knownSchemas.set(signature,'@'+key);
  for(const direction of ['encode','decode'])added.push({key:key+'.'+direction,folder:source.folder.replace(/Types$/,'Codecs'),tags:[...source.tags.filter(t=>t!=='type'),'codec',direction,'typed-field'],definition:{kind:'node',name:(direction==='encode'?'Encode ':'Decode ')+name+' JSON',description:'Pure JSON text codec for '+name+'.',category:source.definition.category,color:'#58afa6',runtime:'javascript',inputs:direction==='encode'?[{id:'text',name:'JSON text',type:'string',required:true}]:[{id:'value',name:'Value',type:'@'+key,typeVersion:1,required:true}],outputs:direction==='encode'?[{id:'value',name:'Value',type:'@'+key,typeVersion:1,required:true}]:[{id:'text',name:'JSON text',type:'string',required:true}],configSchema:obj(),code:direction==='encode'?'return {value:JSON.parse(inputs.text)};':'return {text:JSON.stringify(inputs.value)};',documentation:`# ${direction==='encode'?'Encode':'Decode'} ${name} JSON\n\nPure transformation with no network, secret lookup or persistence. ${direction==='encode'?'Required text input is parsed and returned through the exact typed value output; invalid JSON or schema data fails.':'Required exact typed value input is serialized to JSON text; optional fields, explicit null, ordering and provider remainder values are preserved.'} Configure no fields. Errors throw to the error control path. Use the matching opposite-direction codec for a lossless roundtrip. Exact immutable type pins are retained.`}});
  return '@'+key;
 }
 for(const item of assets){
  const d=item.definition;if(d.kind==='type')continue;
  const valuePort=[...d.inputs,...d.outputs].find(p=>p.id==='value'&&p.type.startsWith('@')&&byKey.get(p.type.slice(1))?.definition.kind==='type');
  if(!valuePort)continue;
  const source=byKey.get(valuePort.type.slice(1)),root=source.definition.schema;
  for(const p of [...d.inputs,...d.outputs]){
   if(p===valuePort)continue;
   if(['remainder','json','text','value'].includes(p.id)&&p.id!=='value')continue;
   if(p.type==='control')continue;
   if(p.id==='value'&&root.type==='object'&&root.additionalProperties&&Object.keys(root.properties??{}).length===0){p.type=valuePort.type;p.typeVersion=1;continue;}
   const schema=root.properties?.[p.id]??(p.id==='item'?root.items:undefined);
   if(!schema)continue;
   // Keep useful scalar sockets where codecs deliberately retain explicit provider null in remainder.
   if(['string','number','boolean'].includes(p.type))continue;
   p.type=fieldType(schema,root,source,p.id);if(p.type.startsWith('@'))p.typeVersion=1;
  }
 }
 const semantic=(nodeKey,portId,schema,name,direction='inputs')=>{
  const item=byKey.get(nodeKey);if(!item)return;
  const source={key:nodeKey+'.contract',folder:item.folder.replace(/Operations$/,'Types'),tags:[...item.tags,'type'],definition:{name,category:item.definition.category}};
  const complete=hardenSchema(schema,nodeKey),type=fieldType(complete,complete,source,portId);
  const p=item.definition[direction].find(p=>p.id===portId);if(!p)throw Error('Missing semantic port '+nodeKey+'/'+portId);p.type=type;p.typeVersion=1;
 };
 semantic('core.json.patch','operations',arr({oneOf:[obj({op:{const:'remove'},path:str},['op','path']),obj({op:{enum:['add','replace','test']},path:str,value:jsonRef},['op','path','value'])]}),'JSON Patch Operations');
 semantic('core.collections.select','fields',{type:'object',additionalProperties:{type:'string',pattern:'^(?:$|/)'}},'Collection Projection Paths');
 semantic('core.collections.group','groups',{type:'object',additionalProperties:arr(jsonRef)},'Grouped JSON Collections','outputs');
 const sql=byKey.get('core.type.sql').definition.schema;
 semantic('core.sqlite.transaction','statements',{type:'array',items:sql,maxItems:100},'SQLite Statement List');
 // Public subflow boundaries must follow the exact newly selected inner socket contracts.
 for(const item of assets.filter(x=>x.definition.subflow))for(const direction of ['inputs','outputs']){
  for(const binding of item.definition.subflow[direction]){
   const node=item.definition.subflow.nodes.find(n=>n.id===binding.nodeId),inner=byKey.get(node.definitionId.slice(1)).definition[direction].find(p=>p.id===binding.handleId);
   const boundary=item.definition[direction].find(p=>p.id===binding.portId);if(!inner||!boundary)throw Error('Missing subflow boundary '+item.key);
   boundary.type=inner.type;if(inner.typeVersion)boundary.typeVersion=inner.typeVersion;else delete boundary.typeVersion;
  }
 }
 for(const item of [...assets,...added]){
  const d=item.definition;
  if(added.includes(item)&&d.kind==='node'){
   d.inputs.unshift({id:'exec',name:'Execute',type:'control'});
   d.outputs.unshift({id:'next',name:'Next',type:'control'});
   d.outputs.push({id:'error',name:'On error',type:'control'});
  }
  // Book help must be useful without opening a source package or guessing implicit defaults.
  const ports=(direction)=>d[direction].filter(p=>p.type!=='control').map(p=>`- \`${p.id}\`: \`${p.type}\`; ${p.required?'required':'optional (absent stays absent)'}.${p.description?' '+p.description:''}`).join('\n')||'No data sockets.';
  const configs=Object.entries(d.configSchema?.properties??{}).map(([k,v])=>`- \`${k}\`: ${v.type??(v.enum?'enumeration':'structured value')}${Object.hasOwn(v,'default')?'; default '+JSON.stringify(v.default):'; no automatic default'}${v.description?'. '+v.description:''}`).join('\n')||'No asset-specific configuration.';
  d.documentation=(d.documentation??'').replace(/Schema: `[^`]*`\.?/g,'').trim()+`\n\n## Audited socket contract (21 October 2026)\n\nInputs:\n${ports('inputs')}\n\nOutputs:\n${ports('outputs')}\n\nConfiguration:\n${configs}\n\nKnown provider records and list elements have structural schemas. Explicit dynamic payloads, selected query results and provider extensions retain the recursive JSON Value vocabulary; they do not imply a known provider entity. Null is distinct from omission. Runtime validates the exact selected immutable type version; reading newer documentation never repins existing graphs. This audit used synthetic fixtures/local mocks and does not establish live provider authorization or delivery.`;
  if(d.kind==='type')d.documentation+=`\n\nAuthoritative JSON Schema:\n\n\`\`\`json\n${JSON.stringify(d.schema,null,2)}\n\`\`\``;
 }
 return [...assets,...added];
}
