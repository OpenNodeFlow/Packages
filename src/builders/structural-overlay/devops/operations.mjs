import {createRequire} from 'node:module';
const appRequire=createRequire(import.meta.url);
const ts=appRequire('typescript');
export const operationSources={
 'projects-list':'core/projects/list','project-get':'core/projects/get','repository-get':'git/repositories/get-repository','pull-request-get':'git/pull-requests/get-pull-request-by-id','builds-list':'build/builds/list','build-get':'build/builds/get','build-queue':'build/builds/queue','build-timeline-get':'build/timeline/get','pipelines-list':'pipelines/pipelines/list','pipeline-get':'pipelines/pipelines/get','pipeline-runs-list':'pipelines/runs/list','pipeline-run-get':'pipelines/runs/get','pipeline-run':'pipelines/runs/run-pipeline','agents-list':'distributedtask/agents/list','release-get':'release/releases/get-release',
};
/** Extract literal operation descriptors from the current captured source. */
export function operationContracts(snapshot){return snapshot.definitions.filter(d=>d.packId==='pack_azure_devops'&&d.code?.startsWith('return await (async function runOperation')).map(d=>{
 const source=ts.createSourceFile('operation.js',d.code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let call;
 function visit(n){if(ts.isCallExpression(n)&&n.arguments.length===5&&n.arguments[2].getText(source)==='inputs'&&n.arguments[4].getText(source)==='context')call=n;ts.forEachChild(n,visit);}visit(source);
 if(!call)throw Error('Operation literal not found '+d.id);
 const family=JSON.parse(call.arguments[0].getText(source)),operation=JSON.parse(call.arguments[1].getText(source));
 return {definition:d,family,operation,argumentStart:call.arguments[1].getStart(source),argumentEnd:call.arguments[1].getEnd(),source:'https://learn.microsoft.com/en-us/rest/api/azure/devops/'+operationSources[operation.key]+'?view=azure-devops-rest-7.1'};
});}
export function correctOperationPaging(registry,snapshot){
 for(const row of operationContracts(snapshot))if(row.operation.key==='pipelines-list'){
  const operation={...row.operation,paging:{kind:'header',header:'x-ms-continuationtoken',parameter:'continuationToken'}};
  const d=row.definition,code=d.code.slice(0,row.argumentStart)+JSON.stringify(operation)+d.code.slice(row.argumentEnd);
  registry.change(d.id,{code,inputs:[...d.inputs,{id:'continuation',name:'Continuation',type:'string'}],documentation:d.documentation+'\n23 October 2026: continuationToken pagination supported and exposed using x-ms-continuationtoken; bounded maxPages/maxItems still enforced. Source: '+row.source},'List Pipelines supports continuationToken but the old descriptor ignored pagination and incorrectly reported has_more=false');
 }
}
