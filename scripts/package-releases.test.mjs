import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { packageReleaseOptions, preparePackageReleases } from './package-releases.mjs';

const definition={id:'fixture.node',kind:'node',version:1,code:'return {value:1};'};
function release(id='fixture',version='2.0.0',definitions=[definition]) {
  const bytes=JSON.stringify({schemaVersion:1,id,version,definitions})+'\n';
  return {bytes,entry:{id,name:id,version,description:'Synthetic fixture',path:`packages/${id}/${version}.json`,sha256:createHash('sha256').update(bytes).digest('hex')}};
}
function fixture(t,releases=[release()]) {
  const root=mkdtempSync(join(tmpdir(),'onf-package-release-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const item of releases){const path=join(root,item.entry.path);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,item.bytes);}
  // Deliberately use different formatting: a no-op must not rewrite catalog bytes.
  writeFileSync(join(root,'onf-packages.json'),JSON.stringify({schemaVersion:1,packages:releases.map(r=>r.entry)}));
  return root;
}

test('reproducing existing releases preserves every file and catalog byte',t=>{
  const original=release(),root=fixture(t,[original]);
  const before=readFileSync(join(root,'onf-packages.json'));
  const plan=preparePackageReleases(root,[original]);
  assert.equal(plan.added,0);plan.write();
  assert.deepEqual(readFileSync(join(root,'onf-packages.json')),before);
  assert.equal(readFileSync(join(root,original.entry.path),'utf8'),original.bytes);
  assert.equal(existsSync(join(root,'.onf-package-build.lock')),false);
});

test('late manifest conflict prevents all generated writes',t=>{
  const original=release(),root=fixture(t,[original]);
  const next=release('new-family','2.1.0');
  const changed=release('fixture','2.0.0',[{...definition,version:2}]);
  const before=readFileSync(join(root,'onf-packages.json'));
  assert.throws(()=>preparePackageReleases(root,[next,changed]),/Released catalog entry cannot change/);
  assert.equal(existsSync(join(root,next.entry.path)),false);
  assert.deepEqual(readFileSync(join(root,'onf-packages.json')),before);
  assert.equal(readFileSync(join(root,original.entry.path),'utf8'),original.bytes);
});

test('new package versions cannot replace an existing definition pin',t=>{
  const root=fixture(t);
  const changed=release('fixture','2.1.0',[{...definition,code:'return {value:2};'}]);
  assert.throws(()=>preparePackageReleases(root,[changed]),/Immutable definition changed/);
  assert.equal(existsSync(join(root,changed.entry.path)),false);
});

test('new versions append while retaining old and unrelated catalog releases',t=>{
  const old=release(),unrelated=release('separate-family'),root=fixture(t,[old,unrelated]);
  const next=release('fixture','2.1.0',[definition,{...definition,version:2,code:'return {value:2};'}]);
  const plan=preparePackageReleases(root,[next]);
  assert.equal(plan.added,1);
  assert.equal(existsSync(join(root,next.entry.path)),false,'Preflight performs no writes');
  plan.write();
  const catalog=JSON.parse(readFileSync(join(root,'onf-packages.json'),'utf8'));
  assert.deepEqual(catalog.packages,[old.entry,unrelated.entry,next.entry]);
  for(const item of [old,unrelated,next])assert.equal(readFileSync(join(root,item.entry.path),'utf8'),item.bytes);
  assert.equal(preparePackageReleases(root,[next]).added,0,'An identical rerun is a no-op');
});

test('stale preflight and corrupt historical digests fail before new files exist',t=>{
  const old=release(),root=fixture(t,[old]),next=release('fixture','2.1.0');
  const plan=preparePackageReleases(root,[next]);
  writeFileSync(join(root,old.entry.path),old.bytes+' ');
  assert.throws(()=>plan.write(),/changed after preflight/);
  assert.equal(existsSync(join(root,next.entry.path)),false);
  assert.equal(existsSync(join(root,'.onf-package-build.lock')),false);
  assert.throws(()=>preparePackageReleases(root,[next]),/digest mismatch/);
});

test('version selection is explicit and rejects malformed command arguments',()=>{
  assert.deepEqual(packageReleaseOptions([]),{version:'2.0.0',check:false});
  assert.deepEqual(packageReleaseOptions(['--version','2.1.0-alpha.1','--check']),{version:'2.1.0-alpha.1',check:true});
  for(const args of [['--version'],['--version','../../key'],['--version','1.0.0','--version','2.0.0'],['--overwrite']])assert.throws(()=>packageReleaseOptions(args));
});

for(const operation of ['write','rename'])test(`catalog ${operation} failure removes only owned temp files and permits retry`,t=>{
  const root=fixture(t),next=release('fixture','2.1.0'),catalogPath=join(root,'onf-packages.json');
  const original=readFileSync(catalogPath),failure=new Error('Injected '+operation+' failure');
  const retained=join(root,'onf-packages.json.next');writeFileSync(retained,'pre-existing unrelated file');
  const plan=preparePackageReleases(root,[next]);
  const io={
    writeFileSync:(fd,bytes)=>{if(operation==='write'){writeFileSync(fd,'partial');throw failure;}writeFileSync(fd,bytes);},
    renameSync:(from,to)=>{if(operation==='rename')throw failure;renameSync(from,to);},
  };
  assert.throws(()=>plan.write({io}),error=>error===failure,'Original failure is preserved');
  assert.deepEqual(readFileSync(catalogPath),original);
  assert.equal(readFileSync(retained,'utf8'),'pre-existing unrelated file');
  assert.equal(readdirSync(root).some(name=>name.includes('.next-')),false);
  assert.equal(existsSync(join(root,'.onf-package-build.lock')),false);
  assert.equal(readFileSync(join(root,next.entry.path),'utf8'),next.bytes,'Orphan release remains immutable');
  preparePackageReleases(root,[next]).write();
  assert.equal(JSON.parse(readFileSync(catalogPath)).packages.length,2);
});

test('failed derived-summary write is repaired on an identical zero-addition rerun',t=>{
  const root=fixture(t),next=release('fixture','2.1.0'),summaryPath=join(root,'CATALOG-SUMMARY.json');
  writeFileSync(summaryPath,JSON.stringify({packages:1}));
  const failure=new Error('Injected summary rename failure'),summary={schemaVersion:1,packages:99};
  assert.throws(()=>preparePackageReleases(root,[next]).write({summary,io:{writeFileSync,
    renameSync:(from,to)=>{if(to===summaryPath)throw failure;renameSync(from,to);}}}),error=>error===failure);
  assert.equal(JSON.parse(readFileSync(join(root,'onf-packages.json'))).packages.length,2);
  assert.equal(JSON.parse(readFileSync(summaryPath)).packages,1);
  assert.equal(readdirSync(root).some(name=>name.includes('.next-')),false);
  const retry=preparePackageReleases(root,[next]);assert.equal(retry.added,0);retry.write({summary});
  assert.equal(JSON.parse(readFileSync(summaryPath)).packages,2,'Count is derived from committed catalog');
});

test('a stale publisher cannot replace the current derived summary',t=>{
  const root=fixture(t),first=release('first'),second=release('second'),summary={schemaVersion:1};
  const firstPlan=preparePackageReleases(root,[first]),stalePlan=preparePackageReleases(root,[second]);
  firstPlan.write({summary});
  assert.throws(()=>stalePlan.write({summary}),/changed after preflight/);
  assert.equal(existsSync(join(root,second.entry.path)),false);
  assert.equal(JSON.parse(readFileSync(join(root,'CATALOG-SUMMARY.json'))).packages,2);
  preparePackageReleases(root,[second]).write({summary});
  assert.equal(JSON.parse(readFileSync(join(root,'CATALOG-SUMMARY.json'))).packages,3);
});

test('symlink or junction package directories cannot escape preflight or write boundaries',t=>{
  const root=fixture(t),external=mkdtempSync(join(tmpdir(),'onf-package-external-'));
  t.after(()=>rmSync(external,{recursive:true,force:true}));
  const link=join(root,'packages','escape'),next=release('escape'),before=readFileSync(join(root,'onf-packages.json'));
  try{symlinkSync(external,link,process.platform==='win32'?'junction':'dir');}
  catch(error){if(process.platform==='win32'&&['EPERM','EACCES'].includes(error.code)){t.skip('Windows denied link creation');return;}throw error;}
  assert.throws(()=>preparePackageReleases(root,[next]),/symlink or junction/);
  unlinkSync(link);
  const plan=preparePackageReleases(root,[next]);
  symlinkSync(external,link,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>plan.write(),/symlink or junction/);
  assert.deepEqual(readdirSync(external),[]);
  assert.deepEqual(readFileSync(join(root,'onf-packages.json')),before);
  unlinkSync(link);
});
