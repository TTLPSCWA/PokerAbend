// Original vector previews, authored for PokerAbend. No external or licensed artwork.
export function unoPreview(id) {
  const palettes = { classic: ['#142e2b','#edc787','#df403e'], flip: ['#edf0e5','#8153af','#27b2ac'], 'no-mercy': ['#17191f','#fa7456','#d43648'], 'all-wild': ['#111b32','#b8a3ff','#45d8bc'], 'halloween-ghosthunt': ['#102824','#accb8a','#b197dc'] };
  const [bg, ink, accent] = palettes[id] || palettes.classic;
  const emblem = id === 'halloween-ghosthunt'
    ? '<path d="M39 50V36a11 11 0 0 1 22 0v14l-6-4-5 4-5-4z"/><circle cx="46" cy="35" r="1.5" fill="#132924"/><circle cx="54" cy="35" r="1.5" fill="#132924"/>'
    : id === 'flip' ? '<path d="M50 25a15 15 0 0 0 0 30z"/><path d="M50 25a15 15 0 0 1 0 30" fill="none" stroke="currentColor" stroke-width="3"/>'
    : id === 'no-mercy' ? '<path d="m44 25 15 15-15 15 7-15z"/><text x="50" y="47" text-anchor="middle" font-size="13" font-weight="800" fill="#15191e">+10</text>'
    : id === 'all-wild' ? '<path d="m50 23 5 11 12 5-12 5-5 12-5-12-12-5 12-5z"/>'
    : '<text x="50" y="51" text-anchor="middle" font-size="31" font-weight="800">7</text>';
  return `<svg viewBox="0 0 100 80" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="80" rx="12" fill="${bg}"/><circle cx="50" cy="40" r="30" fill="none" stroke="${ink}" opacity=".2"/><rect x="27" y="12" width="35" height="55" rx="5" fill="${accent}" opacity=".7" transform="rotate(-16 45 40)"/><rect x="34" y="13" width="34" height="55" rx="5" fill="${bg}" stroke="${ink}" transform="rotate(9 50 40)"/><g color="${ink}" fill="currentColor">${emblem}</g></svg>`;
}
