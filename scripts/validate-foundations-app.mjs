import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const defaultsOnly=process.argv[4]==='--defaults';
if(process.argv[2]!=='--app'||!process.argv[3]||(process.argv.length!==4&&!defaultsOnly)||process.argv.length>5)throw Error('Usage: node --import <v2 tsx loader> scripts/validate-foundations-app.mjs --app <v2 checkout> [--defaults]');
const app=pathToFileURL(resolve(process.argv[3])+'/');
const pkg=JSON.parse(readFileSync(new URL('package.json',app)));assert(pkg.version.startsWith('2.')&&pkg.name==='@opennodeflow/app');
process.env.ONF_DATA_DIR=mkdtempSync(join(tmpdir(),'onf-public-foundations-'));
const {PackageService}=await import(new URL('server/packages.ts',app));
const {PackageGitTransport}=await import(new URL('server/packages-git.ts',app));
const store=await import(new URL('server/store.ts',app));
const {assetDiagnostics}=await import(new URL('server/asset-authoring.ts',app));
try{
 const catalog=JSON.parse(readFileSync(new URL('onf-packages.json',root)));
 const files=new Map(catalog.packages.map(e=>[e.path,readFileSync(new URL(e.path,root))]));
 for(const e of catalog.packages)if(e.config){files.set(e.config,readFileSync(new URL(e.config,root)));const config=JSON.parse(files.get(e.config));for(const key of ['logo','banner'])files.set(e.config.replace(/[^/]+$/,config[key]),readFileSync(new URL(config[key],new URL(e.config,root))));}
 const commit='c'.repeat(40);const transport=new PackageGitTransport(async input=>{const url=String(input);if(url.includes('api.github.com'))return new Response(commit);if(url.endsWith('onf-packages.json'))return new Response(JSON.stringify(catalog));const path=url.split('/'+commit+'/')[1];return files.has(path)?new Response(files.get(path)):new Response('Missing',{status:404});});
 const service=new PackageService(transport);let source=service.createSource({name:'Synthetic foundations',repository:'https://github.com/example/foundations'});source=await service.refresh(source.id,source.revision);source=service.updateSource(source.id,{expectedRevision:source.revision,trust:'trusted'});
 const installed=new Map();let retained=[];
 const selected=defaultsOnly?catalog.packages.filter(e=>e.version==='2.2.0'&&['onf.core','onf.runtime','onf.types','onf.utilities','onf.logic'].includes(e.id)).reverse():catalog.packages;
 for(const [index,e]of selected.entries()){
   if(index===70)retained=store.all('definition').map(d=>JSON.stringify(d));
   const identity={sourceId:source.id,sourceRevision:source.revision,commit,packageId:e.id,version:e.version,sha256:e.sha256};const preview=await service.read(identity);
   const installation=await service.install({...identity,acceptExecutableCode:true,expectedInstallationRevision:installed.get(e.id)||0,expectedDefinitionVersions:preview.expectedDefinitionVersions,impactToken:preview.impact.impactToken,confirmBreaking:true,organizationToken:preview.organizationToken});installed.set(e.id,installation.revision);
   console.log(e.id+'@'+e.version+' installed');
 }
 for(const text of retained){const d=JSON.parse(text);assert.equal(JSON.stringify(store.one('definition',d.id,d.version)),text);}
 const issues=assetDiagnostics(store.all('definition'),[]);assert.deepEqual(issues,[]);
 assert.equal(store.all('workflow').length,0);assert.equal(store.all('run').length,0);
 const old=catalog.packages.find(e=>e.id==='onf.core'&&e.version==='2.0.0');
 await assert.rejects(service.read({sourceId:source.id,sourceRevision:source.revision,commit,packageId:old.id,version:old.version,sha256:old.sha256}),/conflict/i,'An old release must not reverse current library organization');
 const evidence={schemaVersion:1,date:'2026-10-27',method:'Actual v2 PackageService preview and atomic install with mocked Git in fresh temporary SQLite; '+(defaultsOnly?'five defaults in reverse order':'all retained releases then foundations'),packageReleases:selected.length,distinctDefinitions:store.all('definition').length,currentAssets:store.latestDefinitions().length,retainedDefinitions:retained.length,currentAssetIssues:issues.length,oldOrganizationRollbackRejected:true,workflows:0,nodeBodiesExecuted:0,liveProviderCalls:0,packages:selected.filter(e=>e.version==='2.2.0')};
 writeFileSync(new URL(defaultsOnly?'VALIDATION-DEFAULTS.json':'VALIDATION-FOUNDATIONS.json',root),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({...evidence,packages:undefined}));
}finally{store.db.close();const dir=resolve(process.env.ONF_DATA_DIR);assert(relative(resolve(tmpdir()),dir).startsWith('onf-public-foundations-')&&!relative(resolve(tmpdir()),dir).includes('..'));rmSync(dir,{recursive:true,force:true});}
