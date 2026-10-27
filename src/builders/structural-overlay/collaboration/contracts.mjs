import {s,n,i,b,a,o,json,record,completeSchema,clone,ref,findType,makeTypeWithCodecs,JSON_TYPES} from '../common.mjs';
export const ownedPacks=['microsoft_teams','hubspot','xero','google_analytics','google_ads','websocket','github','gitlab','gitea','jira','confluence','slack','discord','notion','sentry','pagerduty'].map(id=>'pack_'+id);
const nullable = schema => ({anyOf:[schema,{type:'null'}]});
const ns = () => ({type:['string','null']});
const nn = () => ({type:['number','null']});
const obj = properties => o(properties,[],json);
const textList = a(s());
const jsonRef = ref(JSON_TYPES.json,1), recordRef = ref(JSON_TYPES.record,1), listRef = ref(JSON_TYPES.list,1);
const nullableIds={string:'def_a653164ce2cf',number:'def_a5280518223d',boolean:'def_23b3031131b2'};
const sourceMap={
 github:'https://docs.github.com/en/rest/pulls/pulls',gitlab:'https://docs.gitlab.com/api/merge_requests/',gitea:'https://docs.gitea.com/api/1.24/',jira:'https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/',confluence:'https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/',slack:'https://docs.slack.dev/reference/objects/user-object/',discord:'https://docs.discord.com/developers/resources/message',notion:'https://developers.notion.com/reference/page',sentry:'https://docs.sentry.io/api/events/retrieve-an-event-for-a-project/',pagerduty:'https://docs.pagerduty.com/developer/api/reference/rest/incidents/get-incident',xero:'https://raw.githubusercontent.com/XeroAPI/Xero-OpenAPI/master/xero_accounting.yaml',microsoft_teams:'https://learn.microsoft.com/en-us/graph/api/resources/chatmessage?view=graph-rest-1.0',google_analytics:'https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/RunReportResponse',google_ads:'https://developers.google.com/google-ads/api/rest/reference/rest/v26/GoogleAdsRow',hubspot:'https://developers.hubspot.com/docs/api-reference/crm-objects-v3/guide',websocket:'https://www.rfc-editor.org/rfc/rfc6455'};

