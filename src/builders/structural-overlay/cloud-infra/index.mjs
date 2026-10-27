import sourceContracts from './source-contracts.json' with {type:'json'};
import {manualContracts} from './manual-contracts.mjs';
import {ContractGraph,resolveSchema} from './graph.mjs';
import {families as cloud} from '../../developer-packs-20261022/cloud.mjs';
import {families as infrastructure} from '../../developer-packs-20261022/infrastructure.mjs';
import {idFor} from '../../developer-packs-20261022/builder.mjs';
import {ref} from '../common.mjs';
export const ownedPackIds=['azure','kubernetes','prometheus','loki','grafana','alertmanager','docker','rancher','netbird','pushgateway','cert_manager','cloudnative_pg','longhorn','traefik','fleet'].map(id=>'pack_'+id);
export const families=[...cloud.filter(f=>f.id!=='azure-devops'),...infrastructure];
const metadata=snapshot=>new Map(snapshot.library.assets.map(row=>[row.definitionId,row]));
const display=value=>value.replace(/^io\.k8s\./,'').split('.').at(-1).replace(/([a-z\d])([A-Z])/g,'$1 $2').replaceAll(/[-_]/g,' ');
const operationId=(family,key)=>idFor('dev.'+family+'.'+key);
const localType=(type,family)=>type?.startsWith('@')?type.slice(1).split('.'):type?[family,type]:null;
const typeId=(family,key)=>idFor('dev.'+family+'.type.'+key);
const clone=value=>structuredClone(value);
export function reviewedOperations(snapshot){
  const byId=new Map(snapshot.definitions.map(row=>[row.id,row])),meta=metadata(snapshot),result=[];
  for(const family of families)for(const operation of family.operations){
    const id=operationId(family.id,operation.key),definition=byId.get(id);
    if(!definition||definition.name!==family.name+' '+operation.name)throw Error('Source identity/name guard failed '+id);
    if(!ownedPackIds.includes(meta.get(id)?.packId))throw Error('Provider ownership guard failed '+id);
    const compiled=clone(sourceContracts.operations[family.id+'.'+operation.key]??manualContracts[family.id+'.'+operation.key]);
    const names={'alertmanager.list-receivers':'ReceiverList','alertmanager.set-silence':'SilenceReceipt','docker.system-disk-usage':'DiskUsage'};
    if(compiled&&names[family.id+'.'+operation.key])compiled.rootName=names[family.id+'.'+operation.key];
    if(!compiled&&!['empty','text'].includes(operation.response.kind))throw Error('Missing reviewed response contract '+family.id+'.'+operation.key);
    const context=compiled?{family:family.id,providerDisplayName:family.name,name:compiled.rootName,displayName:family.name+' '+display(compiled.rootName),packId:meta.get(id).packId,folderId:meta.get(id).folderId,source:compiled.source,definitions:compiled.schema.definitions??{},originNames:compiled.originNames??{}}:undefined;
    result.push({family,operation,definition,compiled,context});
  }
  return result;
}
export function buildChanges(snapshot){
  if(!Array.isArray(snapshot.definitions)||!snapshot.library?.assets)throw Error('Sanitized catalog snapshot required');
  const graph=new ContractGraph(snapshot),byId=new Map(snapshot.definitions.map(row=>[row.id,row])),meta=metadata(snapshot),operations=reviewedOperations(snapshot);
  // One published nominal identity is reused only when all its endpoint uses describe one semantic entity.
  const candidates=new Map();
  for(const row of operations){
    if(!row.compiled)continue;
    const parts=localType(row.operation.response.type,row.family.id);if(!parts)continue;
    const id=typeId(...parts),existing=byId.get(id);if(!existing)continue;
    const identity=graph.identity(row.compiled.schema,row.context),group=candidates.get(id)??new Map();group.set(identity,row);candidates.set(id,group);
  }
  const chosen=[];
  for(const row of operations)if(row.compiled){const identity=graph.identity(row.compiled.schema,row.context);graph.expanded.add(identity);if(row.operation.response.kind==='list')graph.expanded.add(identity+'.list');}
  for(const[id,group]of candidates){
    if(group.size!==1)continue;
    const[identity,row]=[...group][0];graph.assign(identity,byId.get(id));chosen.push({id,identity,row});
    const oldList=byId.get(typeId(...localType(row.operation.response.type,row.family.id).map((part,index)=>index?part+'-list':part)));
    if(oldList)graph.assign(identity+'.list',oldList);
  }
  // The generic ARM resource is retained for heterogeneous Resources_List, never for a known AKS/storage/etc endpoint.
  const generic=operations.find(row=>row.family.id==='azure'&&row.operation.key==='resources-list');
  if(generic){const identity=graph.identity(generic.compiled.schema,generic.context);graph.assign(identity,byId.get(typeId('azure','resource')));graph.assign(identity+'.list',byId.get(typeId('azure','resource-list')));}
  // NetBird's list PeerBatch adds accessible_peers_count; get Peer retains the established full Peer identity.
  const peer=operations.find(row=>row.family.id==='netbird'&&row.operation.key==='get-peer');
  if(peer)graph.assign(graph.identity(peer.compiled.schema,peer.context),byId.get(typeId('netbird','peer')));
  const updates=[];
  for(const row of operations){
    const{operation,definition,compiled,context}=row;if(!compiled)continue;
    const item=graph.ensure(compiled.schema,context);
    let descriptor=item;
    if(operation.response.kind==='list'){
      const identity=graph.identity(compiled.schema,context)+'.list';
      descriptor=graph.ensure({type:'array',items:compiled.schema,maxItems:5000},{...context,name:compiled.rootName+'List',displayName:context.displayName+' List',identity,itemRef:item});
    }
    const outputId=operation.response.kind==='list'?'items':operation.response.kind==='item'?'item':'value';
    if(!definition.outputs.some(port=>port.id===outputId))throw Error('Live output shape drift '+definition.id+' '+outputId);
    const outputs=definition.outputs.map(port=>port.id===outputId?{...port,...descriptor}:port);
    updates.push({id:definition.id,expectedVersion:definition.version,patch:{outputs,documentation:definition.documentation+'\n\n## Reviewed response contract — 23 October 2026\n\nThe '+outputId+' socket uses the exact structural '+context.displayName+' contract. Known nested fields and list elements remain typed; source-specific unknown/plugin dictionaries are finite JSON extensions. Existing status, asynchronous operation metadata and explicit continuation controls are retained. No request, auth, retry or effect behavior changes.\n\nPrimary response schema: '+compiled.source},reason:'Replace generic/underspecified response boundary with the documented endpoint entity and matching structural list/codec contracts'});
  }
  // Preserve useful generic base contracts for mixed-kind endpoints and historical users, while typing their common fields.
  const unusedTypes=snapshot.definitions.filter(d=>d.kind==='type'&&ownedPackIds.includes(meta.get(d.id)?.packId)&&!graph.updates.some(u=>u.id===d.id));
  for(const definition of unusedTypes){
    if(definition.schema.type==='array')continue;
    const family=families.find(f=>f.types.some(t=>typeId(f.id,t.key)===definition.id));
    if(!family)throw Error('Unreviewed owned type '+definition.name);
    const identity='legacy-shared.'+definition.id;graph.assign(identity,definition);
    const schema=clone(definition.schema);
    if(definition.name==='Kubernetes Resource'){
      const pod=operations.find(row=>row.family.id==='kubernetes'&&row.operation.key==='get-pod'),root=resolveSchema(pod.compiled.schema,pod.compiled.schema.definitions);
      schema.properties.metadata=clone(root.properties.metadata);schema.definitions={...schema.definitions,...pod.compiled.schema.definitions};
    }
    if(definition.name==='Azure Vault Item Metadata')schema.properties.attributes={type:'object',properties:{enabled:{type:'boolean'},nbf:{type:'integer'},exp:{type:'integer'},created:{type:'integer'},updated:{type:'integer'},recoveryLevel:{type:'string'},recoverableDays:{type:'integer'},exportable:{type:'boolean'}},additionalProperties:{$ref:'#/definitions/ONFJsonValue'}};
    graph.ensure(schema,{family:family.id,name:definition.name,displayName:definition.name,packId:meta.get(definition.id).packId,folderId:meta.get(definition.id).folderId,source:family.sources.join(' '),definitions:schema.definitions??{},identity});
  }
  for(const definition of unusedTypes.filter(d=>d.schema.type==='array')){
    if(graph.updates.some(u=>u.id===definition.id))continue;
    const codec=snapshot.definitions.find(d=>meta.get(d.id)?.codec?.mode==='decode'&&d.inputs.some(p=>p.id==='value'&&p.type===definition.id));
    const itemPort=codec?.outputs.find(p=>p.id==='item'),item=graph.entries.values().find(entry=>entry.existing?.id===itemPort?.type);
    if(!item)throw Error('Unreviewed list element '+definition.name);
    const identity='legacy-list.'+definition.id;graph.assign(identity,definition);
    graph.ensure({...definition.schema,items:item.schema},{...item.context,name:definition.name,displayName:definition.name,identity,itemRef:item.ref});
  }
  updates.push(...graph.updates);
  const duplicate=updates.find((u,index)=>updates.findIndex(v=>v.id===u.id)!==index);if(duplicate)throw Error('Duplicate guarded update '+duplicate.id);
  const updateIds=new Set(updates.map(row=>row.id)),owned=snapshot.definitions.filter(d=>ownedPackIds.includes(meta.get(d.id)?.packId));
  const audit=owned.map(definition=>{
    const op=operations.find(row=>row.definition.id===definition.id),org=meta.get(definition.id);
    return {id:definition.id,name:definition.name,kind:definition.kind,packId:org.packId,version:definition.version,verdict:updateIds.has(definition.id)?'corrected':'retained',reason:updateIds.has(definition.id)?updates.find(u=>u.id===definition.id).reason:op?.operation.response.kind==='text'?'Intentional bounded exposition/log text; no JSON body is claimed':op?.operation.response.kind==='empty'?'Intentional status/async receipt only; provider action has no success JSON body':'Preserved historical mixed-kind type identity with explicit extension dictionaries',reviewedInputs:definition.inputs.length,reviewedOutputs:definition.outputs.length,source:op?.compiled?.source??op?.operation.source??op?.family.sources?.join(' '),dynamicExceptions:org.codec?[]:graph.dynamic.filter(path=>path.path.startsWith(op?.compiled?.rootName??'\0'))};
  });
  return {updates,additions:graph.additions,audit,summary:{ownedDefinitions:owned.length,operations:operations.length,updates:updates.length,newTypes:graph.additions.filter(row=>row.definition.kind==='type').length,newCodecMembers:graph.additions.filter(row=>row.codec).length,publicSources:Object.keys(sourceContracts.sources).length,dynamicBoundaries:graph.dynamic.length},dynamicExceptions:graph.dynamic};
}
export function buildRecipes(snapshot){
  const changes=buildChanges(snapshot),updates=new Map(changes.updates.map(row=>[row.id,row])),recipes=[];
  for(const row of reviewedOperations(snapshot)){
    if(row.operation.effect!=='read'||row.operation.response.kind==='empty')continue;
    const patch=updates.get(row.definition.id),port=(patch?.patch.outputs??row.definition.outputs).find(p=>['item','items','value'].includes(p.id));
    const addition=port?.type.startsWith('@')?changes.additions.find(a=>a.key===port.type.slice(1)):undefined;
    const decoder=addition?changes.additions.find(a=>a.key===addition.key+'.decode'):snapshot.definitions.find(d=>snapshot.library.assets.find(m=>m.definitionId===d.id)?.codec?.mode==='decode'&&d.inputs.some(p=>p.id==='value'&&p.type===port?.type));
    const nodes=[{key:'read',definitionId:row.definition.id,inputs:clone(row.operation.sampleInputs),config:{maxPages:1,maxItems:100,requestTimeoutMs:15000}}],edges=[];
    const decoderDefinition=decoder?.definition??decoder;
    if(decoderDefinition?.inputs.some(p=>p.id==='value'&&p.type===port.type)&&decoderDefinition.outputs.some(p=>!['control'].includes(p.type)&&p.id!=='text')){nodes.push({key:'inspect',definitionId:decoder.key?'@'+decoder.key:decoder.id});edges.push({source:'read',sourceHandle:port.id,target:'inspect',targetHandle:'value'});}
    recipes.push({packId:snapshot.library.assets.find(m=>m.definitionId===row.definition.id).packId,key:row.family.id+'.'+row.operation.key,name:row.family.name+' — '+row.operation.name,description:row.operation.description+' Read-only example; configure an authorized synthetic/test endpoint before unpausing.',nodes,edges,requiresProvider:true,effect:'read',entryPayload:{}});
  }
  return recipes;
}
