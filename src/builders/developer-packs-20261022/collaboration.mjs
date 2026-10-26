// Pure additional-ecosystem adapters. Importing performs no IO, publication or provider calls.
const s = {type:'string'}, n = {type:'number'}, b = {type:'boolean'};
const json = {$ref:'#/definitions/ONFJsonValue'};
const definitions = {ONFJsonValue:{anyOf:[{type:'null'},s,n,b,{type:'array',items:json},{type:'object',additionalProperties:json}]}};
const obj = (properties,required=[]) => ({type:'object',properties,required,additionalProperties:json,definitions});
const nullable = type => ({...type,type:[type.type,'null']});
const text = (required=false) => ({type:'string',...(required?{required:true}:{})});
const number = (required=false) => ({type:'number',schema:{type:'integer',minimum:0},...(required?{required:true}:{})});
const record = (required=false) => ({type:'record',...(required?{required:true}:{}),description:'Provider-defined custom fields; intentionally dynamic JSON Record.'});
const input = (name,optional=false) => ({input:name,...(optional?{optional:true}:{})});
const typed = (key,name,properties,sample,required=['id']) => ({key,name,schema:obj(properties,required),sample});
const wrap = (path,value) => path.reduceRight((child,key)=>({[key]:child}),value);
const defaults = {owner:'fixture-org',repo:'fixture-repo',organization:'fixture-org',project:'fixture-project',projectId:'42',id:'42',issueId:'10001',issueKey:'DEMO-1',channel:'C0123456789',channelId:'123456789012345678',messageId:'123456789012345679',ts:'1700000000.000001',pageId:'11111111-1111-4111-8111-111111111111',blockId:'22222222-2222-4222-8222-222222222222',dataSourceId:'33333333-3333-4333-8333-333333333333',databaseId:'44444444-4444-4444-8444-444444444444',userId:'55555555-5555-4555-8555-555555555555',spaceId:'123',incidentId:'PABC123',serviceId:'PSVC123',release:'fixture-release',eventId:'0123456789abcdef0123456789abcdef'};

function family(spec) {
  const types=spec.types.map(({sample,...type})=>type), samples=new Map(spec.types.map(t=>[t.key,t.sample]));
  const f={...spec,types,operations:[],description:spec.description+' Additional developer ecosystem; installation/account access is not assumed.'};
  const add = (key,name,path,type,options={}) => {
    const {list=false,method='GET',body,query,headers,inputs={},sampleInputs={},sampleResponse,responsePath=[],responseKind,successPath,successValue, ...rest}=options;
    const pathInputs=Object.fromEntries([...path.matchAll(/\{([^}*]+)\*?\}/g)].map(([,id])=>[id,text(true)]));
    const allInputs={...pathInputs,...inputs};
    const values=Object.fromEntries(Object.entries(allInputs).filter(([,d])=>d.required).map(([id,d])=>[id,defaults[id]??(d.type==='number'?1:d.type==='boolean'?false:d.type==='record'?{}:d.type==='list'?[]:'fixture')]));
    Object.assign(values,sampleInputs);
    const kind=responseKind??(type?(list?'list':'item'):'empty');
    const fields=spec.types.find(t=>t.key===type)?.schema.properties??{};
    const select={},selectTypes={};
    if(kind==='item')for(const field of ['id','key','title','name','number','ts','html_url','web_url','url'])if(['string','number','boolean'].includes(fields[field]?.type)){
      const output=field==='id'?'resource_id':field;select[output]=[...responsePath,field];selectTypes[output]=fields[field].type;
    }
    f.operations.push({key,name,path,method,effect:method==='GET'?'read':'write',description:rest.description??name+'. Returns a bounded result; provider permission and resource visibility apply.',
      scopes:spec.scopes,source:spec.sources[0],inputs:allInputs,...(query?{query}:{}),...(body?{body}:{}),
      headers:{...(spec.headers??{}),...(headers??{})},accept:spec.headers?.Accept??'application/json',response:{kind,...(type?{type}:{}),...(responsePath.length?{path:responsePath}:{}),...(successPath?{successPath,successValue}:{}),...(Object.keys(select).length?{select,selectTypes}:{})},
      sampleInputs:values,sampleResponse:sampleResponse??(kind==='empty'?null:wrap(responsePath,list?[samples.get(type)]:samples.get(type))),...rest});
  };
  return {f,add};
}

const githubSource='https://docs.github.com/en/rest';
const gh=family({id:'github',name:'GitHub',color:'#6e5494',icon:'GitBranch',baseUrl:'https://api.github.com',auth:{kind:'bearer',secret:'GITHUB_TOKEN'},headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},sources:[githubSource,'https://docs.github.com/en/rest/about-the-rest-api/api-versions','https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api'],scopes:'Fine-grained repository read permissions per resource; Issues/Pull requests/Actions write permission for corresponding mutations.',description:'Repository, issue, pull request and workflow automation.',types:[
  typed('repository','GitHub Repository',{id:n,name:s,full_name:s,private:b,html_url:s,default_branch:s,owner:json},{id:1,name:'fixture-repo',full_name:'fixture-org/fixture-repo',private:true,html_url:'https://github.com/fixture-org/fixture-repo',default_branch:'main'}),
  typed('issue','GitHub Issue',{id:n,number:n,title:s,state:s,body:nullable(s),html_url:s,user:json,labels:{type:'array',items:json}},{id:10,number:1,title:'Synthetic task',state:'open',body:null,html_url:'https://github.com/fixture-org/fixture-repo/issues/1'}),
  typed('pull-request','GitHub Pull Request',{id:n,number:n,title:s,state:s,draft:b,merged:b,html_url:s,head:json,base:json},{id:11,number:2,title:'Synthetic change',state:'open',draft:true,html_url:'https://github.com/fixture-org/fixture-repo/pull/2',head:{ref:'feature'},base:{ref:'main'}}),
  typed('comment','GitHub Comment',{id:n,body:s,html_url:s,user:json,created_at:s},{id:12,body:'Synthetic comment',html_url:'https://github.com/fixture-org/fixture-repo/issues/1#issuecomment-12',created_at:'2026-10-22T00:00:00Z'}),
  typed('workflow-run','GitHub Workflow Run',{id:n,name:nullable(s),head_branch:nullable(s),status:s,conclusion:nullable(s),html_url:s,run_number:n},{id:20,name:'CI',head_branch:'main',status:'completed',conclusion:'success',html_url:'https://github.com/fixture-org/fixture-repo/actions/runs/20',run_number:1}),
]});
const linkPage={kind:'link'};
gh.add('list-repositories','List My Repositories','/user/repos','repository',{list:true,paging:linkPage,query:{per_page:100}});
gh.add('get-repository','Get Repository','/repos/{owner}/{repo}','repository');
gh.add('list-issues','List Repository Issues','/repos/{owner}/{repo}/issues','issue',{list:true,paging:linkPage,query:{per_page:100,state:input('state',true)},inputs:{state:text()},description:'List repository issues and pull requests using the Issues endpoint. Pull requests are deliberately included by GitHub; use List Pull Requests for PR-only results.'});
gh.add('get-issue','Get Issue','/repos/{owner}/{repo}/issues/{id}','issue');
gh.add('create-issue','Create Issue','/repos/{owner}/{repo}/issues','issue',{method:'POST',inputs:{title:text(true),body:text()},body:{title:input('title'),body:input('body',true)},sampleInputs:{title:'Synthetic task',body:'Fixture only'}});
gh.add('update-issue','Update Issue','/repos/{owner}/{repo}/issues/{id}','issue',{method:'PATCH',inputs:{title:text(true),state:text()},body:{title:input('title'),state:input('state',true)},sampleInputs:{title:'Updated synthetic task',state:'closed'}});
gh.add('list-comments','List Issue Comments','/repos/{owner}/{repo}/issues/{id}/comments','comment',{list:true,paging:linkPage,query:{per_page:100}});
gh.add('create-comment','Create Issue Comment','/repos/{owner}/{repo}/issues/{id}/comments','comment',{method:'POST',inputs:{body:text(true)},body:{body:input('body')},sampleInputs:{body:'Synthetic comment'}});
gh.add('list-pull-requests','List Pull Requests','/repos/{owner}/{repo}/pulls','pull-request',{list:true,paging:linkPage,query:{per_page:100,state:input('state',true)},inputs:{state:text()}});
gh.add('get-pull-request','Get Pull Request','/repos/{owner}/{repo}/pulls/{id}','pull-request');
gh.add('create-pull-request','Create Pull Request','/repos/{owner}/{repo}/pulls','pull-request',{method:'POST',inputs:{title:text(true),head:text(true),base:text(true),draft:{type:'boolean'}},body:{title:input('title'),head:input('head'),base:input('base'),draft:input('draft',true)},sampleInputs:{title:'Synthetic change',head:'feature',base:'main',draft:true}});
gh.add('list-workflow-runs','List Workflow Runs','/repos/{owner}/{repo}/actions/runs','workflow-run',{list:true,responsePath:['workflow_runs'],paging:linkPage,query:{per_page:100,branch:input('branch',true)},inputs:{branch:text()}});
gh.add('get-workflow-run','Get Workflow Run','/repos/{owner}/{repo}/actions/runs/{id}','workflow-run');
gh.add('cancel-workflow-run','Cancel Workflow Run','/repos/{owner}/{repo}/actions/runs/{id}/cancel',null,{method:'POST'});

