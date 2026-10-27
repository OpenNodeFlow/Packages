// Offline structural interpretation of Microsoft's reviewed SDK DTO declarations.
// This creates local JSON Schema definitions, never a nominal ONF type per field.
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const appRequire=createRequire(import.meta.url);
import {completeSchema,hash} from '../common.mjs';
const ts=appRequire('typescript');
const folder=new URL('./sources/',import.meta.url);
const sources=new Map();
for(const file of readdirSync(folder).filter(file=>file.endsWith('.ts'))){
 const source=ts.createSourceFile(file,readFileSync(new URL(file,folder),'utf8'),ts.ScriptTarget.Latest,true);
 const declarations=new Map(),imports=new Map();
 for(const statement of source.statements){
  if(ts.isInterfaceDeclaration(statement)||ts.isEnumDeclaration(statement)||ts.isTypeAliasDeclaration(statement))declarations.set(statement.name.text,statement);
  if(ts.isImportEqualsDeclaration(statement)&&ts.isExternalModuleReference(statement.moduleReference))imports.set(statement.name.text,statement.moduleReference.expression.text.split('/').at(-1));
 }
 sources.set(file.replace(/\.ts$/,''),{source,declarations,imports});
}
const J={$ref:'#/definitions/ONFJsonValue'};
const record={type:'object',additionalProperties:J};
const link={type:'object',properties:{href:{type:['string','null']}},additionalProperties:J};
const links={type:'object',additionalProperties:{anyOf:[link,{type:'array',items:link},{type:'null'}]}};
const raw=(schema)=>schema&&typeof schema==='object'?structuredClone(schema):schema;
const key=(space,name)=>'sdk_'+space+'_'+name;

