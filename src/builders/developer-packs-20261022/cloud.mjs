import {s,n,i,b,o,a,record,json,input} from './schema.mjs';
import resources from './cloud-spec-resources.json' with {type:'json'};
import subscriptions from './cloud-spec-subscriptions.json' with {type:'json'};
import compute from './cloud-spec-compute.json' with {type:'json'};
import aks from './cloud-spec-aks.json' with {type:'json'};
import storage from './cloud-spec-storage.json' with {type:'json'};
import storageBlob from './cloud-spec-storageBlob.json' with {type:'json'};
import storageFile from './cloud-spec-storageFile.json' with {type:'json'};
import storageQueue from './cloud-spec-storageQueue.json' with {type:'json'};
import storageTable from './cloud-spec-storageTable.json' with {type:'json'};
import acr from './cloud-spec-acr.json' with {type:'json'};
import acrTasks from './cloud-spec-acrTasks.json' with {type:'json'};
import secrets from './cloud-spec-keyvault.json' with {type:'json'};
import keys from './cloud-spec-keyvaultKeys.json' with {type:'json'};
import certificates from './cloud-spec-keyvaultCertificates.json' with {type:'json'};
import servicebus from './cloud-spec-servicebus.json' with {type:'json'};
import sbQueue from './cloud-spec-servicebusQueue.json' with {type:'json'};
import sbTopics from './cloud-spec-servicebusTopics.json' with {type:'json'};
import sbSubscriptions from './cloud-spec-servicebusSubscriptions.json' with {type:'json'};
import sbRules from './cloud-spec-servicebusRules.json' with {type:'json'};
import metrics from './cloud-spec-metrics.json' with {type:'json'};
import metricDefinitions from './cloud-spec-metricDefinitions.json' with {type:'json'};
import metricAlerts from './cloud-spec-metricAlerts.json' with {type:'json'};
import actionGroups from './cloud-spec-actionGroups.json' with {type:'json'};
import activityLogs from './cloud-spec-activityLogs.json' with {type:'json'};
import webApps from './cloud-spec-webApps.json' with {type:'json'};
import webPlans from './cloud-spec-webPlans.json' with {type:'json'};
import sqlServers from './cloud-spec-sqlServers.json' with {type:'json'};
import sqlDatabases from './cloud-spec-sqlDatabases.json' with {type:'json'};
import sqlPools from './cloud-spec-sqlPools.json' with {type:'json'};
import sqlFirewall from './cloud-spec-sqlFirewall.json' with {type:'json'};
import existingTypes from './cloud-existing-types.json' with {type:'json'};