const gl=family({id:'gitlab',name:'GitLab',color:'#fc6d26',icon:'GitBranch',baseUrl:'https://gitlab.com',auth:{kind:'header',header:'PRIVATE-TOKEN',secret:'GITLAB_TOKEN'},sources:['https://docs.gitlab.com/api/','https://docs.gitlab.com/api/rest/authentication/','https://docs.gitlab.com/api/rest/'],scopes:'read_api for reads; api and project role permissions for deliberate writes.',description:'Projects, issues, merge requests, pipelines and jobs.',types:[
  typed('project','GitLab Project',{id:n,name:s,path_with_namespace:s,web_url:s,default_branch:nullable(s)},{id:42,name:'fixture-project',path_with_namespace:'fixture-org/fixture-project',web_url:'https://gitlab.com/fixture-org/fixture-project',default_branch:'main'}),
  typed('issue','GitLab Issue',{id:n,iid:n,project_id:n,title:s,state:s,description:nullable(s),web_url:s},{id:100,iid:1,project_id:42,title:'Synthetic task',state:'opened',description:null,web_url:'https://gitlab.com/fixture-org/fixture-project/-/issues/1'}),
  typed('merge-request','GitLab Merge Request',{id:n,iid:n,project_id:n,title:s,state:s,draft:b,source_branch:s,target_branch:s,web_url:s},{id:101,iid:2,project_id:42,title:'Synthetic change',state:'opened',draft:true,source_branch:'feature',target_branch:'main',web_url:'https://gitlab.com/fixture-org/fixture-project/-/merge_requests/2'}),
  typed('pipeline','GitLab Pipeline',{id:n,iid:n,project_id:n,status:s,ref:s,sha:s,web_url:s},{id:200,iid:1,project_id:42,status:'success',ref:'main',sha:'0123456789abcdef',web_url:'https://gitlab.com/fixture-org/fixture-project/-/pipelines/200'}),
  typed('job','GitLab Job',{id:n,name:s,status:s,stage:s,web_url:s},{id:201,name:'test',status:'success',stage:'test',web_url:'https://gitlab.com/fixture-org/fixture-project/-/jobs/201'}),
]});
gl.add('list-projects','List Projects','/api/v4/projects','project',{list:true,paging:linkPage,query:{membership:true,per_page:100}});
gl.add('get-project','Get Project','/api/v4/projects/{projectId}','project');
gl.add('list-issues','List Project Issues','/api/v4/projects/{projectId}/issues','issue',{list:true,paging:linkPage,query:{per_page:100,state:input('state',true)},inputs:{state:text()}});
gl.add('get-issue','Get Project Issue','/api/v4/projects/{projectId}/issues/{id}','issue');
gl.add('create-issue','Create Project Issue','/api/v4/projects/{projectId}/issues','issue',{method:'POST',inputs:{title:text(true),description:text()},body:{title:input('title'),description:input('description',true)},sampleInputs:{title:'Synthetic task'}});
gl.add('list-merge-requests','List Merge Requests','/api/v4/projects/{projectId}/merge_requests','merge-request',{list:true,paging:linkPage,query:{per_page:100,state:'opened'}});
gl.add('get-merge-request','Get Merge Request','/api/v4/projects/{projectId}/merge_requests/{id}','merge-request');
gl.add('create-merge-request','Create Merge Request','/api/v4/projects/{projectId}/merge_requests','merge-request',{method:'POST',inputs:{title:text(true),source_branch:text(true),target_branch:text(true)},body:{title:input('title'),source_branch:input('source_branch'),target_branch:input('target_branch')},sampleInputs:{title:'Synthetic change',source_branch:'feature',target_branch:'main'}});
gl.add('list-pipelines','List Project Pipelines','/api/v4/projects/{projectId}/pipelines','pipeline',{list:true,paging:linkPage,query:{per_page:100}});
gl.add('get-pipeline','Get Pipeline','/api/v4/projects/{projectId}/pipelines/{id}','pipeline');
gl.add('create-pipeline','Create Pipeline','/api/v4/projects/{projectId}/pipeline','pipeline',{method:'POST',inputs:{ref:text(true)},body:{ref:input('ref')},sampleInputs:{ref:'main'}});
gl.add('cancel-pipeline','Cancel Pipeline','/api/v4/projects/{projectId}/pipelines/{id}/cancel','pipeline',{method:'POST'});
gl.add('list-jobs','List Project Jobs','/api/v4/projects/{projectId}/jobs','job',{list:true,paging:linkPage,query:{per_page:100}});
gl.add('get-job','Get Job','/api/v4/projects/{projectId}/jobs/{id}','job');

