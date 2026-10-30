const svg = (body) => `<svg viewBox="0 0 40 40" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">${body}</svg>`;
export const TOKENS = {
  hat: { name: 'Zylinder', art: svg('<path d="M11 28l2-19h14l2 19z"/><ellipse cx="20" cy="29" rx="16" ry="4"/><path d="M13 22h14" stroke="white"/>') },
  car: { name: 'Auto', art: svg('<path d="M5 26v-8l7-2 5-8h12l5 10 3 3v5z"/><path d="M18 11h9l3 6H14z" fill="white"/><circle cx="11" cy="28" r="5"/><circle cx="30" cy="28" r="5"/>') },
  dog: { name: 'Hund', art: svg('<path d="M9 33V19l-5-8 7 3 4-8 9 2 3 11 7 3-2 11h-6l-1-8-8-1-2 9z"/><circle cx="20" cy="12" r="1.4" fill="white"/>') },
  ship: { name: 'Schiff', art: svg('<path d="M4 27h32l-6 8H11zM21 4v21H7zM24 9l10 14H24z"/><path d="M3 38q5-4 10 0t10 0 13 0" fill="none"/>') },
  thimble: { name: 'Fingerhut', art: svg('<path d="M9 33l3-23q8-10 16 0l3 23z"/><path d="M14 16h2m5 0h2m-9 6h2m5 0h2m-9 6h2m5 0h2" stroke="white" stroke-width="2"/>') },
  barrow: { name: 'Schubkarre', art: svg('<path d="M8 11h28l-6 13H15zM15 24l-5 8M29 24l2 9M8 11 3 6" fill="none" stroke-width="3"/><circle cx="8" cy="32" r="5"/>') },
  shoe: { name: 'Schuh', art: svg('<path d="M8 7h12l2 12 13 7v7H5l1-14z"/><path d="M19 19l-6 3m9 0-6 3M6 30h29" stroke="white"/>') },
  cat: { name: 'Katze', art: svg('<path d="M12 33V20l-3-5 1-10 7 5h7l7-5 1 10-5 7 1 11z"/><path d="M27 32q15 3 8-9" fill="none" stroke-width="4"/><circle cx="16" cy="15" r="1" fill="white"/><circle cx="25" cy="15" r="1" fill="white"/>') },
};
export const CORNERS = {
  go: svg('<path d="M5 20h27l-9-8m9 8-9 8" fill="none" stroke-width="5"/>'),
  jail: svg('<rect x="6" y="4" width="28" height="32" fill="none"/><path d="M12 5v30m8-30v30m8-30v30" stroke-width="3"/>'),
  parking: TOKENS.car.art,
  gotojail: svg('<path d="M5 17 9 8q11-8 22 0l4 9-15 5zM10 23q10 10 20 0" fill="none" stroke-width="3"/><path d="m20 9 4 3-1 5h-6l-1-5z"/>'),
};
