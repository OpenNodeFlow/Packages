import { createHash } from 'node:crypto';
import { makeTypeWithCodecs, ref, JSON_TYPES, completeSchema } from '../common.mjs';
import { matchesJsonSchema } from '../schema-match.mjs';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,12);
const clone=value=>structuredClone(value);
const words=value=>value.replace(/^io\.k8s\./,'').split('.').at(-1).replace(/([a-z\d])([A-Z])/g,'$1 $2').replaceAll(/[-_]/g,' ');
const jsonRef={$ref:'#/definitions/ONFJsonValue'};
export function resolveSchema(schema,definitions,seen=new Set()) {
  if(schema?.$ref?.startsWith('#/definitions/')&&!schema.$ref.endsWith('/ONFJsonValue')){
    const key=schema.$ref.slice(14);if(seen.has(key))return schema;
    if(!definitions[key])throw Error('Unresolved local type '+key);
    return resolveSchema(definitions[key],definitions,new Set([...seen,key]));
  }
  if(schema?.allOf){
    const parts=schema.allOf.map(part=>resolveSchema(part,definitions,seen)),out={...schema};delete out.allOf;
    for(const part of parts){
      if(part.type)out.type??=part.type;
      if(part.properties)out.properties={...part.properties,...out.properties};
      if(part.required)out.required=[...new Set([...(out.required??[]),...part.required])];
    }
    out.allOf=schema.allOf;
    return out.properties||out.type?out:parts.length===1?{...parts[0],...out}:schema;
  }
  return schema;
}
function compact(node,context='schema'){
  if(node===null||typeof node!=='object')return node;
  if(Array.isArray(node))return node.map(value=>compact(value,context));
  const out={};for(const[key,value]of Object.entries(node)){
    if(context==='schema'&&['description','title','default','example','examples'].includes(key))continue;
    out[key]=compact(value,['properties','patternProperties','definitions','$defs'].includes(key)?'map':context==='map'?'schema':context);
  }return out;
}
export function closeSchema(schema,definitions={}){
  const selected=compact(schema),needed={},visiting=new Set();delete selected.definitions;
  function visit(node){
    if(!node||typeof node!=='object')return;
    if(node.$ref?.startsWith('#/definitions/')){const key=node.$ref.slice(14);if(key!=='ONFJsonValue'&&!visiting.has(key)){visiting.add(key);if(!definitions[key])throw Error('Unknown definition '+key);needed[key]=compact(definitions[key]);visit(needed[key]);}}
    for(const value of Object.values(node))if(value&&typeof value==='object')Array.isArray(value)?value.forEach(visit):visit(value);
  }
  visit(selected);return completeSchema({...selected,definitions:needed});
}
const controls={exec:{id:'exec',name:'Execute',type:'control'},next:{id:'next',name:'Next',type:'control'}};
const port=(id,descriptor,required=false)=>({id,name:words(id),...(typeof descriptor==='string'?ref(descriptor):descriptor),...(required?{required:true}:{})});
export class ContractGraph {
  constructor(snapshot){this.snapshot=snapshot;this.entries=new Map();this.additions=[];this.updates=[];this.dynamic=[];this.existing=new Map();this.existingAssignments=new Map();this.schemas=new Map();this.expanded=new Set();}
  assign(identity,definition){this.existingAssignments.set(identity,definition);this.expanded.add(identity);}
  identity(schema,context){
    if(schema.$ref&&!schema.$ref.endsWith('/ONFJsonValue'))return 'source.'+schema.$ref.slice(14);
    return context.family+'.'+(context.semanticName??context.name).replaceAll(/[^a-zA-Z0-9]+/g,'-')+'.'+digest(compact(schema));
  }
  descriptor(schema,context){
    const definitions=context.definitions??{};
    if(schema?.$ref?.endsWith('/ONFJsonValue')){this.dynamic.push({path:context.name,reason:'Explicit finite heterogeneous JSON extension value'});return ref(JSON_TYPES.json,1);}
    const resolved=resolveSchema(schema,definitions);
    if(!resolved?.type&&resolved?.enum?.length&&resolved.enum.every(value=>typeof value===typeof resolved.enum[0])){const type=typeof resolved.enum[0];if(['string','number','boolean'].includes(type))return ref(type);}
    if(['string','number','integer','boolean'].includes(resolved?.type))return ref(resolved.type==='integer'?'number':resolved.type);
    if(resolved?.type==='array'&&!Array.isArray(resolved.items)){
      const item=resolveSchema(resolved.items,definitions),name={string:'Text List',number:'Number List',integer:'Number List',boolean:'Boolean List'}[item?.type];
      const canonical=name&&this.snapshot.definitions.find(d=>d.kind==='type'&&d.name===name);
      if(canonical)return ref(canonical.id,canonical.version);
    }
    const nullable=resolved?.anyOf??resolved?.oneOf;
    if(nullable?.length===2&&nullable.some(p=>resolveSchema(p,definitions).type==='null')){
      const present=resolveSchema(nullable.find(p=>resolveSchema(p,definitions).type!=='null'),definitions),name={string:'Nullable String',number:'Nullable Number',integer:'Nullable Number',boolean:'Nullable Boolean'}[present?.type];
      const canonical=name&&this.snapshot.definitions.find(d=>d.kind==='type'&&d.name===name);
      if(canonical)return ref(canonical.id,canonical.version);
    }
    if(resolved?.type==='null')return this.ensure(schema,{...context,name:context.name+' Null'});
    if(resolved?.type==='object'&&!Object.keys(resolved.properties??{}).length&&(!resolved.additionalProperties||resolved.additionalProperties===true||resolved.additionalProperties.$ref?.endsWith('/ONFJsonValue'))){this.dynamic.push({path:context.name,reason:'Provider extension/plugin/scope dictionary has intentionally unspecified heterogeneous fields'});return ref(JSON_TYPES.record,1);}
    return this.ensure(schema,context);
  }
  ensure(schema,context){
    const identity=context.identity??this.identity(schema,context);
    if(this.entries.has(identity))return this.entries.get(identity).ref;
    const definitions=context.definitions??{},resolved=resolveSchema(schema,definitions),closed=closeSchema(resolved,definitions);
    const existing=this.existingAssignments.get(identity),key='audit.cloud-infra.'+context.family+'.'+digest(identity),typeRef=existing?ref(existing.id,existing.version+1):ref('@'+key,1);
    let name=existing?.name??context.displayName??(context.providerDisplayName??words(context.family))+' '+words(context.name);
    const origin=schema.$ref&&context.originNames?.[schema.$ref.slice(14)];
    if(!existing&&!context.displayName&&origin)name=(origin.url.includes('/common-types/resource-management/')?'Azure':context.providerDisplayName??words(context.family))+' '+words(origin.name);
    if(!existing)name=name.replaceAll(/\bItem\b\s*/g,'').replace(/\b(\w+)\s+\1\b/gi,'$1').replace(/\s+/g,' ').replace(/\b[a-z]/g,c=>c.toUpperCase()).trim();
    if(!existing&&name==='Azure Identity')name='Azure Managed Identity';
    if(name.length>104)name=name.slice(0,35)+' … '+name.slice(-51)+' '+digest(identity).slice(0,6);
    const sameName=[...this.entries.values()].find(entry=>entry.name===name);
    if(sameName)name=name.slice(0,96)+' '+digest(identity).slice(0,6);
    const entry={identity,key,name,schema:closed,ref:typeRef,context,existing};
    this.entries.set(identity,entry);this.schemas.set(typeRef.type,closed);
    const options={packId:context.packId,folderId:context.folderId,tags:['contract-audit','typed',context.family],documentation:`${entry.name}. Known fields follow the published provider contract; optional absence, explicit null and numeric/string precision are preserved. Unknown provider extensions roundtrip without replacing known field schemas.\n\nSource: ${context.source}\n\nNo provider requests, credentials or persistent state.`};
    const nested=(part,name)=>{const role=name.slice(context.name.length).trim();return this.descriptor(part,{...context,name,semanticName:role==='Item'?(context.semanticName??context.name)+' Item':role,identity:undefined,displayName:undefined,itemRef:undefined,serializationOnly:true});};
    let rows;
    if(context.serializationOnly&&!existing&&!this.expanded.has(identity))rows=this.serialization(entry,options);
    else if(resolved.type==='object'&&Object.keys(resolved.properties??{}).length){
      const fieldTypes=Object.fromEntries(Object.entries(resolved.properties).map(([field,part])=>[field,nested(part,context.name+' '+field)]));
      rows=makeTypeWithCodecs(key,entry.name,closed,fieldTypes,options);
    } else if(resolved.type==='array'&&!Array.isArray(resolved.items)&&!(resolved.minItems>0)) {
      const itemType=context.itemRef??nested(resolved.items??jsonRef,context.name+' Item');
      rows=makeTypeWithCodecs(key,entry.name,closed,{}, {...options,itemType});
    } else rows=this.special(entry,resolved,nested,options);
    if(existing){
      const replace=value=>{if(!value||typeof value!=='object')return value;if(Array.isArray(value))return value.map(replace);const out=Object.fromEntries(Object.entries(value).map(([key,v])=>[key,v==='@'+entry.key?existing.id:replace(v)]));if(value.type==='@'+entry.key)out.typeVersion=existing.version+1;return out;};
      const typePatch={schema:closed,documentation:rows[0].definition.documentation};
      this.updates.push({id:existing.id,expectedVersion:existing.version,patch:typePatch,reason:'Replace known provider fields and nested contracts using the current official success schema'});
      for(const row of rows.slice(1)){
        const mode=row.codec.mode;
        const metadata=this.snapshot.library.assets.find(m=>m.codec?.mode===mode&&this.snapshot.definitions.find(d=>d.id===m.definitionId)?.[mode==='encode'?'outputs':'inputs']?.some(p=>p.type===existing.id&&p.id==='value'));
        const old=this.snapshot.definitions.find(d=>d.id===metadata?.definitionId);
        if(!old)throw Error('Existing structural type has no reciprocal codec '+existing.name+' '+mode);
        this.updates.push({id:old.id,expectedVersion:old.version,patch:replace(row.definition),reason:'Functional codec exposes the strengthened structural fields at the next exact parent pin'});
      }
    }else this.additions.push(...rows);
    return typeRef;
  }
  serialization(entry,options){
    const {key,name}=entry,base={category:'Integration contracts',color:'#58afa6',runtime:'javascript',configSchema:{type:'object',properties:{},additionalProperties:false}};
    const documentation=options.documentation+'\n\nSerialization boundary: all nested known fields, local references and constraints remain in this complete schema. Encode parses a bounded JSON text into this exact structural value; Decode serializes the typed value. No recursively generated field/scalar helper catalog is required. Missing optional members and explicit null roundtrip exactly.';
    return [{key,definition:{name,kind:'type',description:name+' structural provider contract.',documentation,category:base.category,color:base.color,inputs:[],outputs:[],code:'',schema:entry.schema},packId:options.packId,folderId:options.folderId,tags:options.tags},
      {key:key+'.encode',definition:{...base,name:name+' Encode',kind:'node',description:'Parse JSON into '+name+'.',documentation,inputs:[controls.exec,port('text','string',true)],outputs:[controls.next,port('value',entry.ref,true)],code:"if(inputs.text.length>3000000)throw Error('JSON text exceeds codec bound');let value;try{value=JSON.parse(inputs.text);}catch{throw Error('Invalid JSON text');}return {value};"},packId:options.packId,folderId:options.folderId,tags:options.tags,codec:{pairKey:key+'.decode',mode:'encode',name}},
      {key:key+'.decode',definition:{...base,name:name+' Decode',kind:'node',description:'Serialize '+name+' to JSON.',documentation,inputs:[controls.exec,port('value',entry.ref,true)],outputs:[controls.next,port('text','string',true)],code:"const text=JSON.stringify(inputs.value);if(text.length>3000000)throw Error('JSON text exceeds codec bound');return {text};"},packId:options.packId,folderId:options.folderId,tags:options.tags,codec:{pairKey:key+'.encode',mode:'decode',name}}];
  }
  special(entry,schema,nested,options){
    const {key,name}=entry,base={category:'Integration contracts',color:'#58afa6',runtime:'javascript',configSchema:{type:'object',properties:{},additionalProperties:false}};
    const encode={...base,name:name+' Encode',kind:'node',description:'Assemble '+name+' without losing optional/null/extension data.',inputs:[controls.exec],outputs:[controls.next,port('value',entry.ref,true)]};
    const decode={...base,name:name+' Decode',kind:'node',description:'Expand '+name+' using its actual provider value shape.',inputs:[controls.exec,port('value',entry.ref,true)],outputs:[controls.next]};
    if(schema.type==='object'){
      const item=nested(schema.additionalProperties??jsonRef,entry.context.name+' Entry');
      encode.inputs.push(port('rest',entry.ref,true),port('key','string'),port('item',item));
      decode.inputs.push(port('key','string'));decode.outputs.push(port('rest',entry.ref,true),port('key','string'),port('item',item),port('count','number',true));
      encode.code="const out=structuredClone(inputs.rest);if(Object.hasOwn(inputs,'key')!==Object.hasOwn(inputs,'item'))throw Error('Dictionary key and item must be supplied together');if(Object.hasOwn(inputs,'key')){if(Object.hasOwn(out,inputs.key))throw Error('Dictionary key collision');Object.defineProperty(out,inputs.key,{value:inputs.item,enumerable:true,writable:true,configurable:true});}return {value:out};";
      decode.code="const rest=structuredClone(inputs.value),keys=Object.keys(rest),out={rest,count:keys.length},key=inputs.key??keys[0];if(key!==undefined){if(!Object.hasOwn(rest,key))throw Error('Dictionary key is absent');out.key=key;out.item=rest[key];delete rest[key];}return out;";
    } else if(schema.type==='array'&&Array.isArray(schema.items)){
      const fields=schema.items.map((part,index)=>({id:'item_'+index,descriptor:nested(part,entry.context.name+' Position '+index),required:index<(schema.minItems??0)}));
      for(const field of fields){encode.inputs.push(port(field.id,field.descriptor,field.required));decode.outputs.push(port(field.id,field.descriptor,field.required));}
      const rest=this.descriptor({type:'array',items:typeof schema.additionalItems==='object'?schema.additionalItems:jsonRef},{...entry.context,name:entry.context.name+' Additional Positions',identity:undefined});
      if(schema.additionalItems!==false){encode.inputs.push(port('rest',rest));decode.outputs.push(port('rest',rest,true));}
      encode.code=`const value=[];let gap=false;for(let index=0;index<${fields.length};index++){if(Object.hasOwn(inputs,'item_'+index)){if(gap)throw Error('Tuple positions cannot contain holes');value.push(inputs['item_'+index]);}else gap=true;}if(inputs.rest?.length){if(gap)throw Error('Tuple rest cannot follow missing positions');value.push(...inputs.rest);}return {value};`;
      decode.code=`const out={};for(let index=0;index<Math.min(inputs.value.length,${fields.length});index++)out['item_'+index]=inputs.value[index];${schema.additionalItems===false?'':`out.rest=inputs.value.slice(${fields.length});`}return out;`;
    }else if(schema.type==='array'){
      const restSchema={...schema,minItems:0};const rest=this.ensure(restSchema,{...entry.context,name:entry.context.name+' Remainder',identity:undefined}),item=nested(schema.items??jsonRef,entry.context.name+' Item');
      encode.inputs.push(port('rest',rest,true),port('item',item),port('index','number'));
      decode.inputs.push(port('index','number'));decode.outputs.push(port('rest',rest,true),port('item',item),port('index','number',true),port('count','number',true));
      encode.code="const rest=structuredClone(inputs.rest),index=inputs.index??0;if(!Number.isSafeInteger(index)||index<0||index>rest.length)throw Error('Invalid list index');if(Object.hasOwn(inputs,'item'))rest.splice(index,0,inputs.item);return {value:rest};";
      decode.code="const rest=structuredClone(inputs.value),index=inputs.index??0,count=rest.length;if(!Number.isSafeInteger(index)||index<0||index>=count)throw Error('Invalid list index');const item=rest.splice(index,1)[0];return {rest,item,index,count};";
    }else if(schema.type==='null'){
      encode.code='return {value:null};';decode.code='return {};';
    }else {
      let branches=schema.anyOf??schema.oneOf;
      if(!branches&&Array.isArray(schema.type))branches=schema.type.map(type=>({...schema,type}));
      if(!branches)throw Error('Reviewed union required for '+name+' '+JSON.stringify(schema).slice(0,200));
      const choices=branches.map((branch,index)=>({id:resolveSchema(branch,entry.context.definitions).type==='null'?'is_null':'case_'+index,schema:closeSchema(branch,entry.context.definitions),ref:resolveSchema(branch,entry.context.definitions).type==='null'?'boolean':nested(branch,entry.context.name+' Case '+index)}));
      for(const choice of choices){encode.inputs.push(port(choice.id,choice.ref));decode.outputs.push(port(choice.id,choice.ref));}
      const embedded=`const matchesJsonSchema=${matchesJsonSchema.toString()},choices=${JSON.stringify(choices.map(c=>({id:c.id,schema:c.schema})))};`;
      encode.code=embedded+"const supplied=choices.filter(c=>Object.hasOwn(inputs,c.id));if(supplied.length!==1)throw Error('Exactly one union branch must be supplied');const c=supplied[0],value=c.id==='is_null'?(inputs.is_null===true?null:undefined):inputs[c.id];if(!matchesJsonSchema(value,c.schema))throw Error('Value does not match selected union branch');return {value};";
      decode.code=embedded+"for(const c of choices)if(matchesJsonSchema(inputs.value,c.schema))return {[c.id]:c.id==='is_null'?true:inputs.value};throw Error('No union branch matches value');";
    }
    const rows=[{key,definition:{name,kind:'type',description:name+' structural provider contract.',documentation:options.documentation,category:base.category,color:base.color,inputs:[],outputs:[],code:'',schema:entry.schema},...options}];
    for(const[definition,mode,other]of[[encode,'encode','decode'],[decode,'decode','encode']])rows.push({key:key+'.'+mode,definition:{...definition,documentation:options.documentation+'\n\nPure dictionary/list/tuple/union codec. Exactly selected branches/positions roundtrip; absent values and explicit null are distinct. Invalid indices, holes, duplicate ownership and unknown union variants fail. No provider calls.'},packId:options.packId,folderId:options.folderId,tags:options.tags,codec:{pairKey:key+'.'+other,mode,name}});
    return rows;
  }
}
