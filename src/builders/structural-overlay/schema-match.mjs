// Pure schema comparator extracted from reviewed static source.
export function matchesJsonSchema(value,schema,root=schema,depth=0){
  if(depth>2048||schema===false)return false;if(schema===true)return true;
  if(!schema||typeof schema!=='object'||value===undefined||typeof value==='number'&&!Number.isFinite(value))return false;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),own=(v,k)=>Object.hasOwn(v,k);
  const equal=(a,b)=>a===b||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equal(v,b[i]))||object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>own(b,k)&&equal(a[k],b[k]));
  if(schema.$ref){if(!schema.$ref.startsWith('#'))return false;let target=root;try{for(const key of schema.$ref==='#'?[]:schema.$ref.slice(2).split('/').map(k=>decodeURIComponent(k).replaceAll('~1','/').replaceAll('~0','~')))target=target[key];}catch{return false;}return matchesJsonSchema(value,target,root,depth+1);}
  if(own(schema,'const')&&!equal(value,schema.const)||schema.enum&&!schema.enum.some(item=>equal(value,item)))return false;
  if(schema.anyOf&&!schema.anyOf.some(s=>matchesJsonSchema(value,s,root,depth+1))||schema.oneOf&&schema.oneOf.filter(s=>matchesJsonSchema(value,s,root,depth+1)).length!==1||schema.allOf&&!schema.allOf.every(s=>matchesJsonSchema(value,s,root,depth+1))||schema.not&&matchesJsonSchema(value,schema.not,root,depth+1))return false;
  if(own(schema,'if')){const branch=matchesJsonSchema(value,schema.if,root,depth+1)?schema.then:schema.else;if(branch!==undefined&&!matchesJsonSchema(value,branch,root,depth+1))return false;}
  const types=Array.isArray(schema.type)?schema.type:schema.type?[schema.type]:[];
  if(types.length&&!types.some(t=>t==='null'?value===null:t==='object'?object(value):t==='array'?Array.isArray(value):t==='integer'?Number.isInteger(value):typeof value===t))return false;
  if(typeof value==='number'){
    if(schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum||schema.exclusiveMinimum!==undefined&&value<=schema.exclusiveMinimum||schema.exclusiveMaximum!==undefined&&value>=schema.exclusiveMaximum)return false;
    if(schema.multipleOf!==undefined&&!Number.isInteger(value/schema.multipleOf))return false;
  }
  if(typeof value==='string'){
    const length=[...value].length;if(schema.minLength!==undefined&&length<schema.minLength||schema.maxLength!==undefined&&length>schema.maxLength||schema.pattern&&!new RegExp(schema.pattern,'u').test(value))return false;
  }
  if(Array.isArray(value)){
    if(schema.minItems!==undefined&&value.length<schema.minItems||schema.maxItems!==undefined&&value.length>schema.maxItems)return false;
    if(schema.uniqueItems&&value.some((v,i)=>value.slice(0,i).some(other=>equal(v,other))))return false;
    if(Array.isArray(schema.items)){for(let i=0;i<value.length;i++){const item=schema.items[i]??schema.additionalItems??true;if(!matchesJsonSchema(value[i],item,root,depth+1))return false;}}
    else if(schema.items!==undefined&&!value.every(v=>matchesJsonSchema(v,schema.items,root,depth+1)))return false;
    if(schema.contains!==undefined&&!value.some(v=>matchesJsonSchema(v,schema.contains,root,depth+1)))return false;
  }
  if(object(value)){
    const keys=Object.keys(value);if((schema.required??[]).some(key=>!own(value,key))||schema.minProperties!==undefined&&keys.length<schema.minProperties||schema.maxProperties!==undefined&&keys.length>schema.maxProperties)return false;
    for(const [key,item]of Object.entries(value)){
      if(schema.propertyNames&&!matchesJsonSchema(key,schema.propertyNames,root,depth+1))return false;
      let matched=false;if(own(schema.properties??{},key)){matched=true;if(!matchesJsonSchema(item,schema.properties[key],root,depth+1))return false;}
      for(const [pattern,contract]of Object.entries(schema.patternProperties??{}))if(new RegExp(pattern,'u').test(key)){matched=true;if(!matchesJsonSchema(item,contract,root,depth+1))return false;}
      if(!matched&&schema.additionalProperties!==undefined&&!matchesJsonSchema(item,schema.additionalProperties,root,depth+1))return false;
    }
    for(const [key,dependency]of Object.entries(schema.dependencies??{}))if(own(value,key)&&(Array.isArray(dependency)?dependency.some(k=>!own(value,k)):!matchesJsonSchema(value,dependency,root,depth+1)))return false;
  }
  return true;
}