export function createContracts(snapshot) {
  const metadata=new Map(snapshot.library.assets.map(item=>[item.definitionId,item]));
  const additions=[],replacements=new Map(),fieldRefs=new Map(),componentSchemas=new Map();
  const existing=name=>findType(snapshot,name);
  const latest=name=>{const d=existing(name);return replacements.get(d.id)?.schema??d.schema;};
  const pinned=(name,next=false)=>{const d=existing(name);return ref(d.id,d.version+(next?1:0));};
  const schemaRef=key=>clone(componentSchemas.get(key));
  const automaticDescriptor=property=>{
    if(['string','number','integer','boolean'].includes(property.type))return property.type==='integer'?'number':property.type;
    if(Array.isArray(property.type)&&property.type.includes('null')){
      const nonNull=property.type.find(type=>type!=='null');if(nullableIds[nonNull])return ref(nullableIds[nonNull],1);
    }
    return jsonRef;
  };
  function component(pack,key,name,schema,fields={},itemType) {
    const fullKey='audit.collaboration.'+pack+'.'+key,packId='pack_'+pack;
    const folderId=snapshot.library.assets.find(item=>item.packId===packId&&item.folderId)?.folderId;
    const descriptors=Object.fromEntries(Object.entries(schema.properties??{}).map(([field,property])=>[field,fields[field]??automaticDescriptor(property)]));
    const rows=makeTypeWithCodecs(fullKey,name,schema,descriptors,{packId,folderId,itemType,documentation:name+'. Known documented fields are structural. Unknown provider extensions remain finite JSON. Optional absent values stay absent; nullable structured fields use a retained null remainder when their nonnull socket cannot carry null. Source: '+sourceMap[pack]});
    // An optional structured null is represented in remainder, never forced through a nonnull field socket.
    if(schema.type==='object')rewriteObjectCodecs(rows[1].definition,rows[2].definition,schema,descriptors,ref('@'+fullKey));
    additions.push(...rows);componentSchemas.set(fullKey,completeSchema(schema));
    return {key:fullKey,schema:completeSchema(schema),ref:ref('@'+fullKey)};
  }
  function update(name,properties,refs={},reason='Known provider members were generic JSON despite a stable documented resource contract.') {
    const d=existing(name),schema=clone(latest(name));schema.properties={...schema.properties,...properties};schema.additionalProperties=json;
    const merged={...(fieldRefs.get(d.id)??{}),...refs};fieldRefs.set(d.id,merged);
    replacements.set(d.id,{schema:completeSchema(schema),reason,source:sourceMap[(metadata.get(d.id)?.packId??'').replace('pack_','')]});
    return schema;
  }
  function dictionary(pack,key,name,entrySchema,entryRef){
    const fullKey='audit.collaboration.'+pack+'.'+key,packId='pack_'+pack,folderId=snapshot.library.assets.find(item=>item.packId===packId&&item.folderId)?.folderId;
    const schema=completeSchema({type:'object',additionalProperties:entrySchema}),documentation=name+'. Keys are user-defined; every value uses the documented semantic entry contract. Pure dictionary entry extraction/reinsertion preserves unknown keys and order-independent values. Source: '+sourceMap[pack];
    const base={name,kind:'type',inputs:[],outputs:[],code:'',schema,documentation,description:name+' keyed by user-defined property names.',category:'Integration contracts',color:'#58afa6'};
    const root=ref('@'+fullKey),port=(id,descriptor,required=false)=>({id,name:id,...descriptor,...(required?{required:true}:{})}),control=id=>port(id,{type:'control'});
    const encode={name:name+' Encode',description:'Reinsert a typed property value into a keyed '+name+' dictionary.',kind:'node',runtime:'javascript',category:base.category,color:base.color,documentation,inputs:[control('exec'),port('rest',root),port('key',ref('string')),port('entry',entryRef)],outputs:[control('next'),port('value',root,true)],configSchema:{type:'object',properties:{},additionalProperties:false},code:"const value=structuredClone(inputs.rest??{});if(Object.hasOwn(inputs,'key')!==Object.hasOwn(inputs,'entry'))throw Error('Dictionary key and entry must be supplied together');if(Object.hasOwn(inputs,'key')){if(Object.hasOwn(value,inputs.key))throw Error('Dictionary entry collides with rest');Object.defineProperty(value,inputs.key,{value:inputs.entry,enumerable:true});}return {value};"};
    const decode={...clone(encode),name:name+' Decode',description:'Extract one typed property value and retain the remaining '+name+' dictionary.',inputs:[control('exec'),port('value',root,true),port('key',ref('string'))],outputs:[control('next'),port('rest',root,true),port('key',ref('string')),port('entry',entryRef),port('count',ref('number'),true)],code:"const rest=structuredClone(inputs.value),keys=Object.keys(rest),key=inputs.key??keys[0],out={rest,count:keys.length};if(key!==undefined&&Object.hasOwn(rest,key)){out.key=key;out.entry=rest[key];delete rest[key];}else if(Object.hasOwn(inputs,'key'))throw Error('Dictionary key does not exist');return out;"};
    additions.push({key:fullKey,definition:base,packId,folderId,tags:['contract-audit','typed']},...[[encode,'encode','decode'],[decode,'decode','encode']].map(([definition,mode,partner])=>({key:fullKey+'.'+mode,definition,packId,folderId,tags:['contract-audit','typed'],codec:{pairKey:fullKey+'.'+partner,mode,name}})));
    return{key:fullKey,schema,ref:root};
  }
  const identity = obj({id:i(),login:s(),username:s(),name:ns(),avatar_url:ns(),html_url:s(),web_url:s(),type:s(),email:ns()});
  for(const [pack,label] of [['github','GitHub'],['gitlab','GitLab'],['gitea','Gitea']]) {
    const user=component(pack,'identity',label+' Identity',identity);
    const users=component(pack,'identities',label+' Identities',a(user.schema),{},user.ref);
    if(pack==='github'||pack==='gitea'){
      const labels=component(pack,'label',label+' Label',obj({id:i(),name:s(),color:s(),description:ns(),default:b()}));
      const labelList=component(pack,'labels',label+' Labels',a(labels.schema),{},labels.ref);
      const repo=label+' Repository',gitRef=component(pack,'git-reference',label+' Git Reference',obj({label:s(),ref:s(),sha:s(),repo:nullable(clone(latest(repo))),user:nullable(user.schema)}),{repo:pinned(repo),user:user.ref});
      update(repo,{owner:user.schema},{owner:user.ref});
      update(label+' Issue',{user:nullable(user.schema),assignee:nullable(user.schema),assignees:users.schema,labels:labelList.schema},{user:user.ref,assignee:user.ref,assignees:users.ref,labels:labelList.ref});
      update(label+' Pull Request',{head:gitRef.schema,base:gitRef.schema,user:nullable(user.schema),assignee:nullable(user.schema),assignees:users.schema,labels:labelList.schema},{head:gitRef.ref,base:gitRef.ref,user:user.ref,assignee:user.ref,assignees:users.ref,labels:labelList.ref});
      update(label+' Comment',{user:user.schema},{user:user.ref});
    }else{
      for(const name of ['GitLab Issue','GitLab Merge Request'])update(name,{author:user.schema,assignee:nullable(user.schema),assignees:users.schema,labels:textList},{author:user.ref,assignee:user.ref,assignees:users.ref,labels:pinned('Text List')});
      update('GitLab Job',{user:user.schema,pipeline:clone(latest('GitLab Pipeline'))},{user:user.ref,pipeline:pinned('GitLab Pipeline')});
    }
  }
  const statusCategory=component('jira','status-category','Jira Status Category',obj({id:i(),key:s(),colorName:s(),name:s(),self:s()}));
  const jiraStatus=component('jira','status','Jira Status',obj({id:s(),name:s(),description:s(),iconUrl:s(),self:s(),statusCategory:statusCategory.schema}),{statusCategory:statusCategory.ref});
  const jiraIdentity=component('jira','identity','Jira Account',obj({accountId:s(),displayName:s(),emailAddress:s(),active:b(),accountType:s(),timeZone:s(),self:s()}));
  const issueType=component('jira','issue-type','Jira Issue Type',obj({id:s(),name:s(),description:s(),subtask:b(),iconUrl:s(),self:s()}));
  const priority=component('jira','priority','Jira Priority',obj({id:s(),name:s(),iconUrl:s(),self:s()}));
  const mark=component('jira','document-mark','Atlassian Document Mark',obj({type:s(),attrs:record}),{attrs:recordRef});
  const marks=component('jira','document-marks','Atlassian Document Marks',a(mark.schema),{},mark.ref);
  const adfNode=obj({type:s(),text:s(),attrs:record,content:a({$ref:'#/definitions/ONFADFNode'}),marks:marks.schema});
  const adfNodeDef=component('jira','document-node','Atlassian Document Node',{...adfNode,definitions:{ONFADFNode:adfNode}},{attrs:recordRef,content:ref('@audit.collaboration.jira.document-nodes'),marks:marks.ref});
  const adfNodes=component('jira','document-nodes','Atlassian Document Nodes',{...a({$ref:'#/definitions/ONFADFNode'}),definitions:{ONFADFNode:adfNode}},{},adfNodeDef.ref);
  const adf=component('jira','document','Atlassian Document', {...o({type:{type:'string',const:'doc'},version:{type:'integer',const:1},content:adfNodes.schema},['type','version','content'],json),definitions:{ONFADFNode:adfNode}}, {type:'string',version:'number',content:adfNodes.ref});
  const jiraFields=component('jira','issue-fields','Jira Issue Fields',obj({summary:s(),description:nullable(adf.schema),status:jiraStatus.schema,project:clone(latest('Jira Project')),assignee:nullable(jiraIdentity.schema),reporter:nullable(jiraIdentity.schema),created:s(),updated:s(),labels:textList,issuetype:issueType.schema,priority:priority.schema}),{description:adf.ref,status:jiraStatus.ref,project:pinned('Jira Project'),assignee:jiraIdentity.ref,reporter:jiraIdentity.ref,labels:pinned('Text List'),issuetype:issueType.ref,priority:priority.ref});
  update('Jira Issue',{fields:jiraFields.schema},{fields:jiraFields.ref});
  const transition=component('jira','transition','Jira Workflow Transition',obj({id:s(),name:s(),to:jiraStatus.schema,hasScreen:b(),isGlobal:b(),isInitial:b(),isAvailable:b(),isConditional:b(),fields:{...record,description:'Screen fields are keyed by site-configured field IDs, including custom fields.'}}),{to:jiraStatus.ref,fields:recordRef});
  const transitions=component('jira','transitions','Jira Workflow Transitions',a(transition.schema),{},transition.ref);

  const revision=component('confluence','revision','Confluence Revision',obj({number:i({minimum:1}),createdAt:s(),message:s(),minorEdit:b(),authorId:s()}));
  const representation=component('confluence','content-representation','Confluence Content Representation',obj({value:s(),representation:s()}));
  const body=component('confluence','content-body','Confluence Content Body',obj(Object.fromEntries(['storage','atlas_doc_format','view','export_view','anonymous_export_view'].map(key=>[key,representation.schema]))),Object.fromEntries(['storage','atlas_doc_format','view','export_view','anonymous_export_view'].map(key=>[key,representation.ref])));
  for(const name of ['Confluence Page','Confluence Comment'])update(name,{body:body.schema,version:revision.schema},{body:body.ref,version:revision.ref});

  const detail=component('slack','conversation-text','Slack Conversation Text',obj({value:s(),creator:s(),last_set:i({minimum:0})}));
  update('Slack Conversation',{topic:detail.schema,purpose:detail.schema},{topic:detail.ref,purpose:detail.ref});
  const profile=component('slack','user-profile','Slack User Profile',obj(Object.fromEntries(['avatar_hash','real_name','real_name_normalized','display_name','display_name_normalized','status_text','status_emoji','email','title','phone','skype','image_24','image_32','image_48','image_72','image_192','image_512'].map(key=>[key,s()]))));
  update('Slack User',{profile:profile.schema},{profile:profile.ref});
  const permalink=component('slack','message-link','Slack Message Link',o({ok:b(),channel:s(),permalink:s()},['ok','channel','permalink'],json));

  const attachment=component('discord','attachment','Discord Attachment',o({id:s(),filename:s(),description:s(),content_type:s(),size:i({minimum:0}),url:s(),proxy_url:s(),height:{type:['integer','null']},width:{type:['integer','null']},ephemeral:b(),duration_secs:n(),waveform:s()},['id','filename'],json),{height:ref(nullableIds.number),width:ref(nullableIds.number)});
  const attachments=component('discord','attachments','Discord Attachments',a(attachment.schema),{},attachment.ref);
  update('Discord Message',{author:clone(latest('Discord User')),attachments:attachments.schema},{author:pinned('Discord User'),attachments:attachments.ref});

  const parent=component('notion','parent','Notion Parent',obj({type:s(),page_id:s(),database_id:s(),data_source_id:s(),block_id:s(),workspace:b()}));
  const link=component('notion','text-link','Notion Text Link',obj({url:s()}));
  const richText=component('notion','text-content','Notion Text Content',obj({content:s(),link:nullable(link.schema)}),{link:link.ref});
  const annotations=component('notion','text-annotations','Notion Text Annotations',obj({bold:b(),italic:b(),strikethrough:b(),underline:b(),code:b(),color:s()}));
  const equation=component('notion','equation','Notion Equation',obj({expression:s()}));
  const objectRef=component('notion','object-reference','Notion Object Reference',obj({id:s()}));
  const date=component('notion','date-range','Notion Date Range',obj({start:s(),end:ns(),time_zone:ns()}));
  const mention=component('notion','mention','Notion Mention',obj({type:s(),user:clone(latest('Notion User')),page:objectRef.schema,database:objectRef.schema,date:date.schema,link_preview:link.schema}),{user:pinned('Notion User'),page:objectRef.ref,database:objectRef.ref,date:date.ref,link_preview:link.ref});
  const rich=component('notion','rich-text','Notion Rich Text',obj({type:s(),plain_text:s(),href:ns(),text:richText.schema,annotations:annotations.schema,equation:equation.schema,mention:mention.schema}),{text:richText.ref,annotations:annotations.ref,equation:equation.ref,mention:mention.ref});
  const richList=component('notion','rich-text-list','Notion Rich Text List',a(rich.schema),{},rich.ref);
  const option=component('notion','select-option','Notion Select Option',obj({id:s(),name:s(),color:s()}));
  const options=component('notion','select-options','Notion Select Options',a(option.schema),{},option.ref);
  const relations=component('notion','object-references','Notion Object References',a(objectRef.schema),{},objectRef.ref);
  const fileURL=component('notion','file-url','Notion File URL',obj({url:s(),expiry_time:s()}));
  const file=component('notion','file','Notion File',obj({name:s(),type:s(),file:fileURL.schema,external:fileURL.schema}),{file:fileURL.ref,external:fileURL.ref});
  const files=component('notion','files','Notion Files',a(file.schema),{},file.ref);
  const formula=component('notion','formula-result','Notion Formula Result',obj({type:s(),string:ns(),number:nn(),boolean:{type:['boolean','null']},date:nullable(date.schema)}),{date:date.ref});
  const property=component('notion','property-value','Notion Property Value',obj({id:s(),type:s(),title:richList.schema,rich_text:richList.schema,number:nn(),checkbox:b(),url:ns(),email:ns(),phone_number:ns(),select:nullable(option.schema),status:nullable(option.schema),multi_select:options.schema,date:nullable(date.schema),relation:relations.schema,people:clone(latest('Notion User List')),files:files.schema,formula:formula.schema,created_time:s(),last_edited_time:s(),created_by:clone(latest('Notion User')),last_edited_by:clone(latest('Notion User')),has_more:b()}),{title:richList.ref,rich_text:richList.ref,select:option.ref,status:option.ref,multi_select:options.ref,date:date.ref,relation:relations.ref,people:pinned('Notion User List'),files:files.ref,formula:formula.ref,created_by:pinned('Notion User'),last_edited_by:pinned('Notion User')});
  const propertyMap=dictionary('notion','property-map','Notion Page Properties',property.schema,property.ref);
  const blockContent=component('notion','text-block-content','Notion Text Block Content',obj({rich_text:richList.schema,color:s(),children:a({$ref:'#/definitions/ONFNotionBlock'})}),{rich_text:richList.ref,children:pinned('Notion Block List',true)});
  update('Notion Page',{properties:propertyMap.schema,parent:parent.schema,created_by:clone(latest('Notion User')),last_edited_by:clone(latest('Notion User'))},{properties:propertyMap.ref,parent:parent.ref,created_by:pinned('Notion User'),last_edited_by:pinned('Notion User')});
  update('Notion Data Source',{parent:parent.schema,title:richList.schema},{parent:parent.ref,title:richList.ref});
  update('Notion Block',Object.fromEntries(['paragraph','heading_1','heading_2','heading_3','bulleted_list_item','numbered_list_item','quote','toggle'].map(key=>[key,blockContent.schema])),Object.fromEntries(['paragraph','heading_1','heading_2','heading_3','bulleted_list_item','numbered_list_item','quote','toggle'].map(key=>[key,blockContent.ref])));

  const sentryEntry=component('sentry','event-interface','Sentry Event Interface',o({type:s(),data:{...json,description:'SDK-specific interface data depends on type and platform; not a fixed universal event record.'}},['type'],json),{data:jsonRef});
  const sentryEntries=component('sentry','event-interfaces','Sentry Event Interfaces',a(sentryEntry.schema),{},sentryEntry.ref);
  update('Sentry Event',{entries:sentryEntries.schema},{entries:sentryEntries.ref});
  update('Sentry Issue',{project:clone(latest('Sentry Project'))},{project:pinned('Sentry Project')});
  const projectRef=component('sentry','project-reference','Sentry Project Reference',obj({id:s(),slug:s(),name:s()}));
  const projectRefs=component('sentry','project-references','Sentry Project References',a(projectRef.schema),{},projectRef.ref);
  update('Sentry Release',{projects:projectRefs.schema},{projects:projectRefs.ref});
  const pdRef=component('pagerduty','resource-reference','PagerDuty Resource Reference',o({id:s(),type:s(),summary:s(),self:s(),html_url:s()},['id'],json));
  const assignment=component('pagerduty','assignment','PagerDuty Assignment',obj({at:s(),assignee:pdRef.schema}),{assignee:pdRef.ref});
  const assignments=component('pagerduty','assignments','PagerDuty Assignments',a(assignment.schema),{},assignment.ref);
  update('PagerDuty Incident',{service:pdRef.schema,assignments:assignments.schema},{service:pdRef.ref,assignments:assignments.ref});
  update('PagerDuty Note',{user:pdRef.schema},{user:pdRef.ref});

  const address=component('xero','address','Xero Address',obj(Object.fromEntries(['AddressType','AddressLine1','AddressLine2','AddressLine3','AddressLine4','City','Region','PostalCode','Country','AttentionTo'].map(key=>[key,ns()]))));
  const addresses=component('xero','addresses','Xero Addresses',a(address.schema),{},address.ref);
  const phone=component('xero','phone','Xero Phone',obj(Object.fromEntries(['PhoneType','PhoneNumber','PhoneAreaCode','PhoneCountryCode'].map(key=>[key,ns()]))));
  const phones=component('xero','phones','Xero Phones',a(phone.schema),{},phone.ref);
  update('Xero Contact',{Addresses:addresses.schema,Phones:phones.schema,AccountNumber:ns(),TaxNumber:ns(),DefaultCurrency:ns(),Website:ns(),SkypeUserName:ns()},{Addresses:addresses.ref,Phones:phones.ref});
  const tracking=component('xero','tracking-category','Xero Line Tracking',obj({TrackingCategoryID:ns(),TrackingOptionID:ns(),Name:ns(),Option:ns()}));
  const trackings=component('xero','tracking-categories','Xero Line Tracking List',a(tracking.schema),{},tracking.ref);
  const responseLine=component('xero','response-line-item','Xero Response Line Item',obj({LineItemID:ns(),Description:ns(),Quantity:nn(),UnitAmount:nn(),TaxType:ns(),TaxAmount:nn(),LineAmount:nn(),AccountCode:ns(),ItemCode:ns(),DiscountRate:nn(),DiscountAmount:nn(),Tracking:trackings.schema}),{Tracking:trackings.ref});
  const responseLines=component('xero','response-line-items','Xero Response Line Items',a(responseLine.schema),{},responseLine.ref);
  update('Xero Invoice',{Contact:clone(latest('Xero Contact')),LineItems:responseLines.schema,SubTotal:nn(),TotalTax:nn(),AmountPaid:nn(),AmountCredited:nn(),CurrencyRate:nn(),LineAmountTypes:ns(),UpdatedDateUTC:ns(),HasAttachments:b(),HasErrors:b()},{Contact:pinned('Xero Contact',true),LineItems:responseLines.ref});
  update('Xero Payment',{Invoice:{$ref:'#/definitions/ONFXeroInvoice'},Account:clone(latest('Xero Account'))},{Invoice:pinned('Xero Invoice',true),Account:pinned('Xero Account')});
  update('Xero Invoice',{Payments:a({$ref:'#/definitions/ONFXeroPayment'})},{Payments:pinned('Xero Payment List',true)});

  const xeroError=component('xero','validation-error','Xero Validation Error',obj({Message:s()}));
  const xeroErrors=component('xero','validation-errors','Xero Validation Errors',a(xeroError.schema),{},xeroError.ref);
  for(const name of ['Xero Contact','Xero Invoice','Xero Payment'])update(name,{ValidationErrors:xeroErrors.schema,HasValidationErrors:b()},{ValidationErrors:xeroErrors.ref});

  const card=existing('Teams Adaptive Card'),cardBody=existing('Teams Adaptive Card / body Value'),cardAction=existing('Teams Adaptive Card actions / item Value');
  const fact=component('microsoft_teams','card-fact','Teams Card Fact',o({title:s(),value:s()},['title','value'],false));
  const facts=component('microsoft_teams','card-facts','Teams Card Facts',a(fact.schema),{},fact.ref);
  const choice=component('microsoft_teams','card-choice','Teams Card Choice',o({title:s(),value:s()},['title','value'],json));
  const choices=component('microsoft_teams','card-choices','Teams Card Choices',a(choice.schema),{},choice.ref);
  const elementSchema={...clone(cardBody.schema.items),properties:{...clone(cardBody.schema.items.properties),facts:facts.schema,items:a({$ref:'#/definitions/ONFCardElement'}),columns:a({$ref:'#/definitions/ONFCardElement'}),images:a({$ref:'#/definitions/ONFCardElement'}),actions:clone(latest('Teams Adaptive Card actions')),selectAction:{$ref:'#/definitions/ONFCardAction'},choices:choices.schema,placeholder:s(),value:s(),isRequired:b(),errorMessage:s(),label:s(),isMultiline:b(),maxLength:i({minimum:0}),min:s(),max:s(),height:s(),width:{anyOf:[s(),n()]},bleed:b(),verticalContentAlignment:s(),horizontalAlignment:s()}};
  const cardElement=component('microsoft_teams','card-element','Teams Card Element',elementSchema,{facts:facts.ref,items:pinned(cardBody.id,true),columns:pinned(cardBody.id,true),images:pinned(cardBody.id,true),actions:pinned('Teams Adaptive Card actions',true),selectAction:pinned(cardAction.id,true),choices:choices.ref,width:jsonRef});
  replacements.set(cardBody.id,{schema:completeSchema({...clone(cardBody.schema),items:elementSchema}),reason:'Known recursive containers, columns, images, inputs and actions were hidden in an extension dictionary.',source:'https://adaptivecards.microsoft.com/schemas/adaptive-card.json'});
  update(cardAction.id,{card:{$ref:'#/definitions/ONFAdaptiveCard'},iconUrl:s(),style:s(),fallback:{anyOf:[{const:'drop'},{$ref:'#/definitions/ONFCardAction'}]},targetElements:a({anyOf:[s(),obj({elementId:s(),isVisible:b()})]})},{card:pinned(card.id,true),fallback:jsonRef,targetElements:listRef});
  const extraDefinitions={ONFXeroInvoice:clone(latest('Xero Invoice')),ONFXeroPayment:clone(latest('Xero Payment')),ONFADFNode:adfNode,ONFNotionBlock:clone(latest('Notion Block')),ONFCardElement:elementSchema,ONFCardAction:clone(latest(cardAction.id)),ONFAdaptiveCard:{...clone(card.schema),properties:{...clone(card.schema.properties),body:{...clone(cardBody.schema),items:elementSchema},actions:{...clone(card.schema.properties.actions),items:clone(latest(cardAction.id))}}}};

  return {additions,replacements,fieldRefs,extraDefinitions,special:{transitions,permalink,jiraFields,notionParent:parent,notionProperties:propertyMap},sources:sourceMap};
}

