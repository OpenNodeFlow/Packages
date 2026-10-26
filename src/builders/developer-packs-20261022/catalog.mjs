import {families as cloud} from './cloud.mjs';
import {families as infrastructure} from './infrastructure.mjs';
import {families as collaboration} from './collaboration.mjs';
import {buildDeveloperCatalog} from './builder.mjs';
export const families=[...cloud,...infrastructure,...collaboration];
export const buildCatalog=options=>buildDeveloperCatalog(families,options);