const gt=family({id:'gitea',name:'Gitea',color:'#609926',icon:'GitBranch',baseUrl:'https://gitea.example.com',auth:{kind:'header',header:'Authorization',prefix:'token ',secret:'GITEA_TOKEN'},sources:['https://docs.gitea.com/api/1.24/','https://docs.gitea.com/development/api-usage/'],scopes:'Repository/issue read or write token scopes and repository permissions. Confirm target server OpenAPI for its installed version.',description:'Self-hosted repository and review automation.',types:[
  typed('repository','Gitea Repository',{id:n,name:s,full_name:s,private:b,html_url:s,default_branch:s},{id:1,name:'fixture-repo',full_name:'fixture-org/fixture-repo',private:true,html_url:'https://gitea.example.com/fixture-org/fixture-repo',default_branch:'main'}),
  typed('issue','Gitea Issue',{id:n,number:n,title:s,state:s,body:s,html_url:s},{id:2,number:1,title:'Synthetic task',state:'open',body:'Fixture only',html_url:'https://gitea.example.com/fixture-org/fixture-repo/issues/1'}),
  typed('pull-request','Gitea Pull Request',{id:n,number:n,title:s,state:s,body:s,html_url:s,head:json,base:json},{id:3,number:2,title:'Synthetic change',state:'open',body:'Fixture only',html_url:'https://gitea.example.com/fixture-org/fixture-repo/pulls/2',head:{ref:'feature'},base:{ref:'main'}}),
  typed('comment','Gitea Comment',{id:n,body:s,html_url:s,created_at:s},{id:4,body:'Synthetic comment',html_url:'https://gitea.example.com/fixture-org/fixture-repo/issues/1#issuecomment-4',created_at:'2026-10-22T00:00:00Z'}),
]});
const gpage={kind:'page',parameter:'page',sizeParameter:'limit',size:50};
gt.add('list-repositories','List My Repositories','/api/v1/user/repos','repository',{list:true,paging:gpage,query:{limit:50}});
gt.add('get-repository','Get Repository','/api/v1/repos/{owner}/{repo}','repository');
gt.add('list-issues','List Issues','/api/v1/repos/{owner}/{repo}/issues','issue',{list:true,paging:gpage,query:{limit:50,type:'issues'}});
gt.add('get-issue','Get Issue','/api/v1/repos/{owner}/{repo}/issues/{id}','issue');
gt.add('create-issue','Create Issue','/api/v1/repos/{owner}/{repo}/issues','issue',{method:'POST',inputs:{title:text(true),body:text()},body:{title:input('title'),body:input('body',true)},sampleInputs:{title:'Synthetic task'}});
gt.add('edit-issue','Edit Issue','/api/v1/repos/{owner}/{repo}/issues/{id}','issue',{method:'PATCH',inputs:{title:text(true),state:text()},body:{title:input('title'),state:input('state',true)},sampleInputs:{title:'Updated synthetic task',state:'closed'}});
gt.add('list-pull-requests','List Pull Requests','/api/v1/repos/{owner}/{repo}/pulls','pull-request',{list:true,paging:gpage,query:{limit:50}});
gt.add('get-pull-request','Get Pull Request','/api/v1/repos/{owner}/{repo}/pulls/{id}','pull-request');
gt.add('create-pull-request','Create Pull Request','/api/v1/repos/{owner}/{repo}/pulls','pull-request',{method:'POST',inputs:{title:text(true),head:text(true),base:text(true)},body:{title:input('title'),head:input('head'),base:input('base')},sampleInputs:{title:'Synthetic change',head:'feature',base:'main'}});
gt.add('list-comments','List Issue Comments','/api/v1/repos/{owner}/{repo}/issues/{id}/comments','comment',{list:true,paging:gpage,query:{limit:50}});
gt.add('create-comment','Create Issue Comment','/api/v1/repos/{owner}/{repo}/issues/{id}/comments','comment',{method:'POST',inputs:{body:text(true)},body:{body:input('body')},sampleInputs:{body:'Synthetic comment'}});
gt.add('get-comment','Get Comment','/api/v1/repos/{owner}/{repo}/issues/comments/{id}','comment');

const jira=family({id:'jira',name:'Jira Cloud',color:'#0052cc',icon:'ListChecks',baseUrl:'https://example.atlassian.net',auth:{kind:'basic',secret:'JIRA_API_TOKEN',username:'user@example.com'},sources:['https://developer.atlassian.com/cloud/jira/platform/rest/v3/','https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/'],scopes:'Jira browse-project/issue permissions for reads; create/edit/comment/transition permissions for actions; account email and API token.',description:'Issue search, project discovery, comments and transitions.',types:[
  typed('issue','Jira Issue',{id:s,key:s,self:s,fields:{type:'object',additionalProperties:json}},{id:'10001',key:'DEMO-1',self:'https://example.atlassian.net/rest/api/3/issue/10001',fields:{summary:'Synthetic task',status:{name:'To Do'}}}),
  typed('project','Jira Project',{id:s,key:s,name:s,self:s,projectTypeKey:s},{id:'10000',key:'DEMO',name:'Fixture Project',self:'https://example.atlassian.net/rest/api/3/project/10000',projectTypeKey:'software'}),
  typed('comment','Jira Comment',{id:s,self:s,body:json,created:s,updated:s,author:json},{id:'10002',self:'https://example.atlassian.net/rest/api/3/issue/10001/comment/10002',body:{type:'doc',version:1,content:[{type:'paragraph',content:[{type:'text',text:'Synthetic comment'}]}]},created:'2026-10-22T00:00:00Z',updated:'2026-10-22T00:00:00Z'}),
]});
jira.add('search-issues','Search Issues with JQL','/rest/api/3/search/jql','issue',{list:true,responsePath:['issues'],inputs:{jql:text(true)},query:{jql:input('jql'),maxResults:100},paging:{kind:'token',path:['nextPageToken'],parameter:'nextPageToken'},sampleInputs:{jql:'project = DEMO ORDER BY created DESC'}});
jira.add('get-issue','Get Issue','/rest/api/3/issue/{issueKey}','issue');
jira.add('create-issue','Create Issue','/rest/api/3/issue','issue',{method:'POST',inputs:{projectKey:text(true),issueTypeId:text(true),summary:text(true)},body:{fields:{project:{key:input('projectKey')},issuetype:{id:input('issueTypeId')},summary:input('summary')}},sampleInputs:{projectKey:'DEMO',issueTypeId:'10000',summary:'Synthetic task'},sampleResponse:{id:'10001',key:'DEMO-1',self:'https://example.atlassian.net/rest/api/3/issue/10001'}});
jira.add('edit-issue-fields','Edit Issue Fields','/rest/api/3/issue/{issueKey}',null,{method:'PUT',inputs:{fields:record(true)},body:{fields:input('fields')},sampleInputs:{fields:{summary:'Updated synthetic task'}}});
jira.add('list-projects','List Projects','/rest/api/3/project/search','project',{list:true,responsePath:['values'],paging:{kind:'offset',parameter:'startAt',sizeParameter:'maxResults',size:100,totalPath:['total']},query:{maxResults:100},sampleResponse:{values:[{id:'10000',key:'DEMO',name:'Fixture Project'}],startAt:0,maxResults:100,total:1,isLast:true}});
jira.add('get-project','Get Project','/rest/api/3/project/{projectId}','project');
jira.add('list-comments','List Issue Comments','/rest/api/3/issue/{issueKey}/comment','comment',{list:true,responsePath:['comments'],paging:{kind:'offset',parameter:'startAt',sizeParameter:'maxResults',size:100,totalPath:['total']},query:{maxResults:100},sampleResponse:{comments:[{id:'10002',body:{type:'doc',version:1,content:[]}}],startAt:0,maxResults:100,total:1}});
jira.add('get-comment','Get Issue Comment','/rest/api/3/issue/{issueKey}/comment/{id}','comment');
jira.add('create-comment','Create Issue Comment','/rest/api/3/issue/{issueKey}/comment','comment',{method:'POST',inputs:{text:text(true)},body:{body:{type:'doc',version:1,content:[{type:'paragraph',content:[{type:'text',text:input('text')}]}]}},sampleInputs:{text:'Synthetic comment'}});
jira.add('delete-comment','Delete Issue Comment','/rest/api/3/issue/{issueKey}/comment/{id}',null,{method:'DELETE'});
jira.add('list-transitions','List Issue Transitions','/rest/api/3/issue/{issueKey}/transitions',null,{responseKind:'json',sampleResponse:{transitions:[{id:'31',name:'Done',to:{name:'Done'}}]}});
jira.add('transition-issue','Transition Issue','/rest/api/3/issue/{issueKey}/transitions',null,{method:'POST',inputs:{transitionId:text(true)},body:{transition:{id:input('transitionId')}},sampleInputs:{transitionId:'31'}});

