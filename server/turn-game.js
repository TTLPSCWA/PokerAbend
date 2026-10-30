import { turnEvents } from './turn-room.js';
import { VARIANTS, variantOf } from '../games/variants.js';

// Gemeinsame Plattform-Anbindung; Regeln und Eingabeprüfung bleiben im Spielmodul.
export function turnGame(Room, { events, variantRooms = {}, implementedVariants = [], ...info }) {
  const enabled = (v) => v.id === 'classic' || variantRooms[v.id] || implementedVariants.includes(v.id);
  const type = (settings = {}) => { const v = variantOf(info.id, settings?.variant); if (!enabled(v)) throw new Error('Diese Variante ist noch nicht verfügbar'); return { Type: variantRooms[v.id] || Room, v }; };
  return {
    createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet die Runde.',
    ...info,
    variants: VARIANTS[info.id]?.filter(enabled).map((v) => ({ minPlayers: info.minPlayers, maxPlayers: info.maxPlayers, duration: info.duration, ...v, options: (variantRooms[v.id] || Room).OPTIONS || [] })),
    create: (code, settings = {}, onChange) => { const { Type, v } = type(settings); const r = new Type(code, { ...settings, variant: v.id }, onChange); r.variantLabel = v.name; if (v.minPlayers) r.opts.minPlayers = v.minPlayers; if (v.maxPlayers) r.opts.maxPlayers = v.maxPlayers; return r; },
    restore: (data, onChange) => { const settings = { ...data.settings, variant: data.variant || 'classic' }, { Type, v } = type(settings); const r = Type.restore({ ...data, settings }, onChange); r.variantLabel = v.name; if (v.minPlayers) r.opts.minPlayers = v.minPlayers; if (v.maxPlayers) r.opts.maxPlayers = v.maxPlayers; return r; },
    options: Room.OPTIONS,
    events: { ...turnEvents, ...events },
  };
}
