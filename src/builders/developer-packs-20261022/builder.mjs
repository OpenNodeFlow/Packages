import {createHash} from 'node:crypto';
import {JSON_TYPES,completeSchema,s,i,b} from './schema.mjs';
import {operationCode} from './runtime.mjs';

export const idFor=key=>'def_'+createHash('sha256').update('developer-packs-20261022:'+key).digest('hex').slice(0,12);
export const packIdFor=family=>family.packId??'pack_'+family.id.replaceAll('-','_');
const title=text=>text.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const controls={exec:{id:'exec',name:'Execute',type:'control'},next:{id:'next',name:'Next',type:'control'},error:{id:'error',name:'On error',type:'control'}};
const primitives=new Set(['string','number','boolean','control']);
const external=type=>{const m=type.match(/^@id:([^:]+):(\d+)$/);return m?{type:m[1],typeVersion:Number(m[2])}:null;};
function ref(type,family){
  if(primitives.has(type))return {type};
  if(JSON_TYPES[type])return{type:JSON_TYPES[type],typeVersion:1};
  if(external(type))return external(type);
  const text=type.startsWith('@')?type.slice(1):family+'.'+type;
  return{type:'@dev.'+text.split('.').slice(0,1).join('.')+'.type.'+text.split('.').slice(1).join('.'),typeVersion:1};
}
const port=(id,type,family,required=false,description)=>({id,name:title(id),...ref(type,family),...(required?{required:true}:{}),...(description?{description}:{})});
function fieldType(schema){
  const type=schema.type;
  if(Array.isArray(type)&&type.includes('null')&&type.length===2){const key=type.find(t=>t!=='null'),nullable={string:'def_a653164ce2cf',boolean:'def_23b3031131b2',number:'def_a5280518223d',integer:'def_a5280518223d',object:'def_3e907b41dc80',array:'def_ff189562fe7c'};if(nullable[key])return '@id:'+nullable[key]+':1';}
  return type==='string'?'string':['integer','number'].includes(type)?'number':type==='boolean'?'boolean':type==='object'?'record':type==='array'?'list':'json';
}
export const nodeConfig=()=>({type:'object',properties:{baseUrl:s({maxLength:2000}),allowHttp:b({default:false}),tokenSecret:s({maxLength:120}),username:s({maxLength:160}),usernameSecret:s({maxLength:120}),passwordSecret:s({maxLength:120}),requestTimeoutMs:i({minimum:100,maximum:120000,default:15000}),maxBytes:i({minimum:1024,maximum:3000000,default:1048576}),maxPages:i({minimum:1,maximum:20,default:1}),maxItems:i({minimum:1,maximum:5000,default:1000}),confirmWrites:b({default:false})},additionalProperties:true});
const baseDefinition=(key,name,kind,stamp,color)=>({id:idFor(key),version:1,name,kind,category:'Developer integrations',color:color??'#58afa6',runtime:'javascript',inputs:[],outputs:[],configSchema:{type:'object',properties:{},additionalProperties:false},code:'',description:name,documentation:'',createdAt:stamp,updatedAt:stamp});
const withControls=d=>({...d,inputs:[controls.exec,...d.inputs],outputs:[controls.next,...d.outputs,controls.error]});

