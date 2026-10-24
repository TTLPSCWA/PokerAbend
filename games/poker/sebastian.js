// Easter Egg „Waiting for Sebastian“: Wer zählt als Sebastian?
// Liste einfach erweitern. Verglichen wird ohne Groß-/Kleinschreibung, Ziffern und Trennzeichen,
// also passen auch „Sebi123“, „Seb_01“ oder „Seb-Bones“ – „Sebastiano“ oder „Sebastian Müller“ nicht.
export const SEBASTIAN_NAMES = ['seb', 'sebi', 'sebbi', 'sebby', 'sebbones', 'sebastian'];

const normalize = (name) => String(name ?? '').trim().toLowerCase().replace(/[\s\d_.\-]+/g, '');

export function isSebastian(name) {
  return SEBASTIAN_NAMES.includes(normalize(name));
}
