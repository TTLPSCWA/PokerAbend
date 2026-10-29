import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cleanText } from '../../server/security.js';
import { BOARD, PROPERTIES } from '../../public/games/monopoly/data.js';

export function createBoardStore(dir = null) {
  const file = dir ? join(dir, 'monopoly-boards.json') : null;
  let boards = [];
  if (file && existsSync(file)) {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(data.boards) || data.boards.length > 20) throw new Error('Ungültige Monopoly-Brettdatei');
    boards = data.boards.map((b) => validate(b, b.id));
    if (new Set(boards.map((b) => b.id)).size !== boards.length) throw new Error('Doppelte Brett-ID');
  }
  function validate(input, id) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,50}$/.test(id)) throw new Error('Ungültige Brett-ID');
    const title = cleanText(input?.title, 60);
    if (!title || !Array.isArray(input.names) || input.names.length !== PROPERTIES.length) throw new Error('Titel und 28 Grundstücksnamen angeben');
    const names = input.names.map((n) => cleanText(n, 40));
    if (names.some((n) => !n)) throw new Error('Alle Grundstücke brauchen einen Namen');
    return { id, title, names };
  }
  const list = () => [{ id: 'default', title: 'Spieleabend-Stadt', names: PROPERTIES.map((i) => BOARD[i].name) }, ...structuredClone(boards)];
  return {
    list,
    get(id = 'default') { const b = list().find((b) => b.id === id); if (!b) throw new Error('Brett nicht gefunden'); return b; },
    save(input) {
      if (boards.length >= 20) throw new Error('Höchstens 20 eigene Bretter');
      const b = validate(input, randomUUID()), next = [...boards, b];
      if (file) { mkdirSync(dir, { recursive: true }); const temp = file + '.tmp'; writeFileSync(temp, JSON.stringify({ version: 1, boards: next }, null, 2), { mode: 0o600 }); renameSync(temp, file); }
      boards = next; return structuredClone(b);
    },
  };
}
let store = createBoardStore();
export const boardStore = () => store;
export const configureBoards = (dir) => {
  try { store = createBoardStore(dir); }
  catch (error) {
    console.error('Eigene Monopoly-Bretter konnten nicht geladen werden:', error.message);
    const fallback = createBoardStore();
    store = { ...fallback, save() { throw new Error('Die Brettdatei kann nicht gelesen werden. Sie bleibt erhalten; eigene Bretter sind vorübergehend schreibgeschützt.'); } };
  }
};
