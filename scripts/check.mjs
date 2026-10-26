import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
const catalog=JSON.parse(readFileSync(new URL('onf-packages.json',root),'utf8'));
assert.equal(catalog.schemaVersion,1);assert.ok(Array.isArray(catalog.packages));
const identities=new Set();
for(const item of catalog.packages) {
  assert.match(item.path,/^packages\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.json$/);
  assert.ok(!item.path.split('/').some(part=>part==='.' || part==='..'));
  const pin=`${item.id}@${item.version}`;assert.ok(!identities.has(pin),'Duplicate package pin');identities.add(pin);
  const bytes=readFileSync(new URL(item.path,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,'SHA256 mismatch');
  const manifest=JSON.parse(bytes.toString('utf8'));
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.id,item.id);assert.equal(manifest.version,item.version);
  assert.ok(manifest.definitions.length);assert.ok(manifest.permissions.description);
  for(const definition of manifest.definitions) {
    assert.ok(Number.isInteger(definition.version)&&definition.version>0);
    assert.ok(definition.documentation?.length,'Every public asset needs documentation');
    assert.equal(definition.builtin,false,'Package definitions are explicitly installed assets');
    if(item.id==='onf.core'||item.id==='onf.runtime')assert.ok(!/context\.secrets\.get\(|\bfetch\s*\(|\brequire\s*\(|\bimport\s*\(/.test(definition.code),'Core/runtime package has no provider calls');
  }
  console.log(`${pin}: ${manifest.definitions.length} definitions; digest, identity and documentation checks passed`);
}
