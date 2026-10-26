// Compositions preserve exact dependency versions; every external effect remains outside these pure helpers.
export function buildSubflows(base){
 const by=new Map(base.map(x=>[x.key,x.definition]));const all=[];
 const defaults=d=>Object.fromEntries(Object.entries(d.configSchema?.properties??{}).filter(([,v])=>v.default!==undefined).map(([k,v])=>[k,structuredClone(v.default)]));
 function create(key,name,spec,wires,inputMaps,outputMaps,description){
  const nodes=spec.map(([id,key,inputs={},config={}],j)=>{const d=by.get(key);if(!d)throw new Error('Missing '+key);return {id,definitionId:'@'+key,definitionVersion:1,position:{x:80+j*360,y:120},inputs,config:{...defaults(d),...config}};});
  const find=(id,direction,handle)=>{const n=nodes.find(x=>x.id===id);const d=by.get(n.definitionId.slice(1));const p=d[direction].find(x=>x.id===handle);if(!p)throw new Error('Missing socket '+id+'.'+handle);return p;};
  const inputs=[],outputs=[];
  for(const [portId,nodeId,handleId] of inputMaps){const p=find(nodeId,'inputs',handleId);if(!inputs.some(x=>x.id===portId))inputs.push({...p,id:portId,name:portId.replace(/([A-Z])/g,' $1')});}
  for(const [portId,nodeId,handleId] of outputMaps){const p=find(nodeId,'outputs',handleId);outputs.push({...p,id:portId,name:portId.replace(/([A-Z])/g,' $1')});}
  all.push({key:'subflow.'+key,folder:'Automation Library/Subflows',tags:['library-expansion','subflow','pure',key.split('.')[0]],definition:{kind:'node',name,description,documentation:description+'\n\nPure reusable typed composition; no provider request, publication, accounting change or persistent state. Inner assets and custom sockets are pinned to immutable versions. Input mappings fan control into independent builders; output next waits for the internal composition. Optional inputs retain absence and documented builder defaults. Configure or inspect the inner graph through Subflows; publishing a later version does not upgrade existing instances. See the disabled integration examples for synthetic input.',category:'Subflows',color:'#58afa6',inputs,outputs,code:'',configSchema:{type:'object',properties:{},additionalProperties:false},subflow:{nodes,edges:wires.map(([source,sourceHandle,target,targetHandle],j)=>({id:'wire_'+j,source,sourceHandle,target,targetHandle})),inputs:inputMaps.map(([portId,nodeId,handleId])=>({portId,nodeId,handleId})),outputs:outputMaps.map(([portId,nodeId,handleId])=>({portId,nodeId,handleId}))}}});
 }
 create('teams.summary','Teams Prepare Summary Workflow Card',[
  ['card','teams.card.build'],['payload','teams.card.to.workflow']
 ],[['card','card','payload','card']],
 [['exec','card','exec'],['title','card','title'],['text','card','text'],['facts','card','facts']],
 [['payload','payload','payload'],['next','payload','next']],
 'Build an Adaptive Card summary and wrap it in the typed Teams Workflows webhook message envelope. Supply title/text and optional facts; publishing is a separate deliberate action.');
 create('hubspot.contact','HubSpot Prepare Contact Mutation',[
  ['fields','hubspot.codec.contact.fields.encode'],['request','hubspot.contact.mutation.build']
 ],[['fields','value','request','fields']],
 [['exec','fields','exec'],...['email','firstname','lastname','phone','company','lifecyclestage'].map(x=>[x,'fields',x]),['custom','request','custom']],
 [['mutation','request','mutation'],['next','request','next']],
 'Assemble known contact field sockets and optional custom properties into a typed HubSpot contact mutation. No contact is created or changed.');
 create('ga4.report','GA4 Prepare Standard Report',[
  ['dates','ga4.build.dateRange'],['dimensions','ga4.build.dimensions'],['metrics','ga4.build.metrics'],['request','ga4.build.request']
 ],[['dates','ranges','request','dateRanges'],['dimensions','dimensions','request','dimensions'],['metrics','metrics','request','metrics']],
 [['exec','dates','exec'],['exec','dimensions','exec'],['exec','metrics','exec'],['startDate','dates','startDate'],['endDate','dates','endDate'],['dimensionNames','dimensions','names'],['metricNames','metrics','names']],
 [['request','request','request'],['next','request','next']],
 'Compose validated date range, dimension names and metric names into a GA4 report request with deterministic defaults and a 10000-row page limit. Does not contact Google.');
 create('xero.draft','Xero Prepare Draft Sales Invoice',[
  ['contact','xero.contactRef.encode'],['lines','xero.lines.encode'],['invoice','xero.invoiceDraft.encode',{Type:'ACCREC',Status:'DRAFT'}]
 ],[['contact','value','invoice','Contact'],['lines','value','invoice','LineItems']],
 [['exec','contact','exec'],['exec','lines','exec'],['contactId','contact','ContactID'],['line','lines','item'],['moreLines','lines','rest'],['date','invoice','Date'],['dueDate','invoice','DueDate'],['reference','invoice','Reference'],['currencyCode','invoice','CurrencyCode']],
 [['invoice','invoice','value'],['next','invoice','next']],
 'Prepare a DRAFT ACCREC sales invoice from an existing contact UUID, a typed invoice line and optional further lines/date/reference/currency. Account and regional tax choices belong to the caller. This does not create or authorize an invoice.');
 create('csv.rows','CSV Parse And Expand Rows',[
  ['parse','core.csv.parse'],['expand','core.codec.csv.decode']
 ],[['parse','table','expand','value']],
 [['exec','parse','exec'],['text','parse','text']],
 [['columns','expand','columns'],['rows','expand','rows'],['next','expand','next']],
 'Parse comma-delimited CSV with a header and expose named columns plus ordered string-cell rows, preserving quoted delimiters/newlines.');
 create('text.digest','Text Base64 And SHA256',[
  ['encode','core.encoding.base64'],['hash','core.encoding.hash']
 ],[],[['exec','encode','exec'],['exec','hash','exec'],['text','encode','text'],['text','hash','text']],
 [['base64','encode','base64'],['sha256','hash','hex'],['next','hash','next']],
 'Produce canonical UTF8 Base64 and SHA256 for the same text in two parallel pure branches. Useful for content envelopes and deterministic correlation; Base64 is not encryption.');
 return all;
}
