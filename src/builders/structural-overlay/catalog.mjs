import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {preparePackageReleases} from '../../../scripts/package-releases.mjs';
import { buildChanges as collaboration } from './collaboration/changes.mjs';
import { buildChanges as cloud } from './cloud-infra/index.mjs';
import { buildChanges as devops } from './devops/index.mjs';

/** Reconstruct only the already-public source baseline. Never read installed app state. */
export function publicBaseline(root = new URL('../../../', import.meta.url)) {
  preparePackageReleases(fileURLToPath(root), []); // Reject corrupt or escaped historical inputs before reading the baseline.
  const catalog = JSON.parse(readFileSync(new URL('onf-packages.json', root), 'utf8'));
  const retained = new Map(), definitions = new Map(), assets = new Map(), packs = new Map();
  for (const entry of catalog.packages.filter(entry => entry.version === '2.0.0')) {
    const manifest = JSON.parse(readFileSync(new URL(entry.path, root), 'utf8'));
    for (const definition of manifest.definitions) {
      retained.set(definition.id+"@"+definition.version, definition);
      if (!definitions.has(definition.id) || definitions.get(definition.id).version < definition.version)
        definitions.set(definition.id, definition);
    }
    for (const asset of manifest.libraryMetadata || []) assets.set(asset.definitionId, asset);
    for (const pack of manifest.libraryPacks || []) packs.set(pack.id, pack);
  }
  return { retained: [...retained.values()], definitions: [...definitions.values()].map(definition => ({ ...definition, packId: assets.get(definition.id)?.packId })), library: { assets: [...assets.values()] }, packs: [...packs.values()] };
}
export const builders = { collaboration, cloud, devops };

const stamp = '2026-10-27T00:00:00.000Z';
export function buildStructuralCatalog(root) {
  const snapshot = publicBaseline(root), results = Object.entries(builders).map(([name, build]) => ({name, ...build(snapshot)}));
  const updates = new Map(), additions = new Map(), registry = {};
  for (const result of results) {
    for (const update of result.updates) {
      assert(!updates.has(update.id), 'Overlapping update '+update.id);
      const before = snapshot.definitions.find(definition => definition.id === update.id);
      assert.equal(update.expectedVersion, before?.version, 'Base revision mismatch '+update.id);
      updates.set(update.id, structuredClone(update));
    }
    for (const addition of result.additions) {
      assert(!additions.has(addition.key), 'Duplicate structural key '+addition.key);
      assert(snapshot.packs.some(pack => pack.id === addition.packId), 'Unknown pack '+addition.packId);
      additions.set(addition.key, structuredClone(addition));
      registry[addition.key] = {id: /^def_[a-f0-9]+$/.test(addition.key) ? addition.key : 'def_'+createHash('sha256').update('onf.public.structural.'+addition.key).digest('hex').slice(0,24), version: 1};
    }
  }
  const typeVersions = new Map([...updates.values()].filter(update => snapshot.definitions.find(definition => definition.id === update.id)?.kind === 'type').map(update => [update.id, update.expectedVersion+1]));
  for (const before of snapshot.definitions) {
    if (before.kind === 'type' || before.subflow || before.collection || before.repeat) continue;
    const explicit = updates.get(before.id), next = {...before, ...explicit?.patch}, patch = {...explicit?.patch};
    let changed = false;
    for (const direction of ['inputs','outputs']) patch[direction] = next[direction].map(port => {
      const version = typeVersions.get(port.type);
      if (!version || port.typeVersion === version) return port;
      changed = true; return {...port, typeVersion: version};
    });
    if (changed) updates.set(before.id, {id: before.id, expectedVersion: before.version, patch, reason: explicit?.reason || 'Use reviewed structural contracts.'});
  }
  function resolve(value) {
    const copy = structuredClone(value);
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      for (const [field,pin] of [['type','typeVersion'],['executorId','executorVersion'],['definitionId','definitionVersion'],['bodyDefinitionId','bodyDefinitionVersion']]) {
        if (typeof node[field] === 'string' && node[field].startsWith('@')) {
          const identity = registry[node[field].slice(1)]; assert(identity, 'Unresolved structural key '+node[field]);
          node[field] = identity.id; node[pin] = identity.version;
        } else if (field === 'type' && typeVersions.has(node[field]) && node[pin]) node[pin] = typeVersions.get(node[field]);
      }
      for (const child of Object.values(node)) walk(child);
    }
    walk(copy); return copy;
  }
  const entries = new Map(snapshot.retained.map(definition => [definition.id+'@'+definition.version, definition]));
  const metadata = new Map(snapshot.library.assets.map(asset => [asset.definitionId, asset]));
  for (const update of updates.values()) {
    const before = entries.get(update.id+'@'+update.expectedVersion);
    const after = {...before, ...resolve(update.patch), version: before.version+1, updatedAt: stamp};
    entries.set(after.id+'@'+after.version, after);
  }
  for (const addition of additions.values()) {
    const identity = registry[addition.key];
    assert(!snapshot.definitions.some(definition => definition.id === identity.id), 'New identity collision '+identity.id);
    const definition = { ...resolve(addition.definition), ...identity, createdAt:stamp, updatedAt:stamp, builtin:false };
    entries.set(definition.id+'@'+definition.version, definition);
    metadata.set(definition.id, {definitionId:definition.id,revision:1,tags:[...new Set((addition.tags || []).map(tag => tag.toLowerCase()))].sort().slice(0,20),packId:addition.packId, ...(addition.codec ? {codec:{mode:addition.codec.mode,name:addition.codec.name,pairId:registry[addition.codec.pairKey].id}} : {}),updatedAt:stamp});
  }
  return { entries, metadata, packs: snapshot.packs, registry, updates: [...updates.values()], additions: [...additions.values()], summary: results.map(result => ({group:result.name, explicitUpdates:result.updates.length, additions:result.additions.length, newTypes:result.additions.filter(row => row.definition.kind === 'type').length})) };
}
