// Spielpaletten (EXP-Spielpakete) bauen auf einer Weltpalette auf und ergänzen nur ihre eigenen Ereignisse.
export const extend = (base, { id, ambient = base.ambient, samples = {}, events = {} }) =>
  ({ id, ambient, samples: { ...base.samples, ...samples }, events: { ...base.events, ...events } });
