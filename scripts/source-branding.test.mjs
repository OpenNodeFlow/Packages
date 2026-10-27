import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);

test('source branding and default display names stay separate from immutable releases', () => {
  const source = JSON.parse(readFileSync(new URL('onf-source.json', root)));
  assert.equal(source.schemaVersion, 1);
  assert.equal(source.displayName, 'OpenNodeFlow Packages');
  assert.equal(source.website, 'https://github.com/OpenNodeFlow/Packages');
  for (const kind of ['logo', 'banner']) {
    assert.equal(source[kind], `${kind}.png`);
    const bytes = readFileSync(new URL(source[kind], root));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert(bytes.length < 1024 * 1024);
  }
  const catalog = JSON.parse(readFileSync(new URL('onf-packages.json', root)));
  for (const [id, name] of [['core', 'Core'], ['runtime', 'Runtime'], ['logic', 'Logic'], ['utilities', 'Utilities'], ['types', 'Shared Types']]) {
    const entry = catalog.packages.find((entry) => entry.id === `onf.${id}` && entry.config);
    assert(entry);
    const config = JSON.parse(readFileSync(new URL(entry.config, root)));
    assert.equal(config.displayName, `OpenNodeFlow ${name}`);
    assert.equal(config.defaultPackage, true);
  }
});
