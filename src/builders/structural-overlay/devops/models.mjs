import {sdkSchema} from './sdk-schema.mjs';
import {completeSchema} from '../common.mjs';

const J={$ref:'#/definitions/ONFJsonValue'};
const S={type:'string'},N={type:'number'},B={type:'boolean'};
const nullable=s=>({anyOf:[s,{type:'null'}]});
const object=properties=>({type:'object',properties,additionalProperties:J});
const array=items=>({type:'array',items});
const map=items=>({type:'object',additionalProperties:items});
const ref=(space,name)=>({$ref:'#/definitions/sdk_'+space+'_'+name});
const sdk=(space,name)=>({space,name});

/** Explicit semantic reuse map; identity never follows structural equality alone. */
export const canonicalModels={
 'def_5a8136d830f9':sdk('VSSInterfaces','IdentityRef'),
 'def_b04c995df0e8':sdk('CoreInterfaces','TeamProject'),
 'def_690ea53cafe0':sdk('GitInterfaces','GitRepository'),
 'def_1b7a9641535c':sdk('GitInterfaces','GitUserDate'),
 'def_f49f4e8525d4':sdk('GitInterfaces','GitCommitRef'),
 'def_ad0ca30fedc5':sdk('GitInterfaces','GitRefUpdate'),
 'def_1926ed9218fc':sdk('CoreInterfaces','WebApiTagDefinition'),
 'def_fbfde301b93a':sdk('VSSInterfaces','ResourceRef'),
 'def_b98f4c89c425':sdk('GitInterfaces','GitPullRequestCompletionOptions'),
 'def_206a5dc8ef29':sdk('GitInterfaces','GitPullRequestMergeOptions'),
 'def_56b3651cf5d5':sdk('GitInterfaces','GitForkRef'),
 'def_3e18b735f947':sdk('WorkItemTrackingInterfaces','WorkItemRelation'),
 'def_920eb19728df':sdk('WorkItemTrackingInterfaces','WorkItemCommentVersionRef'),
 'def_b280f2f17ed0':sdk('WorkItemTrackingInterfaces','WorkItem'),
 'def_e4e94e62e8e4':sdk('GitInterfaces','Comment'),
 'def_371896985f1d':sdk('GitInterfaces','CommentThread'),
 'def_e2221b999f1a':sdk('BuildInterfaces','BuildDefinitionReference'),
 'def_f18cc5eaac5a':sdk('BuildInterfaces','AgentPoolQueue'),
 'def_8afceecb46a9':sdk('BuildInterfaces','TaskOrchestrationPlanReference'),
 'def_7a4abdbacfa8':sdk('BuildInterfaces','BuildLogReference'),
 'def_9e98014d1ecd':sdk('GitInterfaces','GitPullRequest'),
 'def_8ef7a4264c48':sdk('BuildInterfaces','Build'),
 'def_4432f688a6fa':sdk('PipelinesInterfaces','Pipeline'),
 'def_82f86ac04dd6':sdk('PipelinesInterfaces','Run'),
 'def_6dcdbdc1614a':sdk('TaskAgentInterfaces','TaskAgent'),
 'def_23081a52e290':sdk('ReleaseInterfaces','Release'),
};
export const newModels={
 'devops.timeline':{label:'Azure Build Timeline',...sdk('BuildInterfaces','Timeline')},
 'devops.timeline-record':{label:'Azure Pipeline Execution Record',...sdk('BuildInterfaces','TimelineRecord')},
 'devops.release-environment':{label:'Azure Release Environment',...sdk('ReleaseInterfaces','ReleaseEnvironment')},
 'devops.release-approval':{label:'Azure Release Approval',...sdk('ReleaseInterfaces','ReleaseApproval')},
 'devops.release-deployment':{label:'Azure Release Deployment',...sdk('ReleaseInterfaces','Deployment')},
 'devops.manual-intervention':{label:'Azure Release Manual Intervention',...sdk('ReleaseInterfaces','ManualIntervention')},
};

// Preserve explicit nulls in old event contracts and public service-hook samples.
// This does not preserve the old escape hatch accepting arbitrary JSON for a name,
// identity or numeric identifier: non-null known values remain fully structural.
function nullableProperties(schema){
 if(!schema||typeof schema!=='object')return;
 if(schema.properties)for(const[key,value]of Object.entries(schema.properties)){
  nullableProperties(value);
  if((schema.required??[]).includes(key)||value.const!==undefined||value.type==='null'||[].concat(value.type??[]).includes('null')||value.anyOf?.some(v=>v.type==='null'))continue;
  schema.properties[key]=nullable(value);
 }
 for(const key of ['definitions','$defs'])if(schema[key])for(const v of Object.values(schema[key]))nullableProperties(v);
 if(schema.items)nullableProperties(schema.items);
 if(schema.additionalProperties&&typeof schema.additionalProperties==='object')nullableProperties(schema.additionalProperties);
 for(const key of ['anyOf','oneOf','allOf'])for(const v of schema[key]??[])nullableProperties(v);
}