export function sdkSchema(space,name){
 const definitions={},exceptions=[],provenance=[];
 const literal=node=>ts.isLiteralTypeNode(node)?ts.isStringLiteral(node.literal)?node.literal.text:node.literal.kind===ts.SyntaxKind.TrueKeyword?true:node.literal.kind===ts.SyntaxKind.FalseKeyword?false:node.literal.kind===ts.SyntaxKind.NullKeyword?null:Number(node.literal.getText()):undefined;
 function reference(node,namespace){
  const parts=node.getText(sources.get(namespace).source).split('.');
  return parts.length===1?[namespace,parts[0]]:[sources.get(namespace).imports.get(parts[0])??parts[0],parts.slice(1).join('.')];
 }
 function exception(path,reason,schema=J){exceptions.push({path,reason});return raw(schema);}
 function propertyOverride(path){
  if(path.endsWith('._links'))return raw(links);
  if(path==='CoreInterfaces.TeamProjectReference.state')return {type:'string'};
  if(/\.(?:properties|customData|extendedProperties|data|inputs|templateParameters|processParameters)$/.test(path)){
   // These names are not automatically exceptions: only explicitly `any` DTO
   // properties reach this fallback below. Typed SDK fields keep their structure.
   return undefined;
  }
 }
 function convert(node,namespace,path,bindings={}){
  if(!node)throw Error('Missing DTO field type '+path);
  switch(node.kind){
   case ts.SyntaxKind.StringKeyword:return {type:'string'};
   case ts.SyntaxKind.NumberKeyword:return {type:'number'};
   case ts.SyntaxKind.BooleanKeyword:return {type:'boolean'};
   case ts.SyntaxKind.NullKeyword:return {type:'null'};
   case ts.SyntaxKind.AnyKeyword:
   case ts.SyntaxKind.UnknownKeyword:
    return exception(path,'Microsoft DTO explicitly declares an extensible value/property bag; known containing fields remain structural.');
   case ts.SyntaxKind.ObjectKeyword:return exception(path,'Microsoft DTO declares an extensible record.',record);
  }
  if(ts.isParenthesizedTypeNode(node))return convert(node.type,namespace,path,bindings);
  if(ts.isLiteralTypeNode(node))return {const:literal(node)};
  if(ts.isUnionTypeNode(node))return {anyOf:node.types.map((part,index)=>convert(part,namespace,path+'|'+index,bindings))};
  if(ts.isArrayTypeNode(node))return {type:'array',items:convert(node.elementType,namespace,path+'[]',bindings)};
  if(ts.isTypeLiteralNode(node))return objectMembers(node.members,namespace,path,bindings);
  if(ts.isTypeReferenceNode(node)){
   const text=node.typeName.getText(sources.get(namespace).source);
   if(Object.hasOwn(bindings,text))return raw(bindings[text]);
   if(text==='Date')return {type:'string'};
   if(text==='Array'||text==='ReadonlyArray')return {type:'array',items:convert(node.typeArguments?.[0],namespace,path+'[]',bindings)};
   const[targetSpace,targetName]=reference(node.typeName,namespace),entry=sources.get(targetSpace),declaration=entry?.declarations.get(targetName);
   if(!declaration)throw Error('Unresolved Microsoft DTO '+targetSpace+'.'+targetName+' at '+path);
   if(ts.isEnumDeclaration(declaration)){
    // SDK enums are numeric in memory but Azure REST serializes their names.
    // Keep a string wire contract; REST-route enums/bounds are reviewed separately.
    return {type:'string'};
   }
   if(ts.isTypeAliasDeclaration(declaration))return convert(declaration.type,targetSpace,path,bindings);
   return interfaceRef(targetSpace,targetName,(node.typeArguments??[]).map(arg=>convert(arg,namespace,path+'.argument',bindings)));
  }
  throw Error('Unsupported Microsoft DTO syntax '+ts.SyntaxKind[node.kind]+' at '+path);
 }
 function objectMembers(members,namespace,path,bindings={}){
  const schema={type:'object',properties:{},additionalProperties:J};
  for(const member of members){
   if(ts.isPropertySignature(member)){
    const name=ts.isStringLiteral(member.name)?member.name.text:member.name.getText(sources.get(namespace).source);
    schema.properties[name]=propertyOverride(path+'.'+name)??convert(member.type,namespace,path+'.'+name,bindings);
   }else if(ts.isIndexSignatureDeclaration(member)){
    schema.additionalProperties=convert(member.type,namespace,path+'.*',bindings);
   }else throw Error('Non-wire DTO member '+path);
  }
  return schema;
 }
 function interfaceRef(namespace,name,args=[]){
  const id=key(namespace,name)+(args.length?'_'+hash(args).slice(0,10):'');if(Object.hasOwn(definitions,id))return {$ref:'#/definitions/'+id};
  const entry=sources.get(namespace),declaration=entry?.declarations.get(name);if(!declaration||!ts.isInterfaceDeclaration(declaration))throw Error('Missing DTO interface '+namespace+'.'+name);
  definitions[id]={};provenance.push({namespace,name,file:namespace+'.ts'});
  const bindings=Object.fromEntries((declaration.typeParameters??[]).map((param,index)=>[param.name.text,args[index]]).filter(([,schema])=>schema!==undefined));
  let schema={type:'object',properties:{},additionalProperties:J};
  for(const clause of declaration.heritageClauses??[])for(const heritage of clause.types){const[baseSpace,baseName]=reference(heritage.expression,namespace);const baseRef=interfaceRef(baseSpace,baseName,(heritage.typeArguments??[]).map(arg=>convert(arg,namespace,namespace+'.'+name+'.argument',bindings)));const base=definitions[baseRef.$ref.split('/').at(-1)];schema.properties={...schema.properties,...base.properties};if(base.additionalProperties!==undefined)schema.additionalProperties=base.additionalProperties;}
  const direct=objectMembers(declaration.members,namespace,namespace+'.'+name,bindings);schema={...schema,properties:{...schema.properties,...direct.properties},additionalProperties:direct.additionalProperties};definitions[id]=schema;
  return {$ref:'#/definitions/'+id};
 }
 interfaceRef(space,name);
 const root=raw(definitions[key(space,name)]);
 return {schema:completeSchema({...root,definitions}),exceptions,provenance};
}

export const microsoftSources=JSON.parse(readFileSync(new URL('./sources/manifest.json',import.meta.url),'utf8'));
