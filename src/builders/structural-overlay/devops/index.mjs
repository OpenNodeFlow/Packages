import {contractRegistry} from './contracts.mjs';
import {correctOperationPaging} from './operations.mjs';

/** Public REST contracts only. Office service hooks, callback controllers and policies are excluded. */
export function buildChanges(snapshot) {
  const registry = contractRegistry(snapshot);
  const timeline = registry.current.get('def_bd7c1025652d');
  if (timeline) registry.change(timeline.id, { outputs: timeline.outputs.map(port => port.id === 'value' ? { ...port, ...registry.descriptor(registry.entries.get('devops.timeline')) } : port) }, 'Build Timeline returns the documented Timeline entity.');
  correctOperationPaging(registry, snapshot);
  const result = registry.finish();
  return { ...result, audit: snapshot.definitions.filter(definition => definition.packId === 'pack_azure_devops').map(definition => ({ id: definition.id, name: definition.name, verdict: result.updates.some(update => update.id === definition.id) ? 'corrected' : 'retained' })) };
}