const cf=family({id:'confluence',name:'Confluence Cloud',color:'#172b4d',icon:'BookOpen',baseUrl:'https://example.atlassian.net',auth:{kind:'basic',secret:'CONFLUENCE_API_TOKEN',username:'user@example.com'},sources:['https://developer.atlassian.com/cloud/confluence/rest/v2/','https://developer.atlassian.com/cloud/confluence/basic-auth-for-rest-apis/'],scopes:'Confluence page/space/comment read and write permissions for selected endpoints; account email and API token.',description:'Spaces, pages and comments using Confluence Cloud v2.',types:[
  typed('page','Confluence Page',{id:s,status:s,title:s,spaceId:s,parentId:nullable(s),body:json,version:json},{id:'123',status:'current',title:'Synthetic page',spaceId:'42',body:{storage:{value:'<p>Fixture</p>',representation:'storage'}},version:{number:1}}),
  typed('space','Confluence Space',{id:s,key:s,name:s,type:s,status:s,homepageId:s},{id:'42',key:'DEMO',name:'Fixture Space',type:'global',status:'current',homepageId:'123'}),
  typed('comment','Confluence Comment',{id:s,status:s,pageId:s,body:json,version:json},{id:'124',status:'current',pageId:'123',body:{storage:{value:'<p>Synthetic comment</p>',representation:'storage'}},version:{number:1}}),
]});
const cpage={kind:'url',path:['_links','next']};
cf.add('list-spaces','List Spaces','/wiki/api/v2/spaces','space',{list:true,responsePath:['results'],query:{limit:100},paging:cpage});
cf.add('get-space','Get Space','/wiki/api/v2/spaces/{spaceId}','space');
cf.add('list-pages','List Pages','/wiki/api/v2/pages','page',{list:true,responsePath:['results'],query:{limit:100,'body-format':'storage'},paging:cpage});
cf.add('list-space-pages','List Space Pages','/wiki/api/v2/spaces/{spaceId}/pages','page',{list:true,responsePath:['results'],query:{limit:100},paging:cpage});
cf.add('get-page','Get Page','/wiki/api/v2/pages/{pageId}','page',{query:{'body-format':'storage'}});
cf.add('create-page','Create Page','/wiki/api/v2/pages','page',{method:'POST',inputs:{spaceId:text(true),title:text(true),content:text(true),parentId:text()},body:{spaceId:input('spaceId'),status:'current',title:input('title'),parentId:input('parentId',true),body:{representation:'storage',value:input('content')}},sampleInputs:{spaceId:'42',title:'Synthetic page',content:'<p>Fixture</p>'}});
cf.add('update-page','Update Page','/wiki/api/v2/pages/{pageId}','page',{method:'PUT',inputs:{title:text(true),content:text(true),version:number(true)},body:{id:input('pageId'),status:'current',title:input('title'),body:{representation:'storage',value:input('content')},version:{number:input('version')}},sampleInputs:{title:'Updated synthetic page',content:'<p>Fixture</p>',version:2},description:'Update with the next explicit Confluence version number; retrieve current page first. A stale version fails rather than retrying.'});
cf.add('delete-page','Delete Page','/wiki/api/v2/pages/{pageId}',null,{method:'DELETE'});
cf.add('list-page-comments','List Page Footer Comments','/wiki/api/v2/pages/{pageId}/footer-comments','comment',{list:true,responsePath:['results'],query:{limit:100,'body-format':'storage'},paging:cpage});
cf.add('get-comment','Get Footer Comment','/wiki/api/v2/footer-comments/{id}','comment',{query:{'body-format':'storage'}});
cf.add('create-comment','Create Footer Comment','/wiki/api/v2/footer-comments','comment',{method:'POST',inputs:{pageId:text(true),content:text(true)},body:{pageId:input('pageId'),body:{representation:'storage',value:input('content')}},sampleInputs:{content:'<p>Synthetic comment</p>'}});
cf.add('delete-comment','Delete Footer Comment','/wiki/api/v2/footer-comments/{id}',null,{method:'DELETE'});

