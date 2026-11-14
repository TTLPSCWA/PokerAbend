// Schiffe versenken: auswählbare Designs (Skins). Ein Skin ändert nur das Aussehen – Regeln, Flotten und Varianten (classic, salvo)
// bleiben unberührt. Der Host wählt ihn beim Erstellen des Raums; er steht als Einstellung `skin` im Raum und gilt für alle am Tisch.
// Die Skin-ID ist keine Spielvariante (die liegt in games/variants.js) und kein Geheimnis.
export const DEFAULT_SKIN = 'naval';

export const SKINS = [
  { id: 'naval', name: 'Klassisch', description: 'Dunkle Seekarte mit Schiffen von oben: Wasser mit Raster, Treffer als Stern, versenkte Schiffe als Wrack.', preview: '/games/schiffe/art/preview-naval.webp' },
  { id: 'space', name: 'Taktik-Konsole', description: 'Dunkle Weltraum-Konsole: Sektoren mit Radarringen, Raumschiffe von oben, Treffer glühen bernsteinfarben, versenkte Schiffe als rotes Wrack.', preview: '/games/schiffe/art/preview-space.webp' },
];

export const skinIds = () => SKINS.map((s) => s.id);
// Unbekannte oder manipulierte Werte ergeben immer das Standarddesign
export const safeSkin = (id) => (SKINS.some((s) => s.id === id) ? id : DEFAULT_SKIN);