export function reviewedModels(){
 const entries=new Map(),allDefinitions={},exceptions=[];
 for(const[id,spec]of Object.entries({...canonicalModels,...newModels})){
  const result=sdkSchema(spec.space,spec.name);
  entries.set(id,{...spec,id,schema:result.schema,exceptions:result.exceptions});
  Object.assign(allDefinitions,result.schema.definitions);
  exceptions.push(...result.exceptions.map(item=>({...item,model:spec.space+'.'+spec.name})));
 }
 // IdentityRefWithVote extends the very same IdentityRef domain. Use one shared
 // identity contract, including optional reviewer voting fields, at both sites.
 const vote=sdkSchema('GitInterfaces','IdentityRefWithVote');Object.assign(allDefinitions,vote.schema.definitions);
 const identity=allDefinitions.sdk_VSSInterfaces_IdentityRef;
 Object.assign(identity.properties,vote.schema.properties);
 allDefinitions.sdk_GitInterfaces_IdentityRefWithVote=structuredClone(identity);
 const links=map({anyOf:[object({href:nullable(S)}),array(object({href:nullable(S)})),{type:'null'}]});
 const historyChange=object({oldValue:nullable(S),newValue:nullable(S)});
 const fieldValue=value=>{const kind=value.type==='string'?'Text':value.type==='number'?'Number':'Identity';return {title:'Azure Work Item '+kind+' Field',anyOf:[value,{type:'null'},{...object({oldValue:nullable(value),newValue:nullable(value)}),title:'Azure Work Item '+kind+' Change'}]};};
 const fields=object({
  'System.Id':fieldValue(N),'System.Rev':fieldValue(N),'System.Title':fieldValue(S),
  'System.State':fieldValue(S),'System.WorkItemType':fieldValue(S),'System.TeamProject':fieldValue(S),
  'System.AreaPath':fieldValue(S),'System.IterationPath':fieldValue(S),'System.Tags':fieldValue(S),
  'System.CreatedDate':fieldValue(S),'System.ChangedDate':fieldValue(S),
  'System.CreatedBy':fieldValue({anyOf:[S,ref('VSSInterfaces','IdentityRef')]}),
  'System.ChangedBy':fieldValue({anyOf:[S,ref('VSSInterfaces','IdentityRef')]}),
  'System.AssignedTo':fieldValue({anyOf:[S,ref('VSSInterfaces','IdentityRef')]}),
  'System.History':fieldValue(S),'Microsoft.VSTS.Common.Priority':fieldValue(N),
  'Microsoft.VSTS.Common.Severity':fieldValue(S),'Microsoft.VSTS.Common.ValueArea':fieldValue(S),
  'Microsoft.VSTS.TCM.ReproSteps':fieldValue(S),'Microsoft.VSTS.TCM.SystemInfo':fieldValue(S),
 });
 const wi=allDefinitions.sdk_WorkItemTrackingInterfaces_WorkItem;
 wi.properties.fields=fields;
 const relationChanges={...object({added:array(ref('WorkItemTrackingInterfaces','WorkItemRelation')),removed:array(ref('WorkItemTrackingInterfaces','WorkItemRelation')),updated:array(ref('WorkItemTrackingInterfaces','WorkItemRelation'))}),title:'Azure Work Item Relation Changes'};
 const context=object({id:nullable(N),workItemId:nullable(N),rev:nullable(N),url:nullable(S),_links:nullable(links),revisedBy:nullable(ref('VSSInterfaces','IdentityRef')),revisedDate:nullable(S),fields:nullable(fields),revision:nullable(ref('WorkItemTrackingInterfaces','WorkItem')),relations:{anyOf:[array(ref('WorkItemTrackingInterfaces','WorkItemRelation')),relationChanges,{type:'null'}]},commentVersionRef:nullable(ref('WorkItemTrackingInterfaces','WorkItemCommentVersionRef'))});
 // Pipeline Job and Stage notifications carry the same execution-record fields,
 // including nullable displayName/times; reuse the Timeline Record identity.
 allDefinitions.sdk_BuildInterfaces_TimelineRecord.properties.displayName=S;
 // Release notifications use a compact deployment view, not the REST Deployment
 // object alone. Declare both documented shapes on the shared domain record.
 const deployment=allDefinitions.sdk_ReleaseInterfaces_Deployment;
 deployment.properties.status=S;
 deployment.properties.environment=ref('ReleaseInterfaces','ReleaseEnvironment');
 deployment.properties.release=ref('ReleaseInterfaces','Release');
 allDefinitions.sdk_ReleaseInterfaces_Release.properties.project=ref('CoreInterfaces','TeamProjectReference');
 // The service-hook ManualIntervention sample uses a UUID identifier while
 // REST ManualIntervention documents an integer. Both are explicit variants.
 allDefinitions.sdk_ReleaseInterfaces_ManualIntervention.properties.id={title:'Azure Manual Intervention Identifier',anyOf:[N,S]};
 allDefinitions.sdk_ReleaseInterfaces_ManualIntervention.properties.project=ref('CoreInterfaces','TeamProjectReference');
 // These DTO copies describe the very same task-agent pool entity; the
 // distributed-task form is its fuller representation, not a new identity.
 if(allDefinitions.sdk_TaskAgentInterfaces_TaskAgentPoolReference)allDefinitions.sdk_BuildInterfaces_TaskAgentPoolReference=structuredClone(allDefinitions.sdk_TaskAgentInterfaces_TaskAgentPoolReference);
 const pipelineApproval=object({id:S,status:S,createdOn:S,lastModifiedOn:S,instructions:S,minRequiredApprovers:N,executionOrder:S,blockedApprovers:array(ref('VSSInterfaces','IdentityRef')),steps:array(object({assignedApprover:ref('VSSInterfaces','IdentityRef'),actualApprover:ref('VSSInterfaces','IdentityRef'),status:S,comment:S,initiatedOn:S,lastModifiedOn:S,order:N,history:array(object({assignedTo:ref('VSSInterfaces','IdentityRef'),createdOn:S,comment:S}))})),_links:links});
 const checkResource=object({type:S,id:S,name:S});
 const comment={oneOf:[
  object({source:{const:'pull_request_comment'},parts:{type:'array',maxItems:1,items:{type:'object',required:['path','value'],properties:{path:{const:['comment']},value:nullable(ref('GitInterfaces','Comment'))},additionalProperties:false}}}),
  object({source:{const:'work_item_history'},parts:{type:'array',maxItems:2,items:{type:'object',required:['path','value'],properties:{path:{enum:[['fields','System.History'],['revision','fields','System.History']]},value:{anyOf:[S,historyChange,{type:'null'}]}},additionalProperties:false}}}),
 ]};
 for(const branch of comment.oneOf){branch.required=['source','parts'];branch.additionalProperties=false;}
 const manual={
  'def_44192693c980':{name:'Azure Link',schema:object({href:nullable(S)})},
  'def_41fde3cc1c55':{name:'Azure Links',schema:links},
  'def_3a29d4cacde5':{name:'Azure Event Message',schema:object({text:nullable(S),html:nullable(S),markdown:nullable(S)})},
  'def_1d820ba689db':{name:'Azure Resource Container',schema:object({id:nullable(S),baseUrl:nullable(S),url:nullable(S)})},
  'def_87e446ed6bec':{name:'Azure Resource Containers',schema:map(object({id:nullable(S),baseUrl:nullable(S),url:nullable(S)}))},
  'def_b2beb25d828e':{name:'Azure Work Item Context',schema:context},
  'def_0cc521d85b7d':{name:'Azure Comment',schema:comment},
  'devops.pipeline-approval':{name:'Azure Pipeline Approval',schema:pipelineApproval},
  'devops.pipeline-check-resource':{name:'Azure Pipeline Check Resource',schema:checkResource},
  'devops.work-item-fields':{name:'Azure Work Item Fields',schema:fields},
  'devops.work-item-relation-changes':{name:'Azure Work Item Relation Changes',schema:relationChanges},
  'devops.pipeline-repository-change':{name:'Azure Pipeline Repository Change',schema:object({type:S,url:S,change:object({author:ref('GitInterfaces','GitUserDate'),committer:ref('GitInterfaces','GitUserDate'),message:S})})},
 };
 for(const[id,spec]of Object.entries(manual))entries.set(id,{...spec,id,exceptions:[]});
 for(const schema of Object.values(allDefinitions))nullableProperties(schema);
 for(const entry of entries.values()){
  const base=entry.space?allDefinitions['sdk_'+entry.space+'_'+entry.name]:entry.schema;
  // SDK named roots are stored separately from their human-readable ONF labels.
  const schema=structuredClone(base??entry.schema);
  nullableProperties(schema);
  entry.schema=pruneDefinitions({...schema,definitions:structuredClone(allDefinitions)});
 }
 return {entries,definitions:allDefinitions,exceptions};
}

export function pruneDefinitions(schema){
 const available=schema.definitions??{},needed=new Set(),pending=[];
 const inspect=value=>{if(!value||typeof value!=='object')return;if(typeof value.$ref==='string'&&value.$ref.startsWith('#/definitions/')){const name=value.$ref.slice('#/definitions/'.length).split('/')[0];if(!needed.has(name)){needed.add(name);pending.push(name);}}for(const[key,child]of Object.entries(value))if(key!=='definitions'&&key!=='$defs'&&key!=='enum'&&key!=='const')inspect(child);};
 inspect(schema);while(pending.length){const name=pending.pop();if(!Object.hasOwn(available,name)){if(name==='ONFJsonValue')continue;throw Error('Missing structural definition '+name);}inspect(available[name]);}
 return completeSchema({...schema,definitions:Object.fromEntries([...needed].filter(name=>Object.hasOwn(available,name)).map(name=>[name,structuredClone(available[name])]))});
}
