// Kleine, überprüfbare Vektorzeichnungen statt hochgeladener Bilder oder HTML.
export const COLORS = ['#172b25', '#df493d', '#e8aa32', '#358856', '#368ad4', '#8954ba', '#ffffff'];
export const MAX_STROKES = 60;
export const MAX_POINTS = 800;
export function cleanDrawing(value) {
  if (!Array.isArray(value) || value.length > MAX_STROKES) throw new Error('Höchstens 60 Striche pro Bild');
  let count = 0;
  return value.map((stroke) => {
    if (!stroke || !COLORS.includes(stroke.color) || ![3, 8, 18, 36].includes(stroke.size) || !Array.isArray(stroke.points) || !stroke.points.length || stroke.points.length > 100) throw new Error('Ungültiger Zeichenstrich');
    count += stroke.points.length;
    if (count > MAX_POINTS) throw new Error('Das Bild ist voll; nutze Rückgängig oder weniger Striche');
    const points = stroke.points.map((p) => {
      if (!Array.isArray(p) || p.length !== 2 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 1000)) throw new Error('Ungültiger Zeichenpunkt');
      return [...p];
    });
    return { color: stroke.color, size: stroke.size, points };
  });
}
export const WORDS = ['Regenschirm', 'Schneemann', 'Fahrrad', 'Kaktus', 'Leuchtturm', 'Schmetterling', 'Zahnbürste', 'Rakete', 'Schloss', 'Elefant', 'Gitarre', 'Schatzkarte', 'Pinguin', 'Wasserkocher', 'Roboter', 'Feuerwehr', 'Segelboot', 'Sonnenblume', 'Käse', 'Schlüssel', 'Drachen', 'Heißluftballon', 'Vulkan', 'Eisbecher', 'Schildkröte', 'Kopfhörer', 'Baumhaus', 'Krone', 'Waschmaschine', 'Spinnennetz', 'Bücherregal', 'U-Boot', 'Windmühle', 'Würfel', 'Ananas', 'Seestern', 'Taschenlampe', 'Gießkanne', 'Schaukel', 'Briefkasten'];
export const wordKey = (text) => String(text).toLocaleLowerCase('de').replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss').replace(/[^a-z0-9]/g, '');
