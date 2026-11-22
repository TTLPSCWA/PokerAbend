import { parseSwitch } from '../features.js';
import { spielhalleEngine } from './spielhalle.js';
import { studioEngine } from './studio.js';
import { factoryEngine } from './factory.js';

// A registered game must also be explicitly enabled on this server.
export const idleEngines = Object.freeze([
  ...(parseSwitch(process.env.IDLE_SPIELHALLE_ENABLED) === true ? [spielhalleEngine] : []),
  ...(parseSwitch(process.env.IDLE_STUDIO_ENABLED) === true ? [studioEngine] : []),
  ...(parseSwitch(process.env.IDLE_FACTORY_ENABLED) === true ? [factoryEngine] : []),
]);
