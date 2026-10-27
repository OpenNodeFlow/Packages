import { createHash } from 'node:crypto';
export { s, n, i, b, a, o, json, record, list, completeSchema, definitions as jsonDefinitions, JSON_TYPES } from '../developer-packs-20261022/schema.mjs';
import { completeSchema, JSON_TYPES } from '../developer-packs-20261022/schema.mjs';

export const clone = value => structuredClone(value);
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const title = value => value.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export const ref = (type, version = 1) => ['string', 'number', 'boolean', 'control', 'any', 'object', 'array'].includes(type)
  ? {type} : {type, typeVersion: version};
export function findType(snapshot, name) {
  const matches = snapshot.definitions.filter(d => d.kind === 'type' && (d.id === name || d.name === name));
  if (matches.length !== 1) throw Error('Expected one semantic type: ' + name);
  return matches[0];
}
const controls = { exec: {id:'exec',name:'Execute',type:'control'}, next:{id:'next',name:'Next',type:'control'} };
function socket(id, descriptor, required = false) {
  return {id, name:title(id), ...(typeof descriptor === 'string' ? ref(descriptor) : descriptor), ...(required ? {required:true} : {})};
}

/** New structural contracts only. Explicit nested field references prevent a JSON escape fallback. */
export function makeTypeWithCodecs(key, name, schema, fieldTypes = {}, options = {}) {
  const shared = {packId:options.packId, folderId:options.folderId, tags: options.tags || ['contract-audit','typed']};
  const base = {name,kind:'type',description: options.description || `Reusable ${name} contract.`, documentation: options.documentation || `${name}. Known provider fields are structural; optional absence is distinct from explicit null. Pure schema; no external effects.`, category:options.category || 'Integration contracts',color:options.color || '#58afa6',inputs:[],outputs:[],code:'',schema:completeSchema(schema)};
  const rows = [{key,definition:base,...shared}];
  const encodeKey=key+'.encode',decodeKey=key+'.decode';
  const encode={name:name+' Encode',kind:'node',description:`Assemble ${name} from typed fields.`,category:base.category,color:base.color,runtime:'javascript',inputs:[controls.exec],outputs:[controls.next],configSchema:{type:'object',properties:{},additionalProperties:false}};
  const decode={...clone(encode),name:name+' Decode',description:`Expose the typed fields of ${name}.`};
  const root=ref('@'+key);
  if (schema.type === 'object' && Object.keys(schema.properties || {}).length) {
    const fields=Object.keys(schema.properties), required=new Set(schema.required || []), reserved=new Set(['exec','next','value','remainder','error','__proto__','prototype','constructor']);
    const aliases=Object.fromEntries(fields.map(field=>[field, reserved.has(field) ? 'field_'+field : field]));
    if (new Set(Object.values(aliases)).size !== fields.length) throw Error('Codec field alias collision: '+key);
    for(const field of fields){
      const property=schema.properties[field];
      let descriptor=fieldTypes[field];
      if(!descriptor){
        if(property.type==='string') descriptor='string';
        else if(['integer','number'].includes(property.type)) descriptor='number';
        else if(property.type==='boolean') descriptor='boolean';
        else throw Error(`Explicit nested/nullable field type required: ${key}.${field}`);
      }
      encode.inputs.push(socket(aliases[field],descriptor,required.has(field)));
      decode.outputs.push(socket(aliases[field],descriptor,required.has(field)));
    }
    const extensions=schema.additionalProperties !== false;
    if(extensions){encode.inputs.push(socket('remainder',ref(JSON_TYPES.record,1)));decode.outputs.push(socket('remainder',ref(JSON_TYPES.record,1),true));}
    encode.outputs.push(socket('value',root,true));decode.inputs.push(socket('value',root,true));
    encode.code=`const fields=${JSON.stringify(fields)},aliases=${JSON.stringify(aliases)},remainder=inputs.remainder??{};for(const key of Object.keys(remainder))if(fields.includes(key))throw Error('Remainder collides with a declared field');const entries=Object.entries(remainder);for(const key of fields)if(Object.hasOwn(inputs,aliases[key]))entries.push([key,inputs[aliases[key]]]);return {value:Object.fromEntries(entries)};`;
    decode.code=`const fields=${JSON.stringify(fields)},aliases=${JSON.stringify(aliases)},out=Object.create(null);for(const key of fields)if(Object.hasOwn(inputs.value,key))out[aliases[key]]=inputs.value[key];${extensions ? 'out.remainder=Object.fromEntries(Object.entries(inputs.value).filter(([key])=>!fields.includes(key)));' : ''}return out;`;
  } else if(schema.type === 'array') {
    const itemType=options.itemType || fieldTypes.item;
    if(!itemType) throw Error('Explicit list item type required: '+key);
    if(schema.minItems>0) throw Error('List rest needs a separately reviewed empty-capable contract: '+key);
    encode.inputs.push(socket('rest',root,true),socket('item',itemType),socket('index','number'));
    encode.outputs.push(socket('value',root,true));
    decode.inputs.push(socket('value',root,true),socket('index','number'));
    decode.outputs.push(socket('rest',root,true),socket('item',itemType),socket('index','number',true),socket('count','number',true));
    encode.code="const rest=structuredClone(inputs.rest),index=inputs.index??0;if(!Number.isSafeInteger(index)||index<0||index>rest.length)throw Error('Index outside list bounds');if(Object.hasOwn(inputs,'item'))rest.splice(index,0,inputs.item);return {value:rest};";
    decode.code="const rest=structuredClone(inputs.value),index=inputs.index??0,count=rest.length;if(!Number.isSafeInteger(index)||index<0||(count?index>=count:index!==0))throw Error('Index outside list bounds');const out={rest,index,count};if(count)out.item=rest.splice(index,1)[0];return out;";
  } else throw Error('Field codecs need a structural object/list; implement reviewed union/dictionary codecs separately: '+key);
  for(const [codecKey,definition,mode,partner] of [[encodeKey,encode,'encode',decodeKey],[decodeKey,decode,'decode',encodeKey]]) {
    definition.documentation=`${definition.description}\n\nPure transformation, no provider calls, credentials or persistent state. The pinned input/output contracts validate every value. Missing optional fields stay absent; falsy values and explicit schema-supported nulls are retained. Object remainder fields cannot collide with declared fields; unknown extension values remain an explicit JSON dictionary. List decoding removes the selected item at index (default zero), returns rest, index and original count; empty lists omit item. Encoding reinserts an optional item at index. Invalid indices fail.\n\n${base.documentation}`;
    rows.push({key:codecKey,definition,...shared,codec:{pairKey:partner,mode,name}});
  }
  return rows;
}

export function schemaForPort(snapshot, port, additions = []) {
  if(port.type.startsWith('@')) return additions.find(row=>row.key===port.type.slice(1))?.definition.schema;
  return snapshot.definitions.find(d=>d.id===port.type && d.kind==='type')?.schema;
}
