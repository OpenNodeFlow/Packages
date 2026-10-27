import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const identity=entry=>JSON.stringify([entry.id,entry.version]);
const safePath=path=>/^packages\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.json$/.test(path) && !path.split('/').some(part=>part==='.'||part==='..');
export function packageReleaseOptions(args) {
  let version='2.0.0',check=false,versionSeen=false;
  for(let index=0;index<args.length;index++) {
    if(args[index]==='--check'&&!check)check=true;
    else if(args[index]==='--version'&&!versionSeen){version=args[++index];versionSeen=true;}
    else throw new Error('Usage: build-integrations.mjs [--version X.Y.Z] [--check]');
  }
  assert.ok(typeof version==='string'&&/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version),'Invalid package release version');
  return {version,check};
}

/** Validate the entire generation before allowing any writes. Historical entries and files are immutable. */
export function preparePackageReleases(root,releases) {
  root=resolve(root);
  assert.ok(!lstatSync(root).isSymbolicLink(),'Package root must not be a symlink or junction');
  const originalRoot=realpathSync(root);
  function ownedPath(path) {
    assert.ok(!lstatSync(root).isSymbolicLink() && realpathSync(root)===originalRoot,'Package root changed');
    const local=relative(root,path);
    assert.ok(local && !isAbsolute(local) && local!=='..' && !local.startsWith('..'+sep),'Path escapes package root');
    let current=root;
    for(const part of local.split(sep)) {
      current=resolve(current,part);
      try {assert.ok(!lstatSync(current).isSymbolicLink(),'Package path contains a symlink or junction: '+current);}
      catch(error){if(error.code==='ENOENT')break;throw error;}
    }
    return path;
  }
  const catalogPath=resolve(root,'onf-packages.json');
  const catalogBytes=readFileSync(ownedPath(catalogPath)),catalog=JSON.parse(catalogBytes.toString('utf8'));
  assert.equal(catalog.schemaVersion,1);assert.ok(Array.isArray(catalog.packages));
  const snapshots=new Map([[catalogPath,catalogBytes]]),identities=new Map(),paths=new Set(),pins=new Map(),kinds=new Map();
  const load=path=>{const full=ownedPath(resolve(root,path));const bytes=readFileSync(full);snapshots.set(full,bytes);return bytes;};
  function inspect(entry,bytes) {
    assert.ok(safePath(entry.path),'Unsafe package path');
    assert.equal(digest(bytes),entry.sha256,'Package digest mismatch: '+entry.path);
    const manifest=JSON.parse(bytes.toString('utf8'));
    assert.equal(manifest.id,entry.id);assert.equal(manifest.version,entry.version);
    assert.ok(Array.isArray(manifest.definitions));
    for(const definition of manifest.definitions) {
      const pin=JSON.stringify([definition.id,definition.version]),content=JSON.stringify(definition);
      if(pins.has(pin))assert.equal(content,pins.get(pin),'Immutable definition changed: '+definition.id+'@'+definition.version);
      if(kinds.has(definition.id))assert.equal(definition.kind,kinds.get(definition.id),'Definition kind changed: '+definition.id);
      pins.set(pin,content);kinds.set(definition.id,definition.kind);
    }
  }
  for(const entry of catalog.packages) {
    assert.ok(safePath(entry.path),'Unsafe package path');
    assert.ok(!identities.has(identity(entry)),'Duplicate historical package release');
    assert.ok(!paths.has(entry.path),'Duplicate historical manifest path');
    inspect(entry,load(entry.path));identities.set(identity(entry),entry);paths.add(entry.path);
  }
  const additions=[],files=[],generated=new Set();
  for(const {entry,bytes:input} of releases) {
    const bytes=Buffer.from(input),key=identity(entry);
    assert.ok(!generated.has(key),'Duplicate generated release');generated.add(key);
    inspect(entry,bytes);
    const old=identities.get(key);
    if(old) {
      assert.deepEqual(entry,old,'Released catalog entry cannot change: '+entry.id+'@'+entry.version);
      assert.ok(bytes.equals(snapshots.get(resolve(root,old.path))),'Released manifest bytes cannot change: '+old.path);
      continue;
    }
    assert.ok(!paths.has(entry.path),'Manifest path belongs to another release');paths.add(entry.path);
    const destination=ownedPath(resolve(root,entry.path));
    if(existsSync(destination))assert.ok(bytes.equals(load(entry.path)),'Existing manifest bytes cannot change: '+entry.path);
    else files.push({path:destination,bytes});
    additions.push(entry);
  }
  const nextCatalog={...catalog,packages:[...catalog.packages,...additions]};
  assert.ok(nextCatalog.packages.length<=500,'Catalog exceeds application limit of 500 releases');
  assert.ok(Buffer.byteLength(JSON.stringify(nextCatalog,null,2)+'\n')<=512*1024,'Catalog exceeds application byte limit');
  return {
    added:additions.length,catalog:nextCatalog,
    write({summary,io={writeFileSync,renameSync}}={}) {
      if(!additions.length && summary===undefined)return;
      const lock=ownedPath(resolve(root,'.onf-package-build.lock'));
      writeFileSync(lock,'Package release build in progress\n',{flag:'wx'});
      let failure;
      function replace(path,bytes) {
        ownedPath(path);
        const temporary=ownedPath(path+'.next-'+randomUUID());
        let descriptor,created=false,writeFailure;
        try {
          descriptor=openSync(temporary,'wx');created=true;
          io.writeFileSync(descriptor,bytes);
          closeSync(descriptor);descriptor=undefined;
          ownedPath(path);io.renameSync(temporary,path);created=false;
        } catch(error){writeFailure=error;throw error;}
        finally {
          if(descriptor!==undefined)try{closeSync(descriptor);}catch(error){if(!writeFailure)throw error;}
          if(created)try{unlinkSync(temporary);}catch(error){if(!writeFailure)throw error;}
        }
      }
      try {
        for(const [path,bytes] of snapshots)assert.ok(readFileSync(ownedPath(path)).equals(bytes),'Package sources changed after preflight: '+path);
        for(const file of files)assert.ok(!existsSync(ownedPath(file.path)),'Manifest appeared after preflight: '+file.path);
        const summaryPath=summary===undefined?undefined:ownedPath(resolve(root,'CATALOG-SUMMARY.json'));
        // New files use exclusive creation. A failed write can leave only unreferenced
        // manifests; an identical rerun can recover them without changing their bytes.
        for(const file of files){mkdirSync(dirname(ownedPath(file.path)),{recursive:true});writeFileSync(ownedPath(file.path),file.bytes,{flag:'wx'});}
        if(additions.length)replace(catalogPath,JSON.stringify(nextCatalog,null,2)+'\n');
        // The summary is derived, non-authoritative metadata. Repair it even on
        // an otherwise identical rerun after a previous summary write failed.
        if(summaryPath) {
          const bytes=Buffer.from(JSON.stringify({...summary,packages:nextCatalog.packages.length},null,2)+'\n');
          if(!existsSync(summaryPath)||!readFileSync(summaryPath).equals(bytes))replace(summaryPath,bytes);
        }
      } catch(error){failure=error;throw error;}
      finally {
        try{unlinkSync(lock);}catch(error){if(!failure)throw error;}
      }
    },
  };
}
