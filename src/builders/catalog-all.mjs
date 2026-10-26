import {buildCatalog as core} from './core/catalog.mjs';
import {buildIO} from './core/io.mjs';
import {buildCatalog as teamsHubspot} from './teams-hubspot/catalog.mjs';
import {buildCatalog as xero} from './xero/catalog.mjs';
import {buildCatalog as google} from './google/catalog.mjs';
import {buildSubflows} from './subflows.mjs';
import {buildCatalog as websocket} from './websocket/catalog.mjs';
import {hardenCatalog} from './library-quality.mjs';
import {buildCatalog as logic} from './logic/catalog.mjs';
import {buildUtilities} from './logic/utilities.mjs';
export function buildAll(){const base=[...core(),...buildIO(),...teamsHubspot(),...xero(),...google(),...websocket(),...logic(),...buildUtilities()].map(item=>{
 const x=structuredClone(item),d=x.definition;d.inputs??=[];d.outputs??=[];
 x.tags=[...new Set([...x.tags,'library-expansion',...(x.key.includes('.codec.')?['codec']:[])])].sort();
 if(d.kind==='node'){
  if(!d.inputs.some(p=>p.id==='exec'))d.inputs.unshift({id:'exec',name:'Execute',type:'control'});
  if(!d.outputs.some(p=>p.id==='next'))d.outputs.unshift({id:'next',name:'Next',type:'control'});
  if(!d.outputs.some(p=>p.id==='error'))d.outputs.push({id:'error',name:'On error',type:'control'});
 }
 return x;
});return hardenCatalog([...base,...buildSubflows(base)]);}
export function resolveDefinition(definition,registry){
 const d=structuredClone(definition);
 d.inputs??=[];d.outputs??=[];d.code??='';d.description??='';d.category??='Custom';d.color??='#58afa6';
 const resolve=key=>{const r=registry[key];if(!r)throw new Error('Unresolved dependency '+key);return r;};
 for(const p of [...d.inputs,...d.outputs])if(p.type.startsWith('@')){const r=resolve(p.type.slice(1));p.type=r.id;p.typeVersion=r.version;}
 if(d.executorId?.startsWith('@')){const r=resolve(d.executorId.slice(1));d.executorId=r.id;d.executorVersion=r.version;}
 if(d.subflow)for(const node of d.subflow.nodes)if(node.definitionId.startsWith('@')){const r=resolve(node.definitionId.slice(1));node.definitionId=r.id;node.definitionVersion=r.version;}
 return d;
}