export function descriptorFor(property) {
  if(property.type==='string')return 'string';if(['number','integer'].includes(property.type))return 'number';if(property.type==='boolean')return 'boolean';
  if(Array.isArray(property.type)&&property.type.includes('null')){const t=property.type.find(type=>type!=='null');if(nullableIds[t])return ref(nullableIds[t]);}
  return ref(JSON_TYPES.json);
}

export function rewriteObjectCodecs(encode,decode,schema,fieldTypes,rootRef) {
  const fields=Object.keys(schema.properties),reserved=new Set(['exec','next','value','remainder','error','__proto__','prototype','constructor']);
  const aliases=Object.fromEntries(fields.map(field=>[field,field==='$schema'&&encode.inputs?.some(port=>port.id==='schema_url')?'schema_url':reserved.has(field)?'field_'+field:field]));
  const nullableFields=fields.filter(field=>{const property=schema.properties[field],descriptor=fieldTypes[field]??descriptorFor(property),id=typeof descriptor==='string'?descriptor:descriptor.type;return (property.anyOf?.some(branch=>branch.type==='null')||Array.isArray(property.type)&&property.type.includes('null'))&&!Object.values(nullableIds).includes(id)&&id!==JSON_TYPES.json;});
  const control=(id,name)=>({id,name,type:'control'}),boundary=(field,descriptor,required=false)=>({id:field,name:field,...(typeof descriptor==='string'?ref(descriptor):descriptor),...(required?{required:true}:{})}),port=(field,descriptor,required=false)=>({...boundary(field,descriptor,required),id:aliases[field]??field});
  const error=encode.outputs?.find(port=>port.type==='control'&&port.id==='error');
  const required=new Set(schema.required??[]);
  encode.inputs=[control('exec','Execute'),...fields.map(field=>port(field,fieldTypes[field]??descriptorFor(schema.properties[field]),required.has(field))),boundary('remainder',recordRef)];
  encode.outputs=[control('next','Next'),boundary('value',rootRef,true),...(error?[error]:[])];
  decode.inputs=[control('exec','Execute'),boundary('value',rootRef,true)];
  decode.outputs=[control('next','Next'),...fields.map(field=>port(field,fieldTypes[field]??descriptorFor(schema.properties[field]),required.has(field))),boundary('remainder',recordRef,true),...(error?[error]:[])];
  encode.code=`const fields=${JSON.stringify(fields)},aliases=${JSON.stringify(aliases)},nullable=${JSON.stringify(nullableFields)},remainder=inputs.remainder??{};for(const key of Object.keys(remainder))if(fields.includes(key)&&!(nullable.includes(key)&&remainder[key]===null&&!Object.hasOwn(inputs,aliases[key])))throw Error('Remainder collides with a declared field');const entries=Object.entries(remainder);for(const key of fields)if(Object.hasOwn(inputs,aliases[key]))entries.push([key,inputs[aliases[key]]]);return {value:Object.fromEntries(entries)};`;
  decode.code=`const fields=${JSON.stringify(fields)},aliases=${JSON.stringify(aliases)},nullable=${JSON.stringify(nullableFields)},out=Object.create(null),remainder={};for(const [key,value]of Object.entries(inputs.value)){if(!fields.includes(key)||nullable.includes(key)&&value===null)Object.defineProperty(remainder,key,{value,enumerable:true});else out[aliases[key]]=value;}out.remainder=remainder;return out;`;
}
