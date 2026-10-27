import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildStructuralCatalog } from '../src/builders/structural-overlay/catalog.mjs';
import { preparePackageReleases } from './package-releases.mjs';

export function structuralReleases(root = new URL('../', import.meta.url)) {
  const catalog = buildStructuralCatalog(root), { entries, metadata, packs } = catalog;
  const latest = new Map();
  for (const definition of entries.values()) if (!latest.has(definition.id) || latest.get(definition.id).version < definition.version) latest.set(definition.id, definition);
  const primitive = new Set(['any','string','number','boolean','object','array','control']);
  const graph = new Map();
  for (const [pin, definition] of entries) {
    const dependencies = new Set();
    function walk(value) {
      if (!value || typeof value !== 'object') return;
      for (const [field,version] of [['type','typeVersion'],['executorId','executorVersion'],['definitionId','definitionVersion'],['bodyDefinitionId','bodyDefinitionVersion']]) {
        if (typeof value[field] !== 'string' || primitive.has(value[field]) || (field === 'type' && !value.typeVersion)) continue;
        const dependency = value[field]+'@'+value[version];
        if (!entries.has(dependency)) throw new Error('Missing exact dependency '+dependency+' used by '+pin);
        dependencies.add(dependency);
      }
      for (const child of Object.values(value)) walk(child);
    }
    walk(definition); graph.set(pin, dependencies);
  }
  const releases = [];
  for (const pack of packs.filter(pack => !['onf.core','onf.runtime'].includes(pack.id))) {
    const selected = [...latest.values()].filter(definition => metadata.get(definition.id)?.packId === pack.id), closure = new Set();
    function include(pin) {
      if (closure.has(pin)) return;
      closure.add(pin);
      for (const dependency of graph.get(pin)) include(dependency);
      const pairId = metadata.get(entries.get(pin).id)?.codec?.pairId;
      if (pairId) { const pair = latest.get(pairId); if (!pair) throw new Error('Missing codec sister '+pairId); include(pair.id+'@'+pair.version); }
    }
    for (const definition of selected) include(definition.id+'@'+definition.version);
    const definitions = [...closure].sort().map(pin => entries.get(pin));
    const libraryMetadata = [...new Set(definitions.map(definition => definition.id))].map(id => metadata.get(id));
    const packIds = new Set(libraryMetadata.map(asset => asset.packId));
    const id = pack.id.startsWith('pack_') ? 'onf.'+pack.id.slice(5).replaceAll('_','-') : pack.id;
    const manifest = {schemaVersion:1,id,name:pack.name,version:'2.1.0',description:pack.description,
      permissions:{secrets:[],network:definitions.some(definition => /\bfetch\s*\(|\bWebSocket\b/.test(definition.code)),filesystem:definitions.some(definition => definition.runtime === 'python' || /node:fs|node:sqlite|\bopen\(/.test(definition.code)),description:'Provider operations may read or change external resources when deliberately executed. Review each asset and connection. Installation runs no code; declarations are advisory, not a sandbox.'},
      definitions,libraryPacks:packs.filter(entry => packIds.has(entry.id)),libraryFolders:[],libraryMetadata};
    // Compact large schema manifests to stay within the bounded app transport.
    const pretty = JSON.stringify(manifest,null,2)+'\n';
    const bytes = Buffer.byteLength(pretty) <= 8*1024*1024 ? pretty : JSON.stringify(manifest)+'\n';
    if (Buffer.byteLength(bytes) > 8*1024*1024 || definitions.length > 2000) throw new Error('Package exceeds bounded manifest contract '+id+' '+Buffer.byteLength(bytes)+' bytes / '+definitions.length+' definitions');
    if (/(?:onf\.lan|openclaw\.lan|polarmonitoring|AllanV3|TempIt|58dc89b7-5a26-4647-9f58-9bcbb9b1204c)/i.test(bytes)) throw new Error('Private context is forbidden in '+id);
    const path = `packages/${id.replaceAll('.','-')}/2.1.0.json`;
    releases.push({bytes,entry:{id,name:manifest.name,version:manifest.version,description:manifest.description,path,sha256:createHash('sha256').update(bytes).digest('hex')}});
  }
  return {...catalog, releases};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.slice(2).some(argument => argument !== '--check')) throw new Error('Only --check is supported; this source owns release 2.1.0');
  const root = new URL('../', import.meta.url), result = structuralReleases(root), plan = preparePackageReleases(fileURLToPath(root), result.releases);
  if (!process.argv.includes('--check')) plan.write({summary:{schemaVersion:1,ownedDefinitionCount:result.entries.size,structuralUpdates:result.updates.length,structuralAdditions:result.additions.length,groups:result.summary,historicalSourceBaseline:'Reviewed public structural source overlay 23 October 2026; private contexts excluded',excluded:['Office receiver policy and PR workflow controllers','Model routing and private model contexts','Runtime snapshots and publication journals','Live provider verification']}});
  console.log(JSON.stringify({addedReleases:plan.added,updates:result.updates.length,additions:result.additions.length,groups:result.summary,manifestBytes:result.releases.map(release=>({id:release.entry.id,bytes:Buffer.byteLength(release.bytes)}))}));
}