const slack=family({id:'slack',name:'Slack',color:'#611f69',icon:'MessageSquare',baseUrl:'https://slack.com',auth:{kind:'bearer',secret:'SLACK_BOT_TOKEN'},sources:['https://docs.slack.dev/reference/methods/','https://docs.slack.dev/apis/web-api/pagination/'],scopes:'channels:read/groups:read/im:read/mpim:read for permitted conversations; history scopes for history; chat:write, reactions:write and users:read for corresponding methods. Membership and commercial history limits still apply.',description:'Conversation history, threaded messages and developer notifications.',types:[
  typed('conversation','Slack Conversation',{id:s,name:s,is_channel:b,is_private:b,is_archived:b,topic:json,purpose:json},{id:'C0123456789',name:'fixture-builds',is_channel:true,is_private:false,is_archived:false}),
  typed('message','Slack Message',{ts:s,text:s,type:s,user:s,thread_ts:s,reply_count:n},{ts:'1700000000.000001',text:'Synthetic build result',type:'message',user:'U0123456789'},['ts']),
  typed('user','Slack User',{id:s,name:s,real_name:s,is_bot:b,deleted:b,profile:json},{id:'U0123456789',name:'fixture-bot',real_name:'Fixture Bot',is_bot:true,deleted:false}),
]});
const spage={kind:'token',path:['response_metadata','next_cursor'],parameter:'cursor'};
const sok={successPath:['ok'],successValue:true};
slack.add('list-conversations','List Conversations','/api/conversations.list','conversation',{...sok,list:true,responsePath:['channels'],paging:spage,query:{limit:100,exclude_archived:true},sampleResponse:{ok:true,channels:[{id:'C0123456789',name:'fixture-builds'}],response_metadata:{next_cursor:''}}});
slack.add('get-conversation','Get Conversation','/api/conversations.info','conversation',{...sok,inputs:{channel:text(true)},query:{channel:input('channel')},responsePath:['channel'],sampleResponse:{ok:true,channel:{id:'C0123456789',name:'fixture-builds'}}});
slack.add('history','Read Conversation History','/api/conversations.history','message',{...sok,list:true,responsePath:['messages'],paging:spage,inputs:{channel:text(true),oldest:text(),latest:text()},query:{channel:input('channel'),limit:15,oldest:input('oldest',true),latest:input('latest',true)},sampleResponse:{ok:true,messages:[{ts:'1700000000.000001',text:'Synthetic build result'}],has_more:false,response_metadata:{next_cursor:''}},description:'Read permitted conversation history. Requests at most 15 messages per page to support commercially distributed non-Marketplace app limits; workspace/token rate limits remain external.'});
slack.add('thread-replies','Read Thread Replies','/api/conversations.replies','message',{...sok,list:true,responsePath:['messages'],paging:spage,inputs:{channel:text(true),ts:text(true)},query:{channel:input('channel'),ts:input('ts'),limit:15},sampleResponse:{ok:true,messages:[{ts:'1700000000.000001',text:'Synthetic thread reply'}],has_more:false,response_metadata:{next_cursor:''}}});
slack.add('post-message','Post Message','/api/chat.postMessage','message',{...sok,method:'POST',inputs:{channel:text(true),text:text(true),thread_ts:text()},body:{channel:input('channel'),text:input('text'),thread_ts:input('thread_ts',true),unfurl_links:false,unfurl_media:false},responsePath:['message'],sampleInputs:{text:'Synthetic build result'},sampleResponse:{ok:true,channel:'C0123456789',ts:'1700000000.000001',message:{ts:'1700000000.000001',text:'Synthetic build result'}}});
slack.add('update-message','Update Message','/api/chat.update','message',{...sok,method:'POST',inputs:{channel:text(true),ts:text(true),text:text(true)},body:{channel:input('channel'),ts:input('ts'),text:input('text')},sampleInputs:{text:'Updated synthetic message'},sampleResponse:{ok:true,channel:'C0123456789',ts:'1700000000.000001',text:'Updated synthetic message',message:{text:'Updated synthetic message',user:'U0123456789'}},description:'Update an own message. The typed result is the response envelope containing ts/text; the nested message deliberately does not supply ts in the documented API response.'});
slack.add('delete-message','Delete Message','/api/chat.delete',null,{...sok,method:'POST',inputs:{channel:text(true),ts:text(true)},body:{channel:input('channel'),ts:input('ts')},sampleResponse:{ok:true,channel:'C0123456789',ts:'1700000000.000001'}});
slack.add('add-reaction','Add Reaction','/api/reactions.add',null,{...sok,method:'POST',inputs:{channel:text(true),ts:text(true),name:text(true)},body:{channel:input('channel'),timestamp:input('ts'),name:input('name')},sampleInputs:{name:'white_check_mark'},sampleResponse:{ok:true}});
slack.add('remove-reaction','Remove Reaction','/api/reactions.remove',null,{...sok,method:'POST',inputs:{channel:text(true),ts:text(true),name:text(true)},body:{channel:input('channel'),timestamp:input('ts'),name:input('name')},sampleInputs:{name:'white_check_mark'},sampleResponse:{ok:true}});
slack.add('list-users','List Users','/api/users.list','user',{...sok,list:true,responsePath:['members'],paging:spage,query:{limit:100},sampleResponse:{ok:true,members:[{id:'U0123456789',name:'fixture-bot'}],response_metadata:{next_cursor:''}}});
slack.add('get-user','Get User','/api/users.info','user',{...sok,inputs:{user:text(true)},query:{user:input('user')},responsePath:['user'],sampleInputs:{user:'U0123456789'},sampleResponse:{ok:true,user:{id:'U0123456789',name:'fixture-bot'}}});
slack.add('message-permalink','Get Message Permalink','/api/chat.getPermalink',null,{...sok,responseKind:'json',inputs:{channel:text(true),ts:text(true)},query:{channel:input('channel'),message_ts:input('ts')},sampleResponse:{ok:true,channel:'C0123456789',permalink:'https://fixture.slack.com/archives/C0123456789/p1700000000000001'}});

