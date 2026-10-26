// Current discovery policy around the frozen developer release. No IO or publication.
import {buildCatalog} from '../developer-packs-20261022/catalog.mjs';

export function mapPackId(id) {
  return typeof id === 'string' && id.startsWith('pack_azure_') && id !== 'pack_azure_devops'
    ? 'pack_azure'
    : id;
}

export function buildCurrentDeveloperCatalog(options) {
  const catalog = buildCatalog(options);
  const azure = catalog.packs.find(pack => pack.id === 'pack_azure')
    ?? catalog.packs.find(pack => mapPackId(pack.id) === 'pack_azure');
  const seen = new Set();
  const packs = [];
  for (const pack of catalog.packs) {
    const id = mapPackId(pack.id);
    if (seen.has(id)) continue;
    seen.add(id);
    packs.push(id === 'pack_azure'
      ? {...azure, id, name: 'Azure', description: 'Azure cloud management and service integrations.'}
      : id === 'pack_azure_devops'
        ? {...pack, name: 'DevOps'}
        : pack);
  }
  return {
    ...catalog,
    rows: catalog.rows.map(row => {
      const packId = mapPackId(row.packId);
      return packId === row.packId ? row : {...row, packId};
    }),
    packs,
  };
}
