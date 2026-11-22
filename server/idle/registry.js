import { parseSwitch } from '../features.js';
import { spielhalleEngine } from './spielhalle.js';

// A registered game must also be explicitly enabled on this server.
export const idleEngines = Object.freeze(parseSwitch(process.env.IDLE_SPIELHALLE_ENABLED) === true ? [spielhalleEngine] : []);