const ARM='https://management.azure.com';
const ARM_SCOPE='Azure RBAC for the selected resource; bearer token audience https://management.azure.com/.default. No keys or connection strings are requested.';
const str=(required=true,description='')=>({type:'string',...(required?{required:true}:{}),description});
const num=(required=true)=>({type:'number',...(required?{required:true}:{}),schema:{type:'integer',minimum:1,maximum:2147483647}});
const rec=(required=true)=>({type:'record',...(required?{required:true}:{})});
const samples={subscriptionId:'00000000-0000-4000-8000-000000000001',resourceGroupName:'sample-rg',resourceName:'sample-cluster',vmName:'sample-vm',location:'westeurope',accountName:'samplestorage',containerName:'sample-container',shareName:'sample-share',queueName:'sample-queue',tableName:'SampleTable',registryName:'sampleregistry',namespaceName:'sample-servicebus',topicName:'sample-topic',subscriptionName:'sample-subscription',ruleName:'sample-rule',agentPoolName:'nodepool1',configName:'aksManagedAutoUpgradeSchedule',replicationName:'westeurope',taskName:'sample-task',runId:'sample-run',webhookName:'sample-webhook',providerNamespace:'Microsoft.Compute',resourceProviderNamespace:'Microsoft.Compute',resourceType:'virtualMachines',parentResourcePath:'',resourceApiVersion:'2024-07-01',scope:'/subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/sample-rg',secretName:'sample-secret',keyName:'sample-key',keyVersion:'00000000000000000000000000000001',certificateName:'sample-certificate',certificateVersion:'00000000000000000000000000000001',name:'sample',resourceId:'/subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/sample-rg/providers/Microsoft.Compute/virtualMachines/sample-vm'};
export const armSample={id:samples.resourceId,name:'sample-vm',type:'Microsoft.Compute/virtualMachines',location:'westeurope',tags:{purpose:'synthetic'},properties:{provisioningState:'Succeeded'}};
const camel=name=>name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
function fromSpec(spec,operationId,key,name,extra={}){
 const found=spec.operations.find(x=>x.operationId===operationId);if(!found)throw Error('Unknown reviewed operation '+operationId);
 const names=[...found.path.matchAll(/\{([^}]+)\}/g)].map(m=>camel(m[1]));
 const inputs=Object.fromEntries(names.map(name=>[name,str()]));
 let path=found.path.replace(/\{([^}]+)\}/g,(_,name)=>`{${camel(name)}${['scope','resourceId','resourceUri'].includes(camel(name))?'*':''}}`);
 if(/^\/\{(?:scope|resourceId|resourceUri)\*\}/.test(path))path=path.slice(1);
 const list=extra.list??false,method=found.method.toUpperCase();
 const response=extra.response??{kind:list?'list':'item',...(list?{path:['value']}:{}),type:'@azure.resource',...(!list?{select:{id:['id'],name:['name'],location:['location']}}:{})};
 const resourceType=found.path.match(/providers\/(Microsoft\.[^/]+)\/(.+)/)?.slice(1).map((v,index)=>index?v.split('/').filter(p=>!p.startsWith('{')&&!['default','get','start','stop','restart','listUsages'].includes(p)).join('/'):v).join('/')??'Microsoft.Resources/resourceGroups';
 const synthetic={...structuredClone(armSample),id:found.path.replace(/\{([^}]+)\}/g,(_,n)=>samples[camel(n)]??'sample'),name:samples[names.at(-1)]??'sample',type:resourceType,properties:{provisioningState:'Succeeded'}};
 if(found.path.includes('Microsoft.ServiceBus'))Object.assign(synthetic.properties,{status:'Active',messageCount:0,countDetails:{activeMessageCount:0,deadLetterMessageCount:0}});
 const out={key,name,method,effect:method==='GET'||method==='HEAD'?'read':method==='DELETE'?'delete':'write',path,...extra,inputs:{...inputs,...extra.inputs},query:{'api-version':spec.version,...extra.query},response,description:extra.description??`${name} for the explicitly selected Azure scope. ${method==='GET'?'Returns one bounded page or selected resource metadata.':'External action; confirmWrites is required and automatic retries are prohibited.'}`,source:spec.source,sourceOperationId:operationId,scopes:extra.scopes??ARM_SCOPE,sampleInputs:Object.fromEntries(Object.keys({...inputs,...extra.inputs}).map(k=>[k,extra.sampleInputs?.[k]??samples[k]??'sample'])),sampleResponse:extra.sampleResponse??(list?{value:[synthetic]}:synthetic),...(list?{paging:extra.paging??{kind:'url',path:['nextLink']}}:{})};
 delete out.list;
 return out;
}
const empty={kind:'empty'};
const action=(spec,id,key,name,extra={})=>fromSpec(spec,id,key,name,{response:empty,sampleResponse:{},sampleStatus:202,...extra});
const family=(id,name,operations,extra={})=>({id,name,color:'#0078d4',icon:'Cloud',description:`Useful scoped ${name} operations with explicit actions, bounded paging and guarded credentials.`,baseUrl:ARM,auth:{kind:'bearer',secret:'AZURE_ARM_ACCESS_TOKEN'},sources:[...new Set(operations.map(x=>x.source))],types:[],operations,...extra});
const azureOps=[
 fromSpec(subscriptions,'Subscriptions_List','subscriptions-list','List Subscriptions',{list:true,response:{kind:'list',path:['value'],type:'subscription'},sampleResponse:{value:[{subscriptionId:samples.subscriptionId,displayName:'Synthetic Subscription',state:'Enabled'}]}}),
 fromSpec(subscriptions,'Subscriptions_Get','subscription-get','Get Subscription',{response:{kind:'item',type:'subscription'},sampleResponse:{subscriptionId:samples.subscriptionId,displayName:'Synthetic Subscription',state:'Enabled'}}),
 fromSpec(subscriptions,'Subscriptions_ListLocations','locations-list','List Subscription Locations',{list:true,response:{kind:'list',path:['value'],type:'location'},sampleResponse:{value:[{id:'/subscriptions/'+samples.subscriptionId+'/locations/westeurope',name:'westeurope',displayName:'West Europe',regionalDisplayName:'(Europe) West Europe'}]}}),
 fromSpec(resources,'ResourceGroups_List','resource-groups-list','List Resource Groups',{list:true}),
 fromSpec(resources,'ResourceGroups_Get','resource-group-get','Get Resource Group'),
 fromSpec(resources,'ResourceGroups_CreateOrUpdate','resource-group-create','Create or Update Resource Group',{inputs:{location:str(),tags:rec(false)},body:{location:input('location'),tags:input('tags',true)},sampleInputs:{location:'westeurope',tags:{purpose:'synthetic'}}}),
 fromSpec(resources,'ResourceGroups_Update','resource-group-tags-update','Update Resource Group Tags',{inputs:{tags:rec()},body:{tags:input('tags')},sampleInputs:{tags:{purpose:'synthetic'}}}),
 fromSpec(resources,'Resources_List','resources-list','List Subscription Resources',{list:true}),
 fromSpec(resources,'Resources_ListByResourceGroup','group-resources-list','List Resource Group Resources',{list:true}),
 fromSpec(resources,'Providers_List','providers-list','List Resource Providers',{list:true,response:{kind:'list',path:['value'],type:'provider'},sampleResponse:{value:[{namespace:'Microsoft.Compute',registrationState:'Registered',resourceTypes:[{resourceType:'virtualMachines',apiVersions:['2024-07-01'],locations:['West Europe']}]}]}}),
 fromSpec(resources,'Providers_Get','provider-get','Get Resource Provider',{response:{kind:'item',type:'provider'},sampleResponse:{namespace:'Microsoft.Compute',registrationState:'Registered',resourceTypes:[]}}),
 fromSpec(resources,'Tags_GetAtScope','tags-get','Get Resource Scope Tags'),
 fromSpec(resources,'Tags_UpdateAtScope','tags-merge','Merge Resource Scope Tags',{inputs:{tags:rec()},body:{operation:'Merge',properties:{tags:input('tags')}},sampleInputs:{tags:{purpose:'synthetic'}}}),
 fromSpec(compute,'VirtualMachines_ListAll','virtual-machines-list','List Virtual Machines',{list:true}),
 fromSpec(compute,'VirtualMachines_List','group-virtual-machines-list','List Resource Group Virtual Machines',{list:true}),
 fromSpec(compute,'VirtualMachines_Get','virtual-machine-get','Get Virtual Machine'),
 fromSpec(compute,'VirtualMachines_InstanceView','virtual-machine-state-get','Get Virtual Machine Instance View',{response:{kind:'json'},sampleResponse:{statuses:[{code:'PowerState/running',displayStatus:'VM running'}]}}),
 fromSpec(compute,'VirtualMachines_ListAvailableSizes','virtual-machine-sizes-list','List Virtual Machine Resize Options',{list:true,response:{kind:'list',path:['value'],type:'vm-size'},sampleResponse:{value:[{name:'Standard_B2s',numberOfCores:2,memoryInMB:4096,maxDataDiskCount:4,osDiskSizeInMB:1047552,resourceDiskSizeInMB:8192}]}}),
 action(compute,'VirtualMachines_Start','virtual-machine-start','Start Virtual Machine'),
 action(compute,'VirtualMachines_PowerOff','virtual-machine-power-off','Power Off Virtual Machine',{description:'Power off the selected VM. Billing for allocated compute may continue; use Deallocate to release allocation.'}),
 action(compute,'VirtualMachines_Deallocate','virtual-machine-deallocate','Deallocate Virtual Machine'),
 action(compute,'VirtualMachines_Restart','virtual-machine-restart','Restart Virtual Machine')
];
const aksOps=[
 ...[['ManagedClusters_List','clusters-list','List AKS Clusters'],['ManagedClusters_ListByResourceGroup','group-clusters-list','List Resource Group AKS Clusters'],['AgentPools_List','node-pools-list','List AKS Node Pools'],['MaintenanceConfigurations_ListByManagedCluster','maintenance-list','List AKS Maintenance Configurations'],['PrivateEndpointConnections_List','private-endpoints-list','List AKS Private Endpoint Connections'],['TrustedAccessRoleBindings_List','trusted-access-list','List AKS Trusted Access Role Bindings']].map(([id,key,name])=>fromSpec(aks,id,key,name,{list:true})),
 ...[['ManagedClusters_Get','cluster-get','Get AKS Cluster'],['AgentPools_Get','node-pool-get','Get AKS Node Pool'],['MaintenanceConfigurations_Get','maintenance-get','Get AKS Maintenance Configuration'],['ManagedClusters_GetUpgradeProfile','cluster-upgrades-get','Get AKS Upgrade Profile'],['AgentPools_GetUpgradeProfile','node-pool-upgrades-get','Get AKS Node Pool Upgrade Profile']].map(([id,key,name])=>fromSpec(aks,id,key,name)),
 fromSpec(aks,'ManagedClusters_UpdateTags','cluster-tags-update','Update AKS Cluster Tags',{inputs:{tags:rec()},body:{tags:input('tags')},sampleInputs:{tags:{purpose:'synthetic'}},response:{kind:'item',type:'@azure.resource',optional:true}}),
 action(aks,'ManagedClusters_Start','cluster-start','Start AKS Cluster'),action(aks,'ManagedClusters_Stop','cluster-stop','Stop AKS Cluster'),
 action(aks,'AgentPools_UpgradeNodeImageVersion','node-pool-image-upgrade','Upgrade AKS Node Pool Image')
];
const storageOps=[
 fromSpec(storage,'StorageAccounts_List','accounts-list','List Storage Accounts',{list:true}),fromSpec(storage,'StorageAccounts_ListByResourceGroup','group-accounts-list','List Resource Group Storage Accounts',{list:true}),fromSpec(storage,'StorageAccounts_GetProperties','account-get','Get Storage Account Metadata'),
 ...[[storageBlob,'BlobContainers_List','blob-containers-list','List Blob Container Metadata'],[storageFile,'FileShares_List','file-shares-list','List File Share Metadata'],[storageQueue,'Queue_List','queues-list','List Storage Queue Metadata'],[storageTable,'Table_List','tables-list','List Storage Table Metadata']].map(([spec,id,key,name])=>fromSpec(spec,id,key,name,{list:true})),
 ...[[storageBlob,'BlobContainers_Get','blob-container-get','Get Blob Container Metadata'],[storageFile,'FileShares_Get','file-share-get','Get File Share Metadata'],[storageQueue,'Queue_Get','queue-get','Get Storage Queue Metadata'],[storageTable,'Table_Get','table-get','Get Storage Table Metadata']].map(([spec,id,key,name])=>fromSpec(spec,id,key,name)),
 fromSpec(storageBlob,'BlobContainers_Create','blob-container-create','Create Private Blob Container',{body:{properties:{publicAccess:'None'}}}),
 fromSpec(storageFile,'FileShares_Create','file-share-create','Create File Share',{inputs:{shareQuota:num()},body:{properties:{shareQuota:input('shareQuota')}},sampleInputs:{shareQuota:100}}),
 fromSpec(storageQueue,'Queue_Create','queue-create','Create Storage Queue',{body:{properties:{}}}),
 fromSpec(storageTable,'Table_Create','table-create','Create Storage Table',{body:{properties:{}}})
];
const sbOps=[
 fromSpec(servicebus,'Namespaces_List','namespaces-list','List Service Bus Namespaces',{list:true}),fromSpec(servicebus,'Namespaces_ListByResourceGroup','group-namespaces-list','List Resource Group Service Bus Namespaces',{list:true}),fromSpec(servicebus,'Namespaces_Get','namespace-get','Get Service Bus Namespace'),
 ...[[sbQueue,'Queues_ListByNamespace','queues-list','List Service Bus Queues'],[sbTopics,'Topics_ListByNamespace','topics-list','List Service Bus Topics'],[sbSubscriptions,'Subscriptions_ListByTopic','subscriptions-list','List Topic Subscriptions'],[sbRules,'Rules_ListBySubscriptions','rules-list','List Subscription Rules']].map(([spec,id,key,name])=>fromSpec(spec,id,key,name,{list:true})),
 ...[[sbQueue,'Queues_Get','queue-get','Get Service Bus Queue and Counts'],[sbTopics,'Topics_Get','topic-get','Get Service Bus Topic'],[sbSubscriptions,'Subscriptions_Get','subscription-get','Get Topic Subscription and Counts'],[sbRules,'Rules_Get','rule-get','Get Subscription Rule']].map(([spec,id,key,name])=>fromSpec(spec,id,key,name)),
 fromSpec(sbQueue,'Queues_CreateOrUpdate','queue-create','Create or Update Service Bus Queue',{inputs:{lockDuration:{...str(false),default:'PT1M'},maxDeliveryCount:{...num(false),default:10}},body:{properties:{lockDuration:input('lockDuration'),maxDeliveryCount:input('maxDeliveryCount')}},sampleInputs:{lockDuration:'PT1M',maxDeliveryCount:10}}),
 fromSpec(sbTopics,'Topics_CreateOrUpdate','topic-create','Create or Update Service Bus Topic',{body:{properties:{}}}),
 fromSpec(sbSubscriptions,'Subscriptions_CreateOrUpdate','subscription-create','Create or Update Topic Subscription',{inputs:{maxDeliveryCount:{...num(false),default:10}},body:{properties:{maxDeliveryCount:input('maxDeliveryCount')}},sampleInputs:{maxDeliveryCount:10}}),
 fromSpec(sbRules,'Rules_CreateOrUpdate','sql-rule-set','Set Subscription SQL Filter',{inputs:{sqlExpression:str()},body:{properties:{filterType:'SqlFilter',sqlFilter:{sqlExpression:input('sqlExpression')}}},sampleInputs:{sqlExpression:"priority = 'high'"}})
];
const acrOps=[
 ...[['Registries_List','registries-list','List Container Registries'],['Registries_ListByResourceGroup','group-registries-list','List Resource Group Container Registries'],['Replications_List','replications-list','List Registry Replications'],['Webhooks_List','webhooks-list','List Registry Webhooks'],['CacheRules_List','cache-rules-list','List Registry Cache Rules'],['Registries_ListPrivateLinkResources','private-links-list','List Registry Private Link Resources']].map(([id,key,name])=>fromSpec(acr,id,key,name,{list:true})),
 ...[['Registries_Get','registry-get','Get Container Registry'],['Replications_Get','replication-get','Get Registry Replication'],['Webhooks_Get','webhook-get','Get Registry Webhook'],['CacheRules_Get','cache-rule-get','Get Registry Cache Rule']].map(([id,key,name])=>fromSpec(acr,id,key,name)),
 fromSpec(acrTasks,'Tasks_List','tasks-list','List Registry Tasks',{list:true}),fromSpec(acrTasks,'Tasks_Get','task-get','Get Registry Task'),fromSpec(acrTasks,'Runs_List','runs-list','List Registry Task Runs',{list:true}),fromSpec(acrTasks,'Runs_Get','run-get','Get Registry Task Run'),
 action(acrTasks,'Runs_Cancel','run-cancel','Cancel Registry Task Run',{sampleStatus:200})
];
const vaultMetadataSample={id:'https://sample-vault.vault.azure.net/secrets/sample-secret',attributes:{enabled:true,created:1767225600,updated:1767225600},contentType:'text/plain',managed:false,tags:{purpose:'synthetic'}};
const vaultCertificateSample={id:'https://sample-vault.vault.azure.net/certificates/sample-certificate/'+samples.certificateVersion,kid:'https://sample-vault.vault.azure.net/keys/sample-certificate/'+samples.certificateVersion,sid:'https://sample-vault.vault.azure.net/secrets/sample-certificate/'+samples.certificateVersion,cer:'U1lOVEhFVElDLVBVQkxJQy1DRVJUSUZJQ0FURQ==',attributes:{enabled:true,exp:1893456000},policy:{x509_props:{subject:'CN=sample.example.com'}}};
const vaultOps=[
 ...[[secrets,'GetSecrets','secrets-metadata-list','List Secret Metadata'],[secrets,'GetSecretVersions','secret-versions-list','List Secret Version Metadata'],[secrets,'GetDeletedSecrets','deleted-secrets-metadata-list','List Deleted Secret Metadata'],[keys,'GetKeys','keys-metadata-list','List Key Metadata'],[keys,'GetKeyVersions','key-versions-list','List Key Version Metadata'],[keys,'GetDeletedKeys','deleted-keys-metadata-list','List Deleted Key Metadata'],[certificates,'GetCertificates','certificates-metadata-list','List Certificate Metadata'],[certificates,'GetCertificateVersions','certificate-versions-list','List Certificate Version Metadata'],[certificates,'GetDeletedCertificates','deleted-certificates-metadata-list','List Deleted Certificate Metadata']].map(([spec,id,key,name])=>fromSpec(spec,id,key,name,{list:true,response:{kind:'list',path:['value'],type:'metadata'},sampleResponse:{value:[structuredClone(vaultMetadataSample)]},scopes:'Token audience https://vault.azure.net/.default; selected keys/list, secrets/list or certificates/list permission. Returns identifiers and attributes, never secret values.'})),
 fromSpec(certificates,'GetCertificate','certificate-get','Get Public Certificate',{response:{kind:'item',type:'certificate',select:{id:['id'],public_certificate:['cer']}},sampleResponse:vaultCertificateSample,scopes:'certificates/get; public DER certificate only, no backing secret/private-key read.'}),
 fromSpec(certificates,'GetCertificatePolicy','certificate-policy-get','Get Certificate Policy',{response:{kind:'json'},sampleResponse:{id:'https://sample-vault.vault.azure.net/certificates/sample-certificate/policy',x509_props:{subject:'CN=sample.example.com'},key_props:{exportable:false,kty:'RSA',key_size:2048}}}),
 fromSpec(certificates,'GetCertificateOperation','certificate-operation-get','Get Pending Certificate Operation',{response:{kind:'json'},sampleResponse:{id:'https://sample-vault.vault.azure.net/certificates/sample-certificate/pending',status:'inProgress',cancellation_requested:false}}),
 fromSpec(keys,'GetKey','public-key-get','Get Public Key',{response:{kind:'json'},sampleResponse:{key:{kid:'https://sample-vault.vault.azure.net/keys/sample-key/'+samples.keyVersion,kty:'RSA',key_ops:['verify'],n:'c3ludGhldGlj',e:'AQAB'},attributes:{enabled:true}},scopes:'keys/get; public JWK only. No decrypt, release, backup or private-key operation.'}),
 fromSpec(keys,'GetKeyRotationPolicy','key-rotation-policy-get','Get Key Rotation Policy',{response:{kind:'json'},sampleResponse:{id:'https://sample-vault.vault.azure.net/keys/sample-key/rotationpolicy',lifetimeActions:[{trigger:{timeBeforeExpiry:'P30D'},action:{type:'Rotate'}}],attributes:{expiryTime:'P90D'}}})
];
for(const operation of vaultOps.filter(op=>op.response.kind==='list')){
 const sample=operation.sampleResponse.value[0];
 if(operation.source.includes('/keys.json')){sample.kid=sample.id.replace('/secrets/','/keys/');delete sample.id;delete sample.contentType;}
 else if(operation.source.includes('/certificates.json')){sample.id=sample.id.replace('/secrets/','/certificates/');delete sample.contentType;sample.x5t='c3ludGhldGljLXRodW1icHJpbnQ';}
}
const acDoc=part=>'https://learn.microsoft.com/en-us/azure/azure-app-configuration/rest-api-'+part;
const settingSample={etag:'synthetic-etag',key:'app:message',label:'dev',content_type:'text/plain',value:'Synthetic setting',last_modified:'2026-01-01T00:00:00Z',locked:false,tags:{purpose:'synthetic'}};
const snapshotSample={etag:'synthetic-snapshot-etag',name:'sample-snapshot',status:'ready',filters:[{key:'app:*',label:'dev'}],composition_type:'key',created:'2026-01-01T00:00:00Z',size:128,items_count:1,tags:{purpose:'synthetic'},retention_period:86400};
function appconfig(key,name,path,{method='GET',kind='item',type='setting',source='key-value',inputs={},query={},body,sampleResponse,sampleInputs={},headers={},...extra}={}){
 const params=Object.fromEntries([...path.matchAll(/\{([^}]+)\}/g)].map(m=>[m[1],str()]));
 return{key,name,method,effect:method==='GET'||method==='HEAD'?'read':method==='DELETE'?'delete':'write',path,inputs:{...params,...inputs},query:{'api-version':'2023-11-01',...query},headers,accept:kind==='list'?'application/vnd.microsoft.appconfig.kvset+json':'application/vnd.microsoft.appconfig.kv+json',response:{kind,...(kind==='list'?{path:['items']}:{}),...(kind==='item'||kind==='list'?{type}:{}),headerSelect:{etag:'etag'}},...(kind==='list'?{paging:{kind:'url',path:['@nextLink']}}:{}),...(body?{body}:{}),source:acDoc(source),description:`${name} at the explicitly configured App Configuration store. Selected values can be sensitive; outputs remain local to the workflow. Mutations require confirmWrites and never retry.`,scopes:'App Configuration Data Reader/Owner; Entra token audience https://azconfig.io/.default. Configure the store endpoint, not an ARM endpoint.',sampleInputs:{...Object.fromEntries(Object.keys({...params,...inputs}).map(k=>[k,k==='name'?'sample-snapshot':k==='key'?'app:message':k==='etag'?'synthetic-etag':k==='label'?'dev':'sample'])),...sampleInputs},sampleResponse:sampleResponse??(kind==='list'?{items:[structuredClone(settingSample)]}:structuredClone(settingSample)),...extra};
}
const settingInputs={label:str(false)};
const settingQuery={label:input('label',true)};
const appconfigOps=[
 appconfig('settings-list','List Configuration Settings','/kv',{kind:'list',inputs:{key:str(false),...settingInputs},query:{key:input('key',true),...settingQuery}}),
 appconfig('setting-get','Get Configuration Setting','/kv/{key}',{inputs:settingInputs,query:settingQuery}),
 appconfig('revisions-list','List Configuration Revisions','/revisions',{kind:'list',source:'revisions',inputs:{key:str(false),...settingInputs},query:{key:input('key',true),...settingQuery}}),
 appconfig('keys-list','List Configuration Key Names','/keys',{kind:'list',type:'name',source:'keys',inputs:{name:str(false)},query:{name:input('name',true)},sampleResponse:{items:[{name:'app:message'}]},accept:'application/vnd.microsoft.appconfig.keyset+json'}),
 appconfig('labels-list','List Configuration Label Names','/labels',{kind:'list',type:'name',source:'labels',inputs:{name:str(false)},query:{name:input('name',true)},sampleResponse:{items:[{name:'dev'}]},accept:'application/vnd.microsoft.appconfig.labelset+json'}),
 appconfig('setting-set','Set Configuration Setting With ETag','/kv/{key}',{method:'PUT',inputs:{...settingInputs,etag:str(),value:str(),contentType:str(false),tags:rec(false)},query:settingQuery,headers:{'if-match':input('etag')},body:{value:input('value'),content_type:input('contentType',true),tags:input('tags',true)},sampleInputs:{value:'Synthetic setting',contentType:'text/plain',tags:{purpose:'synthetic'}}}),
 appconfig('setting-delete','Delete Configuration Setting With ETag','/kv/{key}',{method:'DELETE',inputs:{...settingInputs,etag:str()},query:settingQuery,headers:{'if-match':input('etag')}}),
 appconfig('setting-lock','Lock Configuration Setting','/locks/{key}',{method:'PUT',source:'locks',inputs:{...settingInputs,etag:str()},query:settingQuery,headers:{'if-match':input('etag')},sampleResponse:{...settingSample,locked:true}}),
 appconfig('setting-unlock','Unlock Configuration Setting','/locks/{key}',{method:'DELETE',source:'locks',inputs:{...settingInputs,etag:str()},query:settingQuery,headers:{'if-match':input('etag')}}),
 appconfig('snapshots-list','List Configuration Snapshots','/snapshots',{kind:'list',type:'snapshot',source:'snapshot',sampleResponse:{items:[snapshotSample]},accept:'application/vnd.microsoft.appconfig.snapshotset+json'}),
 appconfig('snapshot-get','Get Configuration Snapshot','/snapshots/{name}',{type:'snapshot',source:'snapshot',sampleResponse:snapshotSample,accept:'application/vnd.microsoft.appconfig.snapshot+json'}),
 appconfig('snapshot-settings-list','List Snapshot Settings','/kv',{kind:'list',source:'snapshot',inputs:{snapshot:str()},query:{snapshot:input('snapshot')},sampleInputs:{snapshot:'sample-snapshot'}}),
 appconfig('snapshot-create','Create Configuration Snapshot','/snapshots/{name}',{method:'PUT',type:'snapshot',source:'snapshot',inputs:{keyFilter:str(),label:str(false),retentionSeconds:{...num(false),default:86400,schema:{type:'integer',minimum:3600,maximum:7776000}}},body:{filters:[{key:input('keyFilter'),label:input('label',true)}],retention_period:input('retentionSeconds')},sampleInputs:{keyFilter:'app:*',label:'dev',retentionSeconds:86400},sampleResponse:{...snapshotSample,status:'provisioning'},sampleStatus:201,contentType:'application/vnd.microsoft.appconfig.snapshot+json',accept:'application/vnd.microsoft.appconfig.snapshot+json'}),
 ...[['snapshot-archive','Archive Configuration Snapshot','archived'],['snapshot-recover','Recover Configuration Snapshot','ready']].map(([key,name,status])=>appconfig(key,name,'/snapshots/{name}',{method:'PATCH',type:'snapshot',source:'snapshot',inputs:{etag:str()},headers:{'if-match':input('etag')},body:{status},sampleResponse:{...snapshotSample,status},contentType:'application/vnd.microsoft.appconfig.snapshot+json',accept:'application/vnd.microsoft.appconfig.snapshot+json'}))
];
const querySample={tables:[{name:'PrimaryResult',columns:[{name:'count_',type:'long'}],rows:[[1]]}]};
const metricSample={id:samples.resourceId+'/providers/Microsoft.Insights/metrics/Percentage CPU',type:'Microsoft.Insights/metrics',name:{value:'Percentage CPU',localizedValue:'Percentage CPU'},unit:'Percent',timeseries:[{metadatavalues:[],data:[{timeStamp:'2026-01-01T00:00:00Z',average:5.5}]}],errorCode:'Success'};
const monitorOps=[
 fromSpec(metrics,'Metrics_List','metrics-query','Query Resource Metrics',{inputs:{metricnames:str(),timespan:str(),interval:{...str(false),default:'PT1M'},aggregation:{...str(false),default:'Average'}},query:{metricnames:input('metricnames'),timespan:input('timespan'),interval:input('interval'),aggregation:input('aggregation')},response:{kind:'list',path:['value'],type:'metric'},sampleInputs:{resourceUri:samples.resourceId,metricnames:'Percentage CPU',timespan:'2026-01-01T00:00:00Z/2026-01-01T01:00:00Z',interval:'PT1M',aggregation:'Average'},sampleResponse:{cost:0,timespan:'2026-01-01T00:00:00Z/2026-01-01T01:00:00Z',value:[metricSample]}}),
 fromSpec(metricDefinitions,'MetricDefinitions_List','metric-definitions-list','List Resource Metric Definitions',{inputs:{resourceUri:str()},list:true,response:{kind:'list',path:['value'],type:'metric-definition'},sampleInputs:{resourceUri:samples.resourceId},sampleResponse:{value:[{id:'sample-definition',name:{value:'Percentage CPU',localizedValue:'Percentage CPU'},unit:'Percent',primaryAggregationType:'Average',supportedAggregationTypes:['Average','Minimum','Maximum'],metricAvailabilities:[{timeGrain:'PT1M',retention:'P93D'}]}]}}),
 ...[['MetricAlerts_ListBySubscription','metric-alerts-list','List Subscription Metric Alerts'],['MetricAlerts_ListByResourceGroup','group-metric-alerts-list','List Resource Group Metric Alerts']].map(([id,key,name])=>fromSpec(metricAlerts,id,key,name,{list:true})),
 fromSpec(metricAlerts,'MetricAlerts_Get','metric-alert-get','Get Metric Alert'),
 ...[['ActionGroups_ListBySubscriptionId','action-groups-list','List Subscription Action Groups'],['ActionGroups_ListByResourceGroup','group-action-groups-list','List Resource Group Action Groups']].map(([id,key,name])=>fromSpec(actionGroups,id,key,name,{list:true})),
 fromSpec(actionGroups,'ActionGroups_Get','action-group-get','Get Action Group'),
 fromSpec(activityLogs,'ActivityLogs_List','activity-log-list','List Bounded Activity Log',{list:true,inputs:{filter:str()},query:{'$filter':input('filter')},response:{kind:'list',path:['value'],type:'activity-event'},sampleInputs:{filter:"eventTimestamp ge '2026-01-01T00:00:00Z' and eventTimestamp le '2026-01-01T01:00:00Z'"},sampleResponse:{value:[{id:'sample-event',eventDataId:'00000000-0000-4000-8000-000000000002',resourceId:samples.resourceId,eventTimestamp:'2026-01-01T00:00:00Z',operationName:{value:'Microsoft.Compute/virtualMachines/write',localizedValue:'Create or Update Virtual Machine'},status:{value:'Succeeded',localizedValue:'Succeeded'},level:'Informational',properties:{}}]}}),
 {key:'log-analytics-query',name:'Query Log Analytics',method:'POST',effect:'read',baseUrl:'https://api.loganalytics.azure.com',path:'/v1/workspaces/{workspaceId}/query',inputs:{workspaceId:str(),query:str(),timespan:{...str(false),default:'PT1H'}},body:{query:input('query'),timespan:input('timespan')},response:{kind:'item',type:'query-result'},source:'https://learn.microsoft.com/en-us/rest/api/logsquery/query/execute?view=rest-logsquery-v1',description:'Execute bounded KQL as a read operation. Configure a Log Analytics token/connection; ARM tokens have the wrong audience. Query only explicitly authorized workspace data.',scopes:'Workspace query permission; token audience https://api.loganalytics.io/.default.',sampleInputs:{workspaceId:samples.subscriptionId,query:'print count_=1',timespan:'PT1H'},sampleResponse:querySample},
 {key:'application-insights-query',name:'Query Application Insights',method:'POST',effect:'read',baseUrl:'https://api.applicationinsights.io',path:'/v1/apps/{appId}/query',inputs:{appId:str(),query:str(),timespan:{...str(false),default:'PT1H'}},body:{query:input('query'),timespan:input('timespan')},response:{kind:'item',type:'query-result'},source:'https://learn.microsoft.com/en-us/rest/api/application-insights/query/execute?view=rest-application-insights-v1',description:'Execute selected Application Insights KQL using the Application ID. Configure an Application Insights audience token; output tables preserve typed columns and JSON row cells.',scopes:'Application Insights query read permission; token audience https://api.applicationinsights.io.',sampleInputs:{appId:samples.subscriptionId,query:'print count_=1',timespan:'PT1H'},sampleResponse:querySample}
];
const adoDoc=path=>'https://learn.microsoft.com/en-us/rest/api/azure/devops/'+path+'?view=azure-devops-rest-7.1';
const adoProject={id:samples.subscriptionId,name:'Synthetic Project',state:'wellFormed',visibility:'private',url:'https://dev.azure.com/sample-org/_apis/projects/'+samples.subscriptionId};
const adoBuild={id:1,buildNumber:'synthetic-1',status:'completed',result:'succeeded',queueTime:'2026-01-01T00:00:00Z',startTime:'2026-01-01T00:00:01Z',finishTime:'2026-01-01T00:01:00Z',sourceBranch:'refs/heads/main',sourceVersion:'0000000000000000000000000000000000000001',definition:{id:1,name:'Synthetic Build'},project:adoProject};
function ado(key,name,path,{method='GET',type='build',list=false,source,inputs={},query={},body,sampleInputs={},sampleResponse,paging,...extra}={}){
 const params=Object.fromEntries([...path.matchAll(/\{([^}]+)\}/g)].map(m=>[m[1],['buildId','pipelineId','runId','poolId','agentId','releaseId'].includes(m[1])?num():str()]));
 return{key,name,method,effect:method==='GET'?'read':method==='DELETE'?'delete':'write',path,inputs:{...params,...inputs},query:{'api-version':'7.1',...query},...(body?{body}:{}),response:{kind:list?'list':'item',...(list?{path:['value']}:{}),type},...(paging?{paging}:{}),source:adoDoc(source),scopes:'Project-scoped Azure DevOps PAT/OAuth permission for the selected API. Basic PAT authentication; never logs credentials.',description:`${name} in the explicitly selected organization/project. Existing trigger/workflow pins and service hooks are unaffected. Actions require confirmWrites and no automatic retries.`,sampleInputs:{...Object.fromEntries(Object.entries({...params,...inputs}).map(([key,d])=>[key,d.type==='number'?1:key==='organization'?'sample-org':key==='project'?'Synthetic Project':'sample'])),...sampleInputs},sampleResponse:sampleResponse??(list?{count:1,value:[structuredClone(adoBuild)]}:structuredClone(adoBuild)),...extra};
}
const adoPage={kind:'header',header:'x-ms-continuationtoken',parameter:'continuationToken'};
const adoOps=[
 ado('projects-list','List Azure DevOps Projects','/{organization}/_apis/projects',{type:'@id:def_b04c995df0e8:1',list:true,source:'core/projects/list',paging:adoPage,response:{kind:'list',path:['value'],type:'@id:def_b04c995df0e8:1',listType:'project-list'},sampleResponse:{count:1,value:[adoProject]}}),
 ado('project-get','Get Azure DevOps Project','/{organization}/_apis/projects/{project}',{type:'@id:def_b04c995df0e8:1',source:'core/projects/get',sampleResponse:adoProject}),
 ado('repository-get','Get Git Repository','/{organization}/{project}/_apis/git/repositories/{repositoryId}',{type:'@id:def_690ea53cafe0:1',source:'git/repositories/get-repository',sampleResponse:{id:samples.subscriptionId,name:'Synthetic Repository',url:'https://dev.azure.com/sample-org/_apis/git/repositories/'+samples.subscriptionId,project:adoProject,defaultBranch:'refs/heads/main'}}),
 ado('pull-request-get','Get Pull Request','/{organization}/{project}/_apis/git/pullrequests/{pullRequestId}',{type:'@id:def_9e98014d1ecd:1',source:'git/pull-requests/get-pull-request-by-id',sampleResponse:{pullRequestId:1,title:'Synthetic pull request',status:'active',isDraft:false,sourceRefName:'refs/heads/sample',targetRefName:'refs/heads/main'},inputs:{pullRequestId:num()},sampleInputs:{pullRequestId:1}}),
 ado('builds-list','List Builds','/{organization}/{project}/_apis/build/builds',{list:true,source:'build/builds/list',paging:adoPage,inputs:{statusFilter:str(false)},query:{statusFilter:input('statusFilter',true)}}),
 ado('build-get','Get Build','/{organization}/{project}/_apis/build/builds/{buildId}',{source:'build/builds/get'}),
 ado('build-queue','Queue Build','/{organization}/{project}/_apis/build/builds',{method:'POST',source:'build/builds/queue',inputs:{definitionId:num(),sourceBranch:{...str(false),default:'refs/heads/main'}},body:{definition:{id:input('definitionId')},sourceBranch:input('sourceBranch')},sampleInputs:{definitionId:1,sourceBranch:'refs/heads/main'},sampleResponse:{...adoBuild,status:'notStarted',result:null}}),
 ado('build-timeline-get','Get Build Timeline','/{organization}/{project}/_apis/build/builds/{buildId}/timeline',{source:'build/timeline/get',response:{kind:'json'},sampleResponse:{id:samples.subscriptionId,changeId:1,records:[{id:samples.subscriptionId,name:'Synthetic job',type:'Job',state:'completed',result:'succeeded'}]}}),
 ado('pipelines-list','List Pipelines','/{organization}/{project}/_apis/pipelines',{list:true,type:'pipeline',source:'pipelines/pipelines/list',sampleResponse:{count:1,value:[{id:1,name:'Synthetic Pipeline',revision:1,folder:'\\'}]}}),
 ado('pipeline-get','Get Pipeline','/{organization}/{project}/_apis/pipelines/{pipelineId}',{type:'pipeline',source:'pipelines/pipelines/get',sampleResponse:{id:1,name:'Synthetic Pipeline',revision:1,folder:'\\',configuration:{type:'yaml',path:'/azure-pipelines.yml'}}}),
 ado('pipeline-runs-list','List Pipeline Runs','/{organization}/{project}/_apis/pipelines/{pipelineId}/runs',{list:true,type:'run',source:'pipelines/runs/list',sampleResponse:{count:1,value:[{id:1,name:'synthetic-1',state:'completed',result:'succeeded',pipeline:{id:1,name:'Synthetic Pipeline'}}]}}),
 ado('pipeline-run-get','Get Pipeline Run','/{organization}/{project}/_apis/pipelines/{pipelineId}/runs/{runId}',{type:'run',source:'pipelines/runs/get',sampleResponse:{id:1,name:'synthetic-1',state:'completed',result:'succeeded',pipeline:{id:1,name:'Synthetic Pipeline'}}}),
 ado('pipeline-run','Run Pipeline','/{organization}/{project}/_apis/pipelines/{pipelineId}/runs',{method:'POST',type:'run',source:'pipelines/runs/run-pipeline',inputs:{branch:{...str(false),default:'refs/heads/main'}},body:{resources:{repositories:{self:{refName:input('branch')}}}},sampleInputs:{branch:'refs/heads/main'},sampleResponse:{id:1,name:'synthetic-1',state:'inProgress',pipeline:{id:1,name:'Synthetic Pipeline'}}}),
 ado('agents-list','List Pool Agents','/{organization}/_apis/distributedtask/pools/{poolId}/agents',{list:true,type:'agent',source:'distributedtask/agents/list',sampleResponse:{count:1,value:[{id:1,name:'Synthetic Agent',version:'4.0.0',enabled:true,status:'online'}]}}),
 ado('release-get','Get Release','/{organization}/{project}/_apis/release/releases/{releaseId}',{baseUrl:'https://vsrm.dev.azure.com',type:'release',source:'release/releases/get-release',sampleResponse:{id:1,name:'Synthetic Release',status:'active',releaseDefinition:{id:1,name:'Synthetic Definition'},environments:[{id:1,name:'Test',status:'succeeded'}]}})
];
const appServiceOps=[
 fromSpec(webApps,'WebApps_List','apps-list','List App Services',{list:true}),
 fromSpec(webApps,'WebApps_ListByResourceGroup','group-apps-list','List Resource Group App Services',{list:true}),
 fromSpec(webApps,'WebApps_Get','app-get','Get App Service Metadata'),
 fromSpec(webApps,'WebApps_ListSlots','slots-list','List App Service Slots',{list:true}),
 fromSpec(webApps,'WebApps_GetSlot','slot-get','Get App Service Slot Metadata'),
 fromSpec(webPlans,'AppServicePlans_List','plans-list','List App Service Plans',{list:true}),
 fromSpec(webPlans,'AppServicePlans_ListByResourceGroup','group-plans-list','List Resource Group App Service Plans',{list:true}),
 fromSpec(webPlans,'AppServicePlans_Get','plan-get','Get App Service Plan'),
 fromSpec(webPlans,'AppServicePlans_ListWebApps','plan-apps-list','List Plan App Services',{list:true}),
 ...[['WebApps_Start','app-start','Start App Service'],['WebApps_Stop','app-stop','Stop App Service'],['WebApps_Restart','app-restart','Restart App Service'],['WebApps_StartSlot','slot-start','Start App Service Slot'],['WebApps_StopSlot','slot-stop','Stop App Service Slot'],['WebApps_RestartSlot','slot-restart','Restart App Service Slot']].map(([id,key,name])=>action(webApps,id,key,name,{sampleStatus:200})),
 action(webApps,'WebApps_SwapSlotSlot','slot-swap','Swap App Service Slot',{inputs:{targetSlot:str(),preserveVnet:{type:'boolean',default:true}},body:{targetSlot:input('targetSlot'),preserveVnet:input('preserveVnet')},sampleInputs:{targetSlot:'production',preserveVnet:true},description:'Swap the explicitly selected source slot into the target slot. This changes production routing when targetSlot is production; confirmWrites and no automatic retry are required. 202 reports acceptance only.'})
];
const sqlOps=[
 fromSpec(sqlServers,'Servers_List','servers-list','List SQL Server Metadata',{list:true}),fromSpec(sqlServers,'Servers_ListByResourceGroup','group-servers-list','List Resource Group SQL Servers',{list:true}),fromSpec(sqlServers,'Servers_Get','server-get','Get SQL Server Metadata'),
 fromSpec(sqlDatabases,'Databases_ListByServer','databases-list','List SQL Database Metadata',{list:true}),fromSpec(sqlDatabases,'Databases_Get','database-get','Get SQL Database Metadata'),fromSpec(sqlDatabases,'Databases_ListByElasticPool','pool-databases-list','List Elastic Pool Database Metadata',{list:true}),
 fromSpec(sqlPools,'ElasticPools_ListByServer','elastic-pools-list','List SQL Elastic Pool Metadata',{list:true}),fromSpec(sqlPools,'ElasticPools_Get','elastic-pool-get','Get SQL Elastic Pool Metadata'),
 fromSpec(sqlFirewall,'FirewallRules_ListByServer','firewall-rules-list','List SQL Firewall Rule Metadata',{list:true}),fromSpec(sqlFirewall,'FirewallRules_Get','firewall-rule-get','Get SQL Firewall Rule Metadata')
];
export const families=[
 family('azure','Azure',azureOps,{types:[
 {key:'resource',name:'Azure Resource',schema:o({id:s(),name:s(),type:s(),location:s(),kind:s(),etag:s(),tags:o({},[],s()),sku:record,identity:record,properties:record,systemData:record})},
 {key:'subscription',name:'Azure Subscription',schema:o({id:s(),subscriptionId:s(),displayName:s(),state:s(),tenantId:s(),authorizationSource:s(),subscriptionPolicies:record})},
 {key:'location',name:'Azure Location',schema:o({id:s(),name:s(),displayName:s(),regionalDisplayName:s(),subscriptionId:s(),metadata:record})},
 {key:'provider',name:'Azure Resource Provider',schema:o({id:s(),namespace:s(),registrationState:s(),resourceTypes:a(o({resourceType:s(),locations:a(s()),apiVersions:a(s()),capabilities:s()}))})},
 {key:'vm-size',name:'Azure Virtual Machine Size',schema:o({name:s(),numberOfCores:i(),memoryInMB:i(),maxDataDiskCount:i(),osDiskSizeInMB:i(),resourceDiskSizeInMB:i()})}
 ]}),
 family('azure-aks','Azure AKS',aksOps),
 family('azure-storage','Azure Storage',storageOps,{description:'JSON ARM storage account/container/share/queue/table metadata and explicit create actions. Does not misparse Blob XML or access account keys.'}),
 family('azure-servicebus','Azure Service Bus',sbOps,{description:'JSON ARM namespace/queue/topic/subscription/rule management. Separate from existing ingress; does not consume messages or restore a retired transport.'}),
 family('azure-container-registry','Azure Container Registry',acrOps,{description:'ARM registry/replication/cache/webhook/task/run metadata. No admin passwords, token exchange or Registry XML emulation.'}),
 family('azure-keyvault','Azure Key Vault',vaultOps,{baseUrl:'https://sample-vault.vault.azure.net',auth:{kind:'bearer',secret:'AZURE_KEYVAULT_ACCESS_TOKEN'},description:'Secret/key/certificate metadata and public certificates. Never requests secret values, private-key export, backup blobs or credential-bearing issuer accounts.',types:[
 {key:'metadata',name:'Azure Vault Item Metadata',schema:o({id:s(),kid:s(),contentType:s(),managed:b(),tags:o({},[],s()),attributes:o({enabled:b(),created:i(),updated:i(),nbf:i(),exp:i(),recoveryLevel:s(),recoverableDays:i()}),deletedDate:i(),scheduledPurgeDate:i(),recoveryId:s()})},
 {key:'certificate',name:'Azure Public Certificate',schema:o({id:s(),kid:s(),sid:s(),cer:s(),x5t:s(),attributes:record,policy:record,tags:o({},[],s())})}
 ]}),
 family('azure-appconfig','Azure App Configuration',appconfigOps,{baseUrl:'https://sample-config.azconfig.io',auth:{kind:'bearer',secret:'AZURE_APPCONFIG_ACCESS_TOKEN'},types:[
 {key:'setting',name:'Azure Configuration Setting',schema:o({etag:s(),key:s(),label:{anyOf:[s(),{type:'null'}]},content_type:{anyOf:[s(),{type:'null'}]},value:{anyOf:[s(),{type:'null'}]},last_modified:s(),locked:b(),tags:o({},[],s())})},
 {key:'name',name:'Azure Configuration Name',schema:o({name:{anyOf:[s(),{type:'null'}]}})},
 {key:'snapshot',name:'Azure Configuration Snapshot',schema:o({etag:s(),name:s(),status:s(),filters:a(o({key:s(),label:{anyOf:[s(),{type:'null'}]}})),composition_type:s(),created:s(),expires:s(),size:i(),items_count:i(),retention_period:i(),tags:o({},[],s())})}
 ]}),
 family('azure-monitor','Azure Monitor',monitorOps,{description:'Bounded Azure metrics/activity discovery and read-only Log Analytics/Application Insights KQL. Each query API requires its own token audience/connection.',types:[
 {key:'metric',name:'Azure Metric',schema:o({id:s(),type:s(),name:o({value:s(),localizedValue:s()}),unit:s(),errorCode:s(),errorMessage:s(),timeseries:a(o({metadatavalues:a(o({name:o({value:s(),localizedValue:s()}),value:s()})),data:a(o({timeStamp:s(),average:n(),minimum:n(),maximum:n(),total:n(),count:n()}))}))})},
 {key:'metric-definition',name:'Azure Metric Definition',schema:o({id:s(),namespace:s(),name:o({value:s(),localizedValue:s()}),unit:s(),primaryAggregationType:s(),supportedAggregationTypes:a(s()),metricAvailabilities:a(o({timeGrain:s(),retention:s()})),dimensions:a(o({value:s(),localizedValue:s()})),isDimensionRequired:b()})},
 {key:'activity-event',name:'Azure Activity Event',schema:o({id:s(),eventDataId:s(),resourceId:s(),resourceGroupName:s(),subscriptionId:s(),correlationId:s(),eventTimestamp:s(),submissionTimestamp:s(),level:s(),caller:s(),operationName:o({value:s(),localizedValue:s()}),status:o({value:s(),localizedValue:s()}),properties:record})},
 {key:'query-result',name:'Azure Analytics Query Result',schema:o({tables:a(o({name:s(),columns:a(o({name:s(),type:s()},['name','type'])),rows:a(a(json))},['name','columns','rows'])),statistics:record,render:record,error:record},['tables'])}
 ]}),
 family('azure-devops','Azure DevOps',adoOps,{baseUrl:'https://dev.azure.com',auth:{kind:'basic',username:'azure-devops',secret:'AZURE_DEVOPS_ACCESS_TOKEN'},description:'Reusable project/build/pipeline/agent/release operations complementing the installed typed Azure event and PR workflows. Existing repository and PR type identities are reused.',types:[
 {key:'project-list',name:'Azure Project List',itemType:'@id:def_b04c995df0e8:1',schema:{type:'array',items:existingTypes[0].schema,maxItems:5000,definitions:existingTypes[0].schema.definitions}},
 {key:'build',name:'Azure DevOps Build',schema:o({id:n(),buildNumber:s(),status:s(),result:{anyOf:[s(),{type:'null'}]},queueTime:s(),startTime:{anyOf:[s(),{type:'null'}]},finishTime:{anyOf:[s(),{type:'null'}]},sourceBranch:s(),sourceVersion:s(),url:s(),definition:record,project:record,requestedFor:record,requestedBy:record})},
 {key:'pipeline',name:'Azure DevOps Pipeline',schema:o({id:n(),name:s(),folder:s(),revision:n(),url:s(),configuration:record})},
 {key:'run',name:'Azure DevOps Pipeline Run',schema:o({id:n(),name:s(),state:s(),result:{anyOf:[s(),{type:'null'}]},url:s(),createdDate:s(),finishedDate:{anyOf:[s(),{type:'null'}]},pipeline:record,resources:record,variables:record,templateParameters:record})},
 {key:'agent',name:'Azure DevOps Pool Agent',schema:o({id:n(),name:s(),version:s(),enabled:b(),status:s(),osDescription:s(),systemCapabilities:record,userCapabilities:record})},
 {key:'release',name:'Azure DevOps Release',schema:o({id:n(),name:s(),status:s(),createdOn:s(),modifiedOn:s(),releaseDefinition:record,environments:a(record),projectReference:record})}
 ]}),
 family('azure-appservice','Azure App Service',appServiceOps,{description:'App/slot/plan metadata and deliberate app/slot lifecycle/swap actions. No app setting values, connection strings or publish credentials are requested.'}),
 family('azure-sql','Azure SQL',sqlOps,{description:'ARM SQL server/database/elastic-pool/firewall metadata. No SQL connections, row queries, server credentials, database export/import or destructive actions.'})
];
// Frequently wired state/count fields are direct outputs of the same reusable
// resource record; no field-specific nominal type or conversion node is added.
function scalars(operations,key,select,selectTypes={}){const op=operations.find(x=>x.key===key);op.response.select={...op.response.select,...select};op.response.selectTypes={...op.response.selectTypes,...selectTypes};}
scalars(aksOps,'cluster-get',{kubernetes_version:['properties','kubernetesVersion'],provisioning_state:['properties','provisioningState'],power_state:['properties','powerState','code'],fqdn:['properties','fqdn']});
scalars(aksOps,'node-pool-get',{node_count:['properties','count'],vm_size:['properties','vmSize'],provisioning_state:['properties','provisioningState'],orchestrator_version:['properties','orchestratorVersion']},{node_count:'number'});
scalars(sbOps,'queue-get',{message_count:['properties','messageCount'],active_messages:['properties','countDetails','activeMessageCount'],dead_letter_messages:['properties','countDetails','deadLetterMessageCount']},{message_count:'number',active_messages:'number',dead_letter_messages:'number'});
scalars(sbOps,'subscription-get',{message_count:['properties','messageCount'],active_messages:['properties','countDetails','activeMessageCount'],dead_letter_messages:['properties','countDetails','deadLetterMessageCount']},{message_count:'number',active_messages:'number',dead_letter_messages:'number'});
scalars(storageOps,'account-get',{blob_endpoint:['properties','primaryEndpoints','blob'],table_endpoint:['properties','primaryEndpoints','table'],provisioning_state:['properties','provisioningState']});
scalars(acrOps,'registry-get',{login_server:['properties','loginServer'],provisioning_state:['properties','provisioningState']});
scalars(adoOps,'build-get',{build_id:['id'],build_number:['buildNumber'],build_status:['status'],build_result:['result']},{build_id:'number'});
scalars(adoOps,'pipeline-run-get',{run_id:['id'],run_state:['state'],run_result:['result']},{run_id:'number'});
scalars(appServiceOps,'app-get',{app_state:['properties','state'],default_hostname:['properties','defaultHostName'],enabled:['properties','enabled']},{enabled:'boolean'});
scalars(appServiceOps,'slot-get',{slot_state:['properties','state'],default_hostname:['properties','defaultHostName'],enabled:['properties','enabled']},{enabled:'boolean'});
scalars(sqlOps,'server-get',{fqdn:['properties','fullyQualifiedDomainName'],server_state:['properties','state']});
scalars(sqlOps,'database-get',{database_status:['properties','status'],max_size_bytes:['properties','maxSizeBytes'],service_objective:['properties','currentServiceObjectiveName']},{max_size_bytes:'number'});
function propertiesSample(operations,key,properties){Object.assign(operations.find(x=>x.key===key).sampleResponse.properties,properties);}
propertiesSample(aksOps,'cluster-get',{kubernetesVersion:'1.33.0',powerState:{code:'Running'},fqdn:'sample-cluster.example.invalid'});
propertiesSample(aksOps,'node-pool-get',{count:2,vmSize:'Standard_D2s_v5',orchestratorVersion:'1.33.0'});
propertiesSample(storageOps,'account-get',{primaryEndpoints:{blob:'https://samplestorage.blob.core.windows.net/',table:'https://samplestorage.table.core.windows.net/'}});
propertiesSample(acrOps,'registry-get',{loginServer:'sampleregistry.azurecr.io'});
propertiesSample(appServiceOps,'app-get',{state:'Running',defaultHostName:'sample-app.azurewebsites.net',enabled:true});
propertiesSample(appServiceOps,'slot-get',{state:'Stopped',defaultHostName:'sample-app-staging.azurewebsites.net',enabled:false});
propertiesSample(sqlOps,'server-get',{fullyQualifiedDomainName:'sample-sql.database.windows.net',state:'Ready'});
propertiesSample(sqlOps,'database-get',{status:'Online',maxSizeBytes:1073741824,currentServiceObjectiveName:'S0'});
// No vault operation requests a secret value; per-operation audience notes are
// corrected independently from the management-plane helper's default.
for(const operation of vaultOps)if(operation.scopes===ARM_SCOPE)operation.scopes='Azure Key Vault selected certificate/key metadata read permission; bearer audience https://vault.azure.net/.default. No secret/private-key export.';