const discord=family({id:'discord',name:'Discord',color:'#5865f2',icon:'MessageSquare',baseUrl:'https://discord.com',auth:{kind:'header',header:'Authorization',prefix:'Bot ',secret:'DISCORD_BOT_TOKEN'},sources:['https://docs.discord.com/developers/resources/message','https://docs.discord.com/developers/resources/channel','https://docs.discord.com/developers/resources/user'],scopes:'Bot authorization only. Channel visibility, READ_MESSAGE_HISTORY, SEND_MESSAGES, MANAGE_MESSAGES or ADD_REACTIONS as appropriate; message-content privileged intent may limit fields.',description:'Bot channel messages, reactions and channel discovery.',types:[
  typed('channel','Discord Channel',{id:s,type:n,guild_id:s,name:nullable(s),topic:nullable(s),parent_id:nullable(s)},{id:'123456789012345678',type:0,guild_id:'123456789012345670',name:'fixture-builds',topic:null}),
  typed('message','Discord Message',{id:s,channel_id:s,content:s,timestamp:s,edited_timestamp:nullable(s),author:json,attachments:{type:'array',items:json}},{id:'123456789012345679',channel_id:'123456789012345678',content:'Synthetic build result',timestamp:'2026-10-22T00:00:00Z',edited_timestamp:null,author:{id:'123456789012345671',username:'fixture-bot'},attachments:[]}),
  typed('user','Discord User',{id:s,username:s,global_name:nullable(s),bot:b,avatar:nullable(s)},{id:'123456789012345671',username:'fixture-bot',global_name:null,bot:true,avatar:null}),
]});
discord.add('get-channel','Get Channel','/api/v10/channels/{channelId}','channel');
discord.add('list-guild-channels','List Guild Channels','/api/v10/guilds/{id}/channels','channel',{list:true});
discord.add('read-messages','Read Channel Messages','/api/v10/channels/{channelId}/messages','message',{list:true,inputs:{before:text()},query:{limit:100,before:input('before',true)},description:'Read one bounded page. Continue explicitly with before equal to the last returned message snowflake; no implicit stream or gateway subscription.'});
discord.add('get-message','Get Channel Message','/api/v10/channels/{channelId}/messages/{messageId}','message');
discord.add('create-message','Create Channel Message','/api/v10/channels/{channelId}/messages','message',{method:'POST',inputs:{content:text(true)},body:{content:input('content'),allowed_mentions:{parse:[]}},sampleInputs:{content:'Synthetic build result'},description:'Send a bot message with automatic mention parsing disabled. Uncertain delivery must be reconciled before retrying.'});
discord.add('edit-message','Edit Own Message','/api/v10/channels/{channelId}/messages/{messageId}','message',{method:'PATCH',inputs:{content:text(true)},body:{content:input('content'),allowed_mentions:{parse:[]}},sampleInputs:{content:'Updated synthetic build result'}});
discord.add('delete-message','Delete Message','/api/v10/channels/{channelId}/messages/{messageId}',null,{method:'DELETE'});
discord.add('add-reaction','Add Own Reaction','/api/v10/channels/{channelId}/messages/{messageId}/reactions/{emoji}/@me',null,{method:'PUT',sampleInputs:{emoji:'✅'}});
discord.add('remove-reaction','Remove Own Reaction','/api/v10/channels/{channelId}/messages/{messageId}/reactions/{emoji}/@me',null,{method:'DELETE',sampleInputs:{emoji:'✅'}});
discord.add('get-current-user','Get Bot User','/api/v10/users/@me','user');
discord.add('get-user','Get User','/api/v10/users/{userId}','user',{sampleInputs:{userId:'123456789012345671'}});
discord.add('trigger-typing','Trigger Typing Indicator','/api/v10/channels/{channelId}/typing',null,{method:'POST'});

const notion=family({id:'notion',name:'Notion',color:'#444444',icon:'Notebook',baseUrl:'https://api.notion.com',auth:{kind:'bearer',secret:'NOTION_TOKEN'},headers:{'Notion-Version':'2026-03-11'},sources:['https://developers.notion.com/reference/intro','https://developers.notion.com/reference/query-a-data-source','https://developers.notion.com/guides/get-started/upgrade-guide-2026-03-11'],scopes:'Integration connection capabilities (read/insert/update content and read user information) plus explicit page/data-source sharing. Database and data-source identities are distinct.',description:'Page, block and data-source automation using the split data-source API.',types:[
  typed('page','Notion Page',{object:{const:'page'},id:s,url:s,archived:b,in_trash:b,properties:{type:'object',additionalProperties:json},parent:json},{object:'page',id:'11111111-1111-4111-8111-111111111111',url:'https://www.notion.so/11111111111141118111111111111111',archived:false,in_trash:false,properties:{title:{type:'title',title:[{type:'text',text:{content:'Synthetic page'}}]}},parent:{type:'workspace',workspace:true}}),
  typed('block','Notion Block',{object:{const:'block'},id:s,type:s,has_children:b,archived:b,in_trash:b},{object:'block',id:'22222222-2222-4222-8222-222222222222',type:'paragraph',has_children:false,archived:false,in_trash:false,paragraph:{rich_text:[{type:'text',text:{content:'Synthetic block'}}]}}),
  typed('user','Notion User',{object:{const:'user'},id:s,type:s,name:nullable(s),avatar_url:nullable(s)},{object:'user',id:'55555555-5555-4555-8555-555555555555',type:'bot',name:'Fixture connection',avatar_url:null}),
  typed('data-source','Notion Data Source',{object:{const:'data_source'},id:s,title:{type:'array',items:json},properties:{type:'object',additionalProperties:json},parent:json},{object:'data_source',id:'33333333-3333-4333-8333-333333333333',title:[{type:'text',text:{content:'Fixture tasks'}}],properties:{Name:{id:'title',type:'title',title:{}}},parent:{type:'database_id',database_id:'44444444-4444-4444-8444-444444444444'}}),
]});
const npage={kind:'token',path:['next_cursor'],parameter:'start_cursor'};
notion.add('get-page','Get Page','/v1/pages/{pageId}','page');
notion.add('search-pages','Search Pages','/v1/search','page',{method:'POST',effect:'read',list:true,responsePath:['results'],paging:{...npage,location:'body'},inputs:{query:text()},body:{query:input('query',true),filter:{value:'page',property:'object'},page_size:100},sampleResponse:{object:'list',results:[{object:'page',id:'11111111-1111-4111-8111-111111111111',properties:{}}],has_more:false,next_cursor:null}});
notion.add('query-data-source','Query Data Source','/v1/data_sources/{dataSourceId}/query','page',{method:'POST',effect:'read',list:true,responsePath:['results'],paging:{...npage,location:'body'},inputs:{filter:record()},body:{filter:input('filter',true),page_size:100},sampleResponse:{object:'list',results:[{object:'page',id:'11111111-1111-4111-8111-111111111111',properties:{}}],has_more:false,next_cursor:null}});
notion.add('create-page','Create Page','/v1/pages','page',{method:'POST',inputs:{parent:record(true),properties:record(true)},body:{parent:input('parent'),properties:input('properties')},sampleInputs:{parent:{type:'data_source_id',data_source_id:'33333333-3333-4333-8333-333333333333'},properties:{Name:{type:'title',title:[{type:'text',text:{content:'Synthetic task'}}]}}}});
notion.add('update-page-properties','Update Page Properties','/v1/pages/{pageId}','page',{method:'PATCH',inputs:{properties:record(true)},body:{properties:input('properties')},sampleInputs:{properties:{Name:{type:'title',title:[{type:'text',text:{content:'Updated synthetic task'}}]}}}});
notion.add('archive-page','Move Page to Trash','/v1/pages/{pageId}','page',{method:'PATCH',body:{in_trash:true}});
notion.add('get-block','Get Block','/v1/blocks/{blockId}','block');
notion.add('list-block-children','List Block Children','/v1/blocks/{blockId}/children','block',{list:true,responsePath:['results'],paging:npage,query:{page_size:100},sampleResponse:{object:'list',results:[{object:'block',id:'22222222-2222-4222-8222-222222222222',type:'paragraph',has_children:false}],has_more:false,next_cursor:null}});
notion.add('append-paragraph','Append Paragraph Block','/v1/blocks/{blockId}/children','block',{method:'PATCH',list:true,responsePath:['results'],inputs:{text:text(true)},body:{children:[{object:'block',type:'paragraph',paragraph:{rich_text:[{type:'text',text:{content:input('text')}}]}}]},sampleInputs:{text:'Synthetic paragraph'},sampleResponse:{object:'list',results:[{object:'block',id:'22222222-2222-4222-8222-222222222222',type:'paragraph',has_children:false}]}});
notion.add('delete-block','Move Block to Trash','/v1/blocks/{blockId}','block',{method:'DELETE'});
notion.add('list-users','List Users','/v1/users','user',{list:true,responsePath:['results'],paging:npage,query:{page_size:100},sampleResponse:{object:'list',results:[{object:'user',id:'55555555-5555-4555-8555-555555555555',type:'bot',name:'Fixture connection'}],has_more:false,next_cursor:null}});
notion.add('get-user','Get User','/v1/users/{userId}','user');
notion.add('get-data-source','Get Data Source','/v1/data_sources/{dataSourceId}','data-source');
notion.add('search-data-sources','Search Data Sources','/v1/search','data-source',{method:'POST',effect:'read',list:true,responsePath:['results'],paging:{...npage,location:'body'},inputs:{query:text()},body:{query:input('query',true),filter:{value:'data_source',property:'object'},page_size:100},sampleResponse:{object:'list',results:[{object:'data_source',id:'33333333-3333-4333-8333-333333333333',properties:{}}],has_more:false,next_cursor:null}});

