// This function is serialized into each immutable node. Imports never contact providers.
export async function runOperation(family,operation,inputs,config,context,fetcher=fetch){
  const own=(o,k)=>o!==null&&typeof o==='object'&&Object.hasOwn(o,k);
  const integer=(v,min,max,label)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw new Error(label+' outside bounds');return v;};
  const get=(value,path=[])=>path.reduce((v,k)=>own(v,k)?v[k]:undefined,value);
  const byteLength=v=>Buffer.byteLength(typeof v==='string'?v:JSON.stringify(v));
  let connection;
  if(config.$connection){if(!context.connections?.get)throw new Error('Connection profile unavailable');connection=await context.connections.get();}
  const effective={...(connection?.config??{}),...config};
  const maxBytes=integer(effective.maxBytes??1048576,1024,3000000,'maxBytes');
  const maxPages=integer(effective.maxPages??1,1,20,'maxPages');
  const maxItems=integer(effective.maxItems??1000,1,5000,'maxItems');
  const timeout=integer(effective.requestTimeoutMs??15000,100,120000,'requestTimeoutMs');
  const deadline=Date.now()+timeout;
  if(operation.effect!=='read'){
    if(effective.confirmWrites!==true)throw new Error('Enable confirmWrites for this external action');
    if((effective.$retries??0)>0)throw new Error('External actions require $retries=0; reconcile uncertain completion before retry');
  }
  // A small self-contained JSON Schema validator for declared outbound argument bounds.
  // Provider resource/socket schemas are also validated by ONF before/after execution.
  const finiteJson=(value,seen=new Set(),depth=0)=>{if(depth>90)return false;if(value===null||typeof value==='string'||typeof value==='boolean')return true;if(typeof value==='number')return Number.isFinite(value);if(!value||typeof value!=='object'||seen.has(value))return false;seen.add(value);const valid=(Array.isArray(value)?value:Object.values(value)).every(v=>finiteJson(v,seen,depth+1));seen.delete(value);return valid;};
  const matches=(schema,value,root=schema,depth=0)=>{
    if(depth>100||schema===false)return false;if(schema===true||!schema)return true;
    if(schema.$ref){if(!schema.$ref.startsWith('#/'))return false;const target=schema.$ref.slice(2).split('/').reduce((v,k)=>v?.[k.replaceAll('~1','/').replaceAll('~0','~')],root);return target!==undefined&&matches(target,value,root,depth+1);}
    if(schema.anyOf&&!schema.anyOf.some(s=>matches(s,value,root,depth+1)))return false;
    if(schema.oneOf&&schema.oneOf.filter(s=>matches(s,value,root,depth+1)).length!==1)return false;
    if(schema.allOf&&!schema.allOf.every(s=>matches(s,value,root,depth+1)))return false;
    if(schema.not&&matches(schema.not,value,root,depth+1))return false;
    if(own(schema,'const')&&JSON.stringify(value)!==JSON.stringify(schema.const)||schema.enum&&!schema.enum.some(v=>JSON.stringify(v)===JSON.stringify(value)))return false;
    const type=Array.isArray(value)?'array':value===null?'null':typeof value;
    if(schema.type&&!([].concat(schema.type)).some(t=>t===type||t==='integer'&&type==='number'&&Number.isSafeInteger(value)))return false;
    if(type==='number'&&(schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum||schema.exclusiveMinimum!==undefined&&value<=schema.exclusiveMinimum||schema.exclusiveMaximum!==undefined&&value>=schema.exclusiveMaximum))return false;
    if(type==='string'&&(schema.minLength!==undefined&&[...value].length<schema.minLength||schema.maxLength!==undefined&&[...value].length>schema.maxLength||schema.pattern&&!(new RegExp(schema.pattern,'u')).test(value)))return false;
    if(type==='array'){
      if(schema.minItems!==undefined&&value.length<schema.minItems||schema.maxItems!==undefined&&value.length>schema.maxItems||schema.uniqueItems&&new Set(value.map(v=>JSON.stringify(v))).size!==value.length)return false;
      if(schema.items&&!value.every((v,index)=>matches(Array.isArray(schema.items)?schema.items[index]??schema.additionalItems??true:schema.items,v,root,depth+1)))return false;
    }
    if(type==='object'){
      if((schema.required??[]).some(k=>!own(value,k))||schema.minProperties!==undefined&&Object.keys(value).length<schema.minProperties||schema.maxProperties!==undefined&&Object.keys(value).length>schema.maxProperties)return false;
      for(const[k,v]of Object.entries(value)){
        if(own(schema.properties??{},k)){if(!matches(schema.properties[k],v,root,depth+1))return false;}
        else{const patterns=Object.entries(schema.patternProperties??{}).filter(([pattern])=>(new RegExp(pattern,'u')).test(k));if(patterns.length){if(!patterns.every(([,s])=>matches(s,v,root,depth+1)))return false;}else if(schema.additionalProperties===false||schema.additionalProperties&&typeof schema.additionalProperties==='object'&&!matches(schema.additionalProperties,v,root,depth+1))return false;}
      }
    }
    return true;
  };
  const values={};
  for(const[key,descriptor]of Object.entries(operation.inputs??{})){
    const value=own(inputs,key)?inputs[key]:own(effective,key)?effective[key]:descriptor.default;
    if(value===undefined){if(descriptor.required)throw new Error('Missing input '+key);continue;}
    const t=descriptor.type;
    if(t==='string'&&typeof value!=='string'||t==='number'&&(typeof value!=='number'||!Number.isFinite(value))||t==='boolean'&&typeof value!=='boolean'||t==='record'&&(!value||typeof value!=='object'||Array.isArray(value))||t==='list'&&!Array.isArray(value))throw new Error('Invalid input '+key);
    if(!finiteJson(value)||descriptor.schema&&!matches(descriptor.schema,value))throw new Error('Input '+key+' violates declared schema');
    values[key]=value;
  }
  const template=value=>{
    if(value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.input==='string'){
      const v=values[value.input];if(v===undefined&&!value.optional)throw new Error('Missing input '+value.input);return v;
    }
    if(Array.isArray(value))return value.map(template);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,template(v)]).filter(([,v])=>v!==undefined));
    return value;
  };
  const baseText=effective.baseUrl??operation.baseUrl??family.baseUrl;
  let base;try{base=new URL(baseText);}catch{throw new Error('Configure a valid baseUrl');}
  const loopback=['localhost','127.0.0.1','[::1]'].includes(base.hostname);
  const host=base.hostname.toLowerCase(),privateHost=/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)||/^\[(?:fc|fd)[0-9a-f:]+\]$/i.test(host)||/\.(?:cluster|lan|local)$/.test(host)||/^[a-z][a-z0-9-]*$/.test(host);
  if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||base.protocol==='http:'&&!loopback&&!(effective.allowHttp===true&&privateHost))throw new Error('Use HTTPS baseUrl without credentials, query or fragment; private HTTP requires allowHttp');
  // Keep explicitly configured reverse-proxy API prefixes (e.g. Rancher proxy paths).
  const root=base.pathname.replace(/\/$/,'');
  const segment=(name,greedy)=>{
    const value=values[name];if(value===undefined||value===null||String(value)==='')throw new Error('Missing path input '+name);
    const text=String(value);
    if(/[?#\\\u0000-\u001f]/.test(text))throw new Error('Invalid path input '+name);
    if(greedy&&!text.startsWith('/'))throw new Error('Resource path must begin with /');
    const parts=greedy?text.slice(1).split('/'):[text];
    if(parts.some(p=>!p||p==='.'||p==='..'||/%(?:2e|2f|5c)/i.test(p)))throw new Error('Invalid path segment '+name);
    return(greedy?'/':'')+parts.map(encodeURIComponent).join('/');
  };
  const path=operation.path.replace(/\{([A-Za-z_][A-Za-z0-9_]*)(\*)?\}/g,(_,key,greedy)=>segment(key,greedy));
  if(!path.startsWith('/')||/[?#\\]/.test(path)||path.split('/').some(p=>p==='.'||p==='..'))throw new Error('Invalid operation path');
  let url=new URL(base.origin+root+path);
  for(const[k,v]of Object.entries(template(operation.query??{})))if(v!==undefined)url.searchParams.set(k,typeof v==='object'?JSON.stringify(v):String(v));
  const paging=operation.paging;
  const originalUrl=url.href;
  const safeNext=text=>{let next;try{next=new URL(text,url);}catch{throw new Error('Invalid continuation URL');}if(next.origin!==base.origin||next.username||next.password||next.hash||root&&next.pathname!==root&&!next.pathname.startsWith(root+'/')||next.pathname!==new URL(originalUrl).pathname)throw new Error('Continuation leaves the configured API endpoint');return next;};
  const continued=inputs.continuation??effective.continuation;
  if(continued!==undefined&&continued!==''){
    if(!paging)throw new Error('This operation does not support continuation');
    if(['url','link'].includes(paging.kind))url=safeNext(String(continued));else if(paging.location!=='body')url.searchParams.set(paging.parameter,String(continued));
  }
  if(paging?.kind==='page'||paging?.kind==='offset'){
    if(!url.searchParams.has(paging.parameter))url.searchParams.set(paging.parameter,paging.kind==='offset'?'0':'1');
    if(paging.sizeParameter)url.searchParams.set(paging.sizeParameter,String(paging.size??100));
  }
  const headers=new Headers(template(operation.headers??{}));
  headers.set('accept',operation.accept??'application/json');
  const auth=family.auth??{kind:'none'},credentials=connection?.credentials??{};
  const secret=(name,optional=false)=>{if(!name)return undefined;let v;try{v=context.secrets.get(name);}catch{if(optional)return undefined;throw new Error('Required credential secret is unavailable');}return v;};
  const token=auth.kind==='none'||auth.kind==='basic'&&(credentials.password||effective.passwordSecret)?undefined:credentials.accessToken??credentials.apiKey??secret(effective.tokenSecret??auth.secret,auth.optional&&!effective.tokenSecret);
  if(auth.kind==='bearer'||auth.kind==='header'){
    if(!token&&!auth.optional)throw new Error('Configure credential secret or connection profile');
    if(token){if(typeof token!=='string'||/[\r\n\u0000]/.test(token))throw new Error('Credential is not a valid header value');try{headers.set(auth.kind==='bearer'?'authorization':auth.header,(auth.kind==='bearer'?'Bearer ':auth.prefix??'')+token);}catch{throw new Error('Credential is not a valid header value');}}
  }else if(auth.kind==='basic'){
    const username=credentials.username??(effective.usernameSecret?secret(effective.usernameSecret):effective.username??auth.username??'');
    const password=credentials.password??(effective.passwordSecret?secret(effective.passwordSecret):token);
    if(typeof password!=='string'||!password||/[\r\n]/.test(username))throw new Error('Configure Basic credential secrets or connection profile');
    headers.set('authorization','Basic '+Buffer.from(username+':'+password).toString('base64'));
  }else if(auth.kind!=='none')throw new Error('Unsupported authentication kind');
  const rawBody=operation.body===undefined?undefined:template(operation.body);
  if(paging?.location==='body'&&continued!==undefined&&continued!==''){if(!rawBody||typeof rawBody!=='object'||Array.isArray(rawBody))throw new Error('Body pagination requires a JSON object');rawBody[paging.parameter]=String(continued);}
  const serializeBody=()=>{if(rawBody===undefined)return undefined;const value=operation.bodyMode==='text'?String(rawBody):JSON.stringify(rawBody);headers.set('content-type',operation.contentType??'application/json');if(byteLength(value)>maxBytes)throw new Error('Request exceeds maxBytes');return value;};
  let body=serializeBody();
  const method=operation.method??'GET';
  let pages=0,totalBytes=0,items=[],lastResponse,data,continuation;
  const seen=new Set();
  do{
    const requestIdentity=url.href+'\n'+(body??'');if(seen.has(requestIdentity))throw new Error('Repeated continuation detected');seen.add(requestIdentity);
    const remaining=deadline-Date.now();if(remaining<=0)throw new Error('Request deadline exceeded');
    try{lastResponse=await fetcher(url,{method,headers,body,redirect:'error',signal:AbortSignal.timeout(remaining)});}catch{throw new Error(family.name+' transport failed'+(operation.effect==='read'?'':'; external completion is uncertain; reconcile before retry'));}
    if(!lastResponse.ok&&!operation.acceptedStatuses?.includes(lastResponse.status)){try{await lastResponse.body?.cancel();}catch{}throw new Error(family.name+' HTTP '+lastResponse.status+(operation.effect==='read'?'':' ; action may have been accepted; reconcile before retry'));}
    const advertised=Number(lastResponse.headers.get('content-length'));if(Number.isFinite(advertised)&&advertised>maxBytes-totalBytes){try{await lastResponse.body?.cancel();}catch{}throw new Error('Response exceeds maxBytes');}
    const reader=lastResponse.body?.getReader();let text='';
    if(reader){const chunks=[];let bytes=0;try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;totalBytes+=part.value.byteLength;if(totalBytes>maxBytes)throw new Error('Response exceeds maxBytes');chunks.push(part.value);}}catch(e){try{await reader.cancel();}catch{}throw new Error(e.message==='Response exceeds maxBytes'?e.message:family.name+' response interrupted'+(operation.effect==='read'?'':'; external completion uncertain'));}text=Buffer.concat(chunks.map(c=>Buffer.from(c)),bytes).toString('utf8');}
    else{text=await lastResponse.text();totalBytes+=byteLength(text);if(totalBytes>maxBytes)throw new Error('Response exceeds maxBytes');}
    if(operation.response.kind==='text')data=text;
    else if(operation.response.kind==='empty'&&!operation.response.successPath)data=undefined;
    else{try{data=text.length?JSON.parse(text):undefined;}catch{throw new Error(family.name+' returned invalid JSON');}}
    if(operation.response.successPath&&get(data,operation.response.successPath)!==(operation.response.successValue??true))throw new Error(family.name+' returned an unsuccessful API result');
    pages++;
    continuation=undefined;
    const value=get(data,operation.response.path);
    const selected=value===undefined&&operation.response.fallbackPath?get(data,operation.response.fallbackPath):value;
    if(operation.response.kind==='list'){
      if(!Array.isArray(selected))throw new Error('Expected provider list at documented response path');
      if(items.length+selected.length>maxItems)throw new Error('Response exceeds maxItems; request a smaller page');
      items.push(...selected);
      if(paging?.kind==='url'||paging?.kind==='token')continuation=get(data,paging.path);
      else if(paging?.kind==='header')continuation=lastResponse.headers.get(paging.header)??undefined;
      else if(paging?.kind==='link'){
        const link=lastResponse.headers.get('link')??'';
        continuation=link.split(',').map(p=>p.trim()).filter(p=>!/(?:^|;)\s*results="?false"?(?:;|$)/i.test(p)).map(p=>p.match(/^<([^>]+)>;\s*rel="?next"?(?:;.*)?$/)).find(Boolean)?.[1];
      }else if(paging?.kind==='page'&&selected.length===(paging.size??100))continuation=String(Number(url.searchParams.get(paging.parameter)??1)+1);
      else if(paging?.kind==='offset'){
        const offset=Number(url.searchParams.get(paging.parameter)??0),size=Number(url.searchParams.get(paging.sizeParameter)??paging.size??100);
        const more=paging.morePath?get(data,paging.morePath):paging.totalPath?offset+selected.length<get(data,paging.totalPath):selected.length===size;
        if(more&&selected.length)continuation=String(offset+selected.length);
      }
    }
    if(continuation===null||continuation==='')continuation=undefined;
    if(continuation!==undefined&&typeof continuation!=='string'&&typeof continuation!=='number')throw new Error('Invalid continuation token');
    if(!continuation||pages>=maxPages)break;
    if(operation.effect!=='read')throw new Error('Cannot paginate an external action');
    if(['url','link'].includes(paging.kind))url=safeNext(String(continuation));else if(paging.location==='body'){if(!rawBody||typeof rawBody!=='object'||Array.isArray(rawBody))throw new Error('Body pagination requires a JSON object');rawBody[paging.parameter]=String(continuation);body=serializeBody();}else url.searchParams.set(paging.parameter,String(continuation));
  }while(true);
  const result={status:lastResponse.status};
  const requestId=lastResponse.headers.get('x-ms-request-id')??lastResponse.headers.get('x-request-id')??lastResponse.headers.get('x-github-request-id');if(requestId)result.request_id=requestId;
  const operationLocation=lastResponse.headers.get('azure-asyncoperation')??lastResponse.headers.get('operation-location')??(lastResponse.status===202?lastResponse.headers.get('location'):undefined);if(operationLocation){const location=new URL(operationLocation,url);if(location.origin===base.origin&&!location.username&&!location.password&&!location.hash)result.operation_url=location.href;}
  const value=get(data,operation.response.path),selected=value===undefined&&operation.response.fallbackPath?get(data,operation.response.fallbackPath):value;
  if(operation.response.kind==='item'){if(selected===undefined&&operation.response.optional===true&&lastResponse.status===202){}else{if(selected===undefined||selected===null||typeof selected!=='object'||Array.isArray(selected))throw new Error('Expected provider object at documented response path');result.item=selected;}}
  else if(operation.response.kind==='list'){result.items=items;result.count=items.length;result.has_more=continuation!==undefined;if(continuation!==undefined)result.continuation=String(continuation);}
  else if(operation.response.kind==='json'){if(selected===undefined)throw new Error('Expected JSON at documented response path');result.value=selected;}
  else if(operation.response.kind==='text')result.text=data;
  for(const[key,path]of Object.entries(operation.response.select??{})){const v=get(data,path);if(v!==undefined&&v!==null){const type=operation.response.selectTypes?.[key]??'string';if(typeof v!==type)throw new Error('Unexpected scalar output '+key);result[key]=v;}}
  for(const[key,header]of Object.entries(operation.response.headerSelect??{})){const v=lastResponse.headers.get(header);if(v!==null)result[key]=v;}
  if(byteLength(result)>maxBytes)throw new Error('Outputs exceed maxBytes');
  return result;
}
export const operationCode=(family,operation)=>`return await (${runOperation.toString()})(${JSON.stringify(family)},${JSON.stringify(operation)},inputs,config,context);`;
