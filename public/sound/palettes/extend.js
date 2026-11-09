// Spielpaletten (EXP-Spielpakete) bauen auf einer Weltpalette auf und ergänzen nur ihre eigenen Ereignisse.
// `synth` nennt Ereignisse, die bewusst erzeugt bleiben, weil es dafür keine passende CC0-Aufnahme gibt (z. B. Hupe, Grummeln).
export const extend = (base, { id, ambient = base.ambient, samples = {}, events = {}, synth = [] }) =>
  ({ id, ambient, synth: [...(base.synth || []), ...synth], samples: { ...base.samples, ...samples }, events: { ...base.events, ...events } });