const sentry=family({id:'sentry',name:'Sentry',color:'#6c5fc7',icon:'Bug',baseUrl:'https://sentry.io',auth:{kind:'bearer',secret:'SENTRY_TOKEN'},sources:['https://docs.sentry.io/api/','https://docs.sentry.io/api/auth/','https://docs.sentry.io/api/pagination/'],scopes:'org:read/project:read/event:read for matching reads; event:write for issue updates and project:releases for release mutations. Token must be authorized for target organization/project.',description:'Issue triage, event diagnostics and release metadata.',types:[
  typed('project','Sentry Project',{id:s,slug:s,name:s,platform:nullable(s),isPublic:b},{id:'42',slug:'fixture-project',name:'Fixture Project',platform:'node',isPublic:false}),
  typed('issue','Sentry Issue',{id:s,shortId:s,title:s,status:s,level:s,count:s,userCount:n,firstSeen:s,lastSeen:s,project:json},{id:'100',shortId:'FIX-1',title:'Synthetic exception',status:'unresolved',level:'error',count:'1',userCount:1,firstSeen:'2026-10-22T00:00:00Z',lastSeen:'2026-10-22T00:00:00Z'}),
  typed('event','Sentry Event',{eventID:s,id:s,title:s,message:s,platform:s,dateCreated:s,entries:{type:'array',items:json}},{eventID:'0123456789abcdef0123456789abcdef',id:'0123456789abcdef0123456789abcdef',title:'Synthetic exception',message:'Fixture only',platform:'node',dateCreated:'2026-10-22T00:00:00Z',entries:[]},['eventID']),
  typed('release','Sentry Release',{version:s,shortVersion:s,dateCreated:s,dateReleased:nullable(s),newGroups:n,projects:{type:'array',items:json}},{version:'fixture-release',shortVersion:'fixture',dateCreated:'2026-10-22T00:00:00Z',dateReleased:null,newGroups:0,projects:[{slug:'fixture-project',name:'Fixture Project'}]},['version']),
]});
sentry.add('list-projects','List Organization Projects','/api/0/organizations/{organization}/projects/','project',{list:true,paging:linkPage});
sentry.add('get-project','Get Project','/api/0/projects/{organization}/{project}/','project');
sentry.add('list-issues','List Organization Issues','/api/0/organizations/{organization}/issues/','issue',{list:true,paging:linkPage,inputs:{query:text()},query:{query:input('query',true),limit:100},description:'Use the current organization Issues API rather than the deprecated project Issues list; add project filters in the search query when needed.'});
sentry.add('get-issue','Get Issue','/api/0/issues/{id}/','issue');
sentry.add('resolve-issue','Resolve Issue','/api/0/issues/{id}/','issue',{method:'PUT',body:{status:'resolved'}});
sentry.add('reopen-issue','Reopen Issue','/api/0/issues/{id}/','issue',{method:'PUT',body:{status:'unresolved'}});
sentry.add('list-issue-events','List Issue Events','/api/0/issues/{id}/events/','event',{list:true,paging:linkPage});
sentry.add('get-project-event','Get Project Event','/api/0/projects/{organization}/{project}/events/{eventId}/','event');
sentry.add('latest-issue-event','Get Latest Issue Event','/api/0/issues/{id}/events/latest/','event');
sentry.add('list-releases','List Organization Releases','/api/0/organizations/{organization}/releases/','release',{list:true,paging:linkPage});
sentry.add('get-release','Get Organization Release','/api/0/organizations/{organization}/releases/{release}/','release');
sentry.add('create-release','Create Organization Release','/api/0/organizations/{organization}/releases/','release',{method:'POST',inputs:{version:text(true),projects:{type:'list',required:true,schema:{type:'array',items:s,minItems:1}}},body:{version:input('version'),projects:input('projects')},sampleInputs:{version:'fixture-release',projects:['fixture-project']}});

