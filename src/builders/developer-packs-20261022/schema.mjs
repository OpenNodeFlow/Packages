// Shared finite JSON vocabulary; no new nominal JSON types are introduced.
export const JSON_TYPES={json:'def_c5fc8fea11ea',record:'def_f9962f86c7f4',list:'def_ffc66f61eee4'};
export const s=(x={})=>({type:'string',...x});
export const n=(x={})=>({type:'number',...x});
export const i=(x={})=>({type:'integer',...x});
export const b=(x={})=>({type:'boolean',...x});
export const json={$ref:'#/definitions/ONFJsonValue'};
export const record={type:'object',additionalProperties:json};
export const list={type:'array',items:json};
export const a=(items=json,x={})=>({type:'array',items,...x});
export const o=(properties={},required=[],additionalProperties=json)=>({type:'object',properties,required,additionalProperties});
export const definitions={ONFJsonValue:{anyOf:[{type:'null'},s(),n(),b(),{type:'array',items:{$ref:'#/definitions/ONFJsonValue'}},{type:'object',additionalProperties:{$ref:'#/definitions/ONFJsonValue'}}]}};
export function completeSchema(schema){return {...structuredClone(schema),definitions:{...structuredClone(definitions),...structuredClone(schema.definitions??{})}};}
export const input=(name,optional=false)=>({input:name,...(optional?{optional:true}:{})});
