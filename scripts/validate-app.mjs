import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {structuralReleases} from '../scripts/build-structural.mjs';
const root=new URL('../',import.meta.url),result=structuralReleases(root);
if(process.argv[2]!=='--app'||!process.argv[3]||process.argv.length!==4)throw Error('Usage: node --import <v2 tsx loader URL> scripts/validate-app.mjs --app <v2 checkout>');
const app=pathToFileURL(resolve(process.argv[3])+'/');
const appPackage=JSON.parse(readFileSync(new URL('package.json',app),'utf8'));
assert(appPackage.version.startsWith('2.')&&appPackage.name==='@opennodeflow/app','Only the v2 source checkout is accepted');
process.env.ONF_DATA_DIR=mkdtempSync(join(tmpdir(),'onf-public-structural-'));
const {PackageService}=await import(new URL('server/packages.ts',app));
const {PackageGitTransport}=await import(new URL('server/packages-git.ts',app));
const store=await import(new URL('server/store.ts',app));
const {assetDiagnostics}=await import(new URL('server/asset-authoring.ts',app));
try {
const baseline=JSON.parse(readFileSync(new URL('onf-packages.json',root),'utf8'));
const entries=[...baseline.packages.filter(e=>e.version==='2.0.0'),...result.releases.map(r=>r.entry)];
const files=new Map(entries.filter(e=>e.version==='2.0.0').map(e=>[e.path,readFileSync(new URL(e.path,root))]));
for(const r of result.releases)files.set(r.entry.path,Buffer.from(r.bytes));
const commit='c'.repeat(40);
const transport=new PackageGitTransport(async input=>{const url=String(input);if(url.includes('api.github.com'))return new Response(commit);if(url.endsWith('onf-packages.json'))return new Response(JSON.stringify({schemaVersion:1,packages:entries}));const path=url.split('/'+commit+'/')[1];assert(files.has(path),'Mock only serves reviewed public artifact');return new Response(files.get(path));});
const service=new PackageService(transport);let source=service.createSource({name:'Synthetic public package test',repository:'https://github.com/example/public-fixture'});source=await service.refresh(source.id,source.revision);source=service.updateSource(source.id,{expectedRevision:source.revision,trust:'trusted'});
const installed=new Map();let retained;
for(const [index,e] of entries.entries()){
 if(index===36)retained=store.all('definition').map(d=>JSON.stringify(d));
 const identity={sourceId:source.id,sourceRevision:source.revision,commit,packageId:e.id,version:e.version,sha256:e.sha256};
 const preview=await service.read(identity);const installation=await service.install({...identity,acceptExecutableCode:true,expectedInstallationRevision:installed.get(e.id)||0,expectedDefinitionVersions:preview.expectedDefinitionVersions,impactToken:preview.impact.impactToken,confirmBreaking:true});installed.set(e.id,installation.revision);
 console.log(JSON.stringify({id:e.id,release:e.version,definitions:preview.manifest.definitions.length}));
}
for(const text of retained){const d=JSON.parse(text);assert.equal(JSON.stringify(store.one('definition',d.id,d.version)),text);}
const baselineIssues=assetDiagnostics(retained.map(text=>JSON.parse(text)),[]);
const currentIssues=assetDiagnostics(store.all('definition'),[]);
assert.equal(baselineIssues.length,0);assert.equal(currentIssues.length,0,'Public catalog must introduce no current-asset interoperability errors');
assert.equal(store.all('workflow').length,0);assert.equal(store.all('run').length,0);
writeFileSync(new URL('VALIDATION-STRUCTURAL.json',root),JSON.stringify({schemaVersion:1,date:'2026-10-27',method:'Actual v2 PackageService preview and atomic install, mocked Git transport, fresh temporary SQLite; baseline then structural update',packageReleases:entries.length,distinctDefinitions:store.all('definition').length,currentAssets:store.latestDefinitions().length,retainedBaselineDefinitions:retained.length,workflows:0,nodeBodiesExecuted:0,liveProviderCalls:0,baselineAssetIssues:baselineIssues.length,currentAssetIssues:currentIssues.length,packages:result.releases.map(r=>r.entry)},null,2)+'\n');

} finally { store.db.close();const owned=resolve(process.env.ONF_DATA_DIR);assert(relative(resolve(tmpdir()),owned).startsWith('onf-public-structural-')&&!relative(resolve(tmpdir()),owned).includes('..'));rmSync(owned,{recursive:true,force:true}); }