const pd=family({id:'pagerduty',name:'PagerDuty',color:'#06ac38',icon:'Bell',baseUrl:'https://api.pagerduty.com',auth:{kind:'header',header:'Authorization',prefix:'Token token=',secret:'PAGERDUTY_API_TOKEN'},headers:{Accept:'application/vnd.pagerduty+json;version=2'},sources:['https://docs.pagerduty.com/developer/api/reference/rest/incidents','https://developer.pagerduty.com/api-reference/'],scopes:'REST API token with incident/service/user read permissions; incident write and From user email for incident changes/notes. This is REST management, not the separate Events API routing-key transport.',description:'Incident observation, acknowledgements, resolutions and service ownership.',types:[
  typed('incident','PagerDuty Incident',{id:s,type:s,incident_number:n,title:s,status:s,urgency:s,html_url:s,service:json,assignments:{type:'array',items:json}},{id:'PABC123',type:'incident',incident_number:1,title:'Synthetic build incident',status:'triggered',urgency:'low',html_url:'https://fixture.pagerduty.com/incidents/PABC123',service:{id:'PSVC123',type:'service_reference'},assignments:[]}),
  typed('service','PagerDuty Service',{id:s,type:s,name:s,status:s,description:nullable(s),html_url:s},{id:'PSVC123',type:'service',name:'Fixture CI',status:'active',description:null,html_url:'https://fixture.pagerduty.com/service-directory/PSVC123'}),
  typed('user','PagerDuty User',{id:s,type:s,name:s,email:s,role:s,time_zone:s},{id:'PUSER12',type:'user',name:'Fixture User',email:'user@example.com',role:'user',time_zone:'Etc/UTC'}),
  typed('note','PagerDuty Note',{id:s,content:s,created_at:s,user:json},{id:'PNOTE12',content:'Synthetic handoff',created_at:'2026-10-22T00:00:00Z',user:{id:'PUSER12',type:'user_reference'}}),
]});
const offsetInputs={offset:number()},offsetQuery={limit:100,offset:input('offset',true)};
pd.add('list-incidents','List Incidents','/incidents','incident',{list:true,responsePath:['incidents'],paging:{kind:'offset',parameter:'offset',sizeParameter:'limit',size:100,morePath:['more']},inputs:{...offsetInputs,since:text(),until:text()},query:{...offsetQuery,since:input('since',true),until:input('until',true)},description:'Read bounded incident pages with offset/limit/more continuation; select since/until deliberately.'});
pd.add('get-incident','Get Incident','/incidents/{incidentId}','incident',{responsePath:['incident']});
for(const [key,name,status] of [['acknowledge-incident','Acknowledge Incident','acknowledged'],['resolve-incident','Resolve Incident','resolved']])pd.add(key,name,'/incidents/{incidentId}','incident',{method:'PUT',responsePath:['incident'],inputs:{from:text(true)},headers:{From:input('from')},body:{incident:{type:'incident_reference',status}},sampleInputs:{from:'user@example.com'}});
pd.add('create-incident','Create Incident','/incidents','incident',{method:'POST',responsePath:['incident'],inputs:{title:text(true),serviceId:text(true),from:text(true)},headers:{From:input('from')},body:{incident:{type:'incident',title:input('title'),service:{id:input('serviceId'),type:'service_reference'},urgency:'low'}},sampleInputs:{title:'Synthetic build incident',from:'user@example.com'}});
pd.add('list-notes','List Incident Notes','/incidents/{incidentId}/notes','note',{list:true,responsePath:['notes']});
pd.add('create-note','Create Incident Note','/incidents/{incidentId}/notes','note',{method:'POST',responsePath:['note'],inputs:{content:text(true),from:text(true)},headers:{From:input('from')},body:{note:{content:input('content')}},sampleInputs:{content:'Synthetic handoff',from:'user@example.com'}});
pd.add('update-note','Update Incident Note','/incidents/{incidentId}/notes/{id}','note',{method:'PUT',responsePath:['note'],inputs:{content:text(true),from:text(true)},headers:{From:input('from')},body:{note:{content:input('content')}},sampleInputs:{content:'Updated synthetic handoff',from:'user@example.com'}});
pd.add('list-services','List Services','/services','service',{list:true,responsePath:['services'],paging:{kind:'offset',parameter:'offset',sizeParameter:'limit',size:100,morePath:['more']},inputs:offsetInputs,query:offsetQuery});
pd.add('get-service','Get Service','/services/{serviceId}','service',{responsePath:['service']});
pd.add('list-users','List Users','/users','user',{list:true,responsePath:['users'],paging:{kind:'offset',parameter:'offset',sizeParameter:'limit',size:100,morePath:['more']},inputs:offsetInputs,query:offsetQuery});
pd.add('get-user','Get User','/users/{userId}','user',{responsePath:['user'],sampleInputs:{userId:'PUSER12'}});

export const families=[gh.f,gl.f,gt.f,jira.f,cf.f,slack.f,discord.f,notion.f,sentry.f,pd.f];

// Attach exact operation-group references and provider-specific contract caveats.
for(const operation of gh.f.operations)operation.source=githubSource+'/'+(operation.path.includes('/actions/')?'actions/workflow-runs':operation.path.includes('/pulls')?'pulls/pulls':operation.path.includes('comments')?'issues/comments':operation.path.includes('/issues')?'issues/issues':'repos/repos');
for(const operation of gl.f.operations)operation.source='https://docs.gitlab.com/api/'+(operation.path.includes('merge_requests')?'merge_requests':operation.path.includes('/issues')?'issues':operation.path.includes('/jobs')?'jobs':operation.path.includes('/pipeline')?'pipelines':'projects')+'/';
for(const operation of jira.f.operations)operation.source='https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-'+(operation.path.includes('/search/')?'issue-search':operation.path.includes('/project')?'projects':operation.path.includes('/comment')?'issue-comments':'issues')+'/';
for(const operation of cf.f.operations)operation.source='https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-'+(operation.path.includes('comment')?'comment':operation.key.includes('space')&&!operation.key.includes('pages')?'space':'page')+'/';
for(const operation of slack.f.operations)operation.source='https://docs.slack.dev/reference/methods/'+operation.path.split('/').at(-1)+'/';
slack.f.operations.find(operation=>operation.key==='thread-replies').description='Read a bounded thread. Bot tokens support DM/MPIM replies; public/private channel replies require an authorized user token with matching history scopes, selected through tokenSecret/connection credentials.';
const notionRefs={'get-page':'retrieve-a-page','search-pages':'post-search','query-data-source':'query-a-data-source','create-page':'post-page','update-page-properties':'patch-page','archive-page':'patch-page','get-block':'retrieve-a-block','list-block-children':'get-blocks-id-children','append-paragraph':'patch-blocks-id-children','delete-block':'delete-a-block','list-users':'get-users','get-user':'retrieve-a-user','get-data-source':'retrieve-a-data-source','search-data-sources':'post-search'};
for(const operation of notion.f.operations)operation.source='https://developers.notion.com/reference/'+notionRefs[operation.key];
for(const type of notion.f.types)delete type.schema.properties.archived;
for(const operation of notion.f.operations){const prune=value=>{if(!value||typeof value!=='object')return;delete value.archived;for(const item of Object.values(value))prune(item);};prune(operation.sampleResponse);}
for(const operation of pd.f.operations)if(operation.path.includes('/notes'))operation.source='https://docs.pagerduty.com/developer/api/reference/rest/incidents/'+({'list-notes':'list-incident-notes','create-note':'create-incident-note','update-note':'update-incident-note'}[operation.key]);
for(const operation of gh.f.operations)if(operation.inputs.id)operation.inputs.id.description=operation.path.includes('/issues/')?'Repository issue number (also used for a pull request issue), not the global resource ID.':operation.path.includes('/pulls/')?'Repository pull request number, not the global resource ID.':'Numeric workflow-run ID.';
for(const operation of gl.f.operations){
  if(operation.inputs.projectId)operation.inputs.projectId.description='Numeric project ID or unescaped namespace/project path; encoded as one URL segment.';
  if(operation.inputs.id)operation.inputs.id.description=operation.path.includes('/issues/')?'Project-scoped issue IID; not global issue ID.':operation.path.includes('/merge_requests/')?'Project-scoped merge request IID; not global merge request ID.':'Numeric pipeline/job ID.';
}
for(const operation of discord.f.operations)if(operation.inputs.content)operation.inputs.content.schema={type:'string',minLength:1,maxLength:2000};
for(const operation of slack.f.operations)if(operation.inputs.text)operation.inputs.text.schema={type:'string',minLength:1,maxLength:4000};
notion.f.operations.find(operation=>operation.key==='append-paragraph').inputs.text.schema={type:'string',minLength:1,maxLength:2000};
cf.f.operations.find(operation=>operation.key==='update-page').inputs.version.schema={type:'integer',minimum:1};