export function buildDeveloperCatalog(families,{stamp='2026-10-22T00:00:00.000Z'}={}){
  const rows=[],pairs=[],keys=new Set(),typeRegistry=new Map();
  const add=(key,d,family,role)=>{if(keys.has(key))throw new Error('Duplicate developer key '+key);keys.add(key);rows.push({key,definition:d,packId:packIdFor(family),familyId:family.id,folder:family.name,tags:[...new Set(['developer-packs',family.id,role])].sort()});};
  const declarations=new Map(families.map(f=>[f.id,new Map((f.types??[]).map(t=>[t.key,t]))]));
  // Only reused resource/list shapes become named types; no nested-field derivation pass.
  for(const family of families){
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(family.id))throw new Error('Invalid family id');
    for(const operation of family.operations){
      const response=operation.response;
      if(['item','list'].includes(response.kind)&&!response.type)throw new Error('Resource type missing '+family.id+'.'+operation.key);
      if(response.kind==='list'&&!response.type.startsWith('@id:')){
        const [owner,itemKey]=response.type.startsWith('@')?response.type.slice(1).split('.'):[family.id,response.type];
        const declared=declarations.get(owner);if(!declared)throw new Error('Missing resource family '+owner);
        const key=itemKey+'-list';if(!declared.has(key)){const item=declared.get(itemKey);if(!item)throw new Error('Missing resource '+response.type);declared.set(key,{key,name:item.name+' List',schema:{type:'array',items:item.schema,maxItems:5000,...(item.schema.definitions?{definitions:item.schema.definitions}:{})},itemType:'@'+owner+'.'+itemKey});}
      }
    }
  }
  for(const family of families){
    const declared=declarations.get(family.id);
    for(const type of declared.values()){
      const key='dev.'+family.id+'.type.'+type.key,schema=completeSchema(type.schema),d=baseDefinition(key,type.name,'type',stamp,family.color);
      d.schema=schema;d.description='Reusable '+type.name+' contract.';d.documentation=`${type.name} preserves known provider fields and explicit JSON extensions. It is shared across the ${family.name} operations that use this resource. Optional absence and explicit null are distinct.\n\nSchema:\n\n\`\`\`json\n${JSON.stringify(schema,null,2)}\n\`\`\`\n\nSource: ${(family.sources??[]).join(' ')}\n\nPure type; no credentials or external effects.`;
      add(key,d,family,'type');typeRegistry.set(family.id+'.'+type.key,{...type,schema,key});
    }
  }
  for(const family of families){
    for(const [typeKey,type]of typeRegistry){
      if(!typeKey.startsWith(family.id+'.'))continue;
      const key=type.key,fullType='@'+typeKey;
      const encode=baseDefinition(key+'.encode',type.name+' Encode','node',stamp,family.color),decode=baseDefinition(key+'.decode',type.name+' Decode','node',stamp,family.color);
      if(type.schema.type==='array'){
        if(!type.itemType)continue;
        const itemType=type.itemType.startsWith('@')?type.itemType:'@'+family.id+'.'+type.itemType;
        encode.inputs=[port('rest',fullType,family.id,true),port('item',itemType,family.id),port('index','number',family.id)];encode.outputs=[port('value',fullType,family.id,true)];
        encode.code="const rest=structuredClone(inputs.rest),index=inputs.index??0;if(!Number.isSafeInteger(index)||index<0||index>rest.length)throw new Error('Index outside list bounds');if(Object.hasOwn(inputs,'item'))rest.splice(index,0,inputs.item);return {value:rest};";
        decode.inputs=[port('value',fullType,family.id,true),port('index','number',family.id)];decode.outputs=[port('rest',fullType,family.id,true),port('item',itemType,family.id),port('index','number',family.id,true),port('count','number',family.id,true)];
        decode.code="const rest=structuredClone(inputs.value),index=inputs.index??0,count=rest.length;if(!Number.isSafeInteger(index)||index<0||(count?index>=count:index!==0))throw new Error('Index outside list bounds');const out={rest,index,count};if(count)out.item=rest.splice(index,1)[0];return out;";
      }else if(type.schema.type==='object'){
        const fields=Object.keys(type.schema.properties??{}),required=new Set(type.schema.required??[]),fieldTypes=Object.fromEntries(fields.map(field=>[field,type.fieldTypes?.[field]??fieldType(type.schema.properties[field])]));
        if(!fields.length)throw new Error('Resource type has no meaningful fields '+typeKey);
        const reserved=new Set(['exec','next','error','remainder','__proto__','prototype','constructor']),used=new Set([...fields.filter(f=>!reserved.has(f)),...reserved]);
        const fieldPorts=Object.fromEntries(fields.map(field=>{if(!reserved.has(field))return[field,field];let alias='field_'+field;while(used.has(alias))alias='field_'+alias;used.add(alias);return[field,alias];}));
        encode.inputs=[...fields.map(field=>port(fieldPorts[field],fieldTypes[field],family.id,required.has(field))),port('remainder','record',family.id)];encode.outputs=[port('value',fullType,family.id,true)];
        encode.code=`const fields=${JSON.stringify(fields)},ports=${JSON.stringify(fieldPorts)},remainder=inputs.remainder??{};for(const key of Object.keys(remainder))if(fields.includes(key))throw new Error('Remainder collides with a declared field');const entries=Object.entries(remainder);for(const key of fields)if(Object.hasOwn(inputs,ports[key]))entries.push([key,inputs[ports[key]]]);return {value:Object.fromEntries(entries)};`;
        decode.inputs=[port('value',fullType,family.id,true)];decode.outputs=[...fields.map(field=>port(fieldPorts[field],fieldTypes[field],family.id,required.has(field))),port('remainder','record',family.id,true)];
        decode.code=`const fields=${JSON.stringify(fields)},ports=${JSON.stringify(fieldPorts)},out=Object.create(null);for(const key of fields)if(Object.hasOwn(inputs.value,key))out[ports[key]]=inputs.value[key];out.remainder=Object.fromEntries(Object.entries(inputs.value).filter(([key])=>!fields.includes(key)));return out;`;
      }else continue;
      for(const d of [encode,decode]){d.description=(d===encode?'Assemble ':'Expand ')+type.name+' without losing unknown fields.';d.documentation=`${d.description}\n\nInputs: ${d.inputs.map(p=>p.id+(p.required?' (required)':' (optional)')).join(', ')}. Outputs: ${d.outputs.map(p=>p.id).join(', ')}.\n\nPure transformation; no provider requests, persistent state or credentials. Record codecs reject remainder collisions with declared fields. Missing optional fields stay absent; explicit null follows the pinned schema. List codecs select/reinsert one item at index; an empty list omits item and requires index zero. Connect only optional outputs present for your case.\n\nUses the exact shared ${type.name} version. Encode output validates the complete resource schema; scalar codec ports do not weaken it.`;add(d.id===encode.id?key+'.encode':key+'.decode',withControls(d),family,'codec');}
      pairs.push({encodeId:encode.id,decodeId:decode.id,name:type.name});
    }
    for(const operation of family.operations){
      const key='dev.'+family.id+'.'+operation.key,d=baseDefinition(key,family.name+' '+operation.name,'node',stamp,family.color);
      if(!operation.sampleInputs||!Object.hasOwn(operation,'sampleResponse'))throw new Error('Missing synthetic sample '+key);
      if(!['read','write','delete'].includes(operation.effect))throw new Error('Missing effect '+key);
      // Required arguments may be supplied by the selected profile/node defaults.
      // ONF validates ports before code runs, so enforce presence in runtime instead.
      d.inputs=Object.entries(operation.inputs??{}).map(([id,descriptor])=>({...port(id,descriptor.type,family.id,false,descriptor.description),required:false}));
      if(operation.paging&&!d.inputs.some(p=>p.id==='continuation'))d.inputs.push(port('continuation','string',family.id));
      const response=operation.response;
      d.outputs=[port('status','number',family.id,true),port('request_id','string',family.id),port('operation_url','string',family.id)];
      if(response.kind==='item')d.outputs.push(port('item',response.type,family.id,!response.optional));
      else if(response.kind==='list'){d.outputs.push(port('items',response.listType??(response.type.startsWith('@id:')?'list':response.type+'-list'),family.id,true),port('count','number',family.id,true),port('has_more','boolean',family.id,true),port('continuation','string',family.id));}
      else if(response.kind==='json')d.outputs.push(port('value','json',family.id,true));
      else if(response.kind==='text')d.outputs.push(port('text','string',family.id,true));
      else if(response.kind!=='empty')throw new Error('Unknown response kind '+key);
      for(const id of Object.keys(response.select??{}))d.outputs.push(port(id,response.selectTypes?.[id]??'string',family.id));
      for(const id of Object.keys(response.headerSelect??{}))d.outputs.push(port(id,'string',family.id));
      if(new Set(d.outputs.map(p=>p.id)).size!==d.outputs.length)throw new Error('Duplicate output '+key);
      d.configSchema=nodeConfig();d.description=operation.description;
      // Samples/research do not need to travel inside executable code.
      const runtimeOperation=structuredClone(operation);for(const k of ['sampleInputs','sampleResponse','sampleHeaders','source','scopes','description','notes'])delete runtimeOperation[k];
      const runtimeFamily={id:family.id,name:family.name,baseUrl:family.baseUrl,auth:family.auth};
      d.code=operationCode(runtimeFamily,runtimeOperation);
      d.documentation=`${operation.description}\n\n${operation.method} ${operation.path}. ${operation.effect==='read'?'Read operation.':'External '+operation.effect+' action; set confirmWrites=true and $retries=0 deliberately.'}\n\nInputs: ${d.inputs.map(p=>p.id+(p.required?' (required)':' (optional)')).join(', ')}. Missing inputs may come from the selected connection profile config or explicit node defaults. Outputs: ${d.outputs.map(p=>p.id).join(', ')}. Optional outputs are absent when the provider omits them. HTTP202 is acceptance, not completed work; operation_url exposes a same-origin asynchronous status URL when supplied.\n\nSetup: configure baseUrl (${family.baseUrl}), ${family.auth?.kind??'none'} credentials through encrypted secret names or Connections. Default secret name: ${family.auth?.secret??'none'}. Connection credentials accessToken/apiKey or username/password are resolved at execution. Never put credentials in literal inputs, baseUrl or logs. Required access: ${operation.scopes??'Provider permission for this operation.'}\n\nBounds: requestTimeoutMs=15000 (100..120000), maxBytes=1048576 (1024..3000000), maxItems=1000 (1..5000), maxPages=1 (1..20). ${operation.paging?'Follow bounded provider continuation or pass continuation to fetch the next page. has_more reports an unconsumed continuation.':'One bounded request; use the provider-specific explicit paging inputs where offered.'} HTTPS is required; private HTTP needs allowHttp=true. TLS validation remains enabled. Redirects, cross-origin/escaped continuation URLs and repeated continuations fail. No implicit retries. Error text contains provider/status only, never raw response bodies or credentials. Reconcile an uncertain external action before another attempt.\n\nSynthetic example inputs:\n\n\`\`\`json\n${JSON.stringify(operation.sampleInputs,null,2)}\n\`\`\`\n\nThis example is documentation, not a run. ${operation.notes??''}\n\nSource: ${operation.source??family.sources?.join(' ')??''}`;
      add(key,withControls(d),family,operation.effect==='read'?'read':'action');
    }
  }
  return{rows,pairs,packs:families.map(f=>({id:packIdFor(f),name:f.name,description:f.description,color:f.color??'#58afa6',icon:f.icon??'Package'}))};
}
