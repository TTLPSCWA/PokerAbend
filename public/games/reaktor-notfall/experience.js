// EXP-094 Reaktor-Notfall: Retro-Kontrollraum (fiktive Anlage) mit Kühlrohren, Temperatursäule und einem Zeigerinstrument je Person.
// Die Säule steigt mit der Überhitzungsuhr, die Rohre glühen rot, jeder eingetragene Code zischt als Kühlung, ein richtiger Code
// lässt eine Dampfwolke aufsteigen. Highlight: Gerettet bei 99 % – alle Instrumente fallen auf Grün, die Anlage seufzt.
// Geheimnisse: Es wird nur gezeigt, was ohnehin alle sehen (Uhr, Vorschläge, Ergebnis); eigene Hinweise bleiben, wo sie sind.
const t = (de, en) => (globalThis.I18n?.language === 'en' ? en : de);
/** Verbrauchte Zeit 0…1 (1 = überhitzt). */
export const heatOf = (g, elapsed = 0) => (g?.heatTotal ? Math.min(1, Math.max(0, 1 - Math.max(0, (g.heatMs || 0) - elapsed) / g.heatTotal)) : 0);
/** Alarmstufe nach Temperatur: unter 60 % still, dann drei Stufen. */
export const alarmLevel = (heat) => (heat >= 0.9 ? 3 : heat >= 0.75 ? 2 : heat >= 0.6 ? 1 : 0);
/** Rettung in letzter Sekunde: gelöst, als schon 99 % der Zeit verbraucht waren. */
export const lastSecond = (g) => !!g?.result?.solved && heatOf(g) >= 0.99;
/** Neue oder geänderte Vorschläge seit dem letzten Zustand. */
export const proposed = (a, b) => Object.entries(b?.proposals || {}).filter(([id, code]) => a?.proposals?.[id] !== code).map(([id]) => id);
const needle = (state) => `<svg class="xp-rn-gauge" data-state="${state}" viewBox="0 0 40 26" aria-hidden="true"><path d="M4 22a16 16 0 0 1 32 0" fill="none" stroke="#d6e8c4" stroke-width="2"/><path d="M4 22a16 16 0 0 1 8-13.900" fill="none" stroke="#7fd1b0" stroke-width="3"/><path d="M28 8.100A16 16 0 0 1 36 22" fill="none" stroke="#ff8a5c" stroke-width="3"/><g class="xp-rn-needle"><path d="M20 22 20 8" stroke="#f2c14e" stroke-width="2.500" stroke-linecap="round"/></g><circle cx="20" cy="22" r="2.500" fill="#f2c14e"/></svg>`;
let seen = 0, lastLevel = 0, viewAt = 0;

export default {
  palette: 'reaktor-notfall',
  winner: { colors: ['#7fd1b0', '#f2c14e', '#d6e8c4'], shape: 'paper', palette: 'reaktor-notfall', winEvent: 'win' },
  key: (view) => [view.phase, view.roundNo, view.g?.question, view.g?.stage, view.g?.mistakes, JSON.stringify(view.g?.proposals || {}), !!view.gamePaused].join(':'),
  still(view, x) {
    const g = view.g, panel = x.$('.rn-panel'); if (!g || !panel) return;
    viewAt = performance.now();
    const heat = g.stage === 'reveal' && g.result?.solved ? heatOf(g) : heatOf(g);
    panel.style.setProperty('--xp-heat', heat.toFixed(3));
    // Temperatursäule mit Skala; Kühlrohre über und unter dem Pult.
    if (!panel.querySelector('.xp-rn-column')) panel.insertAdjacentHTML('afterbegin', '<span class="xp-rn-column" aria-hidden="true"><i></i><b></b></span><span class="xp-rn-pipes" aria-hidden="true"><i></i></span>');
    // Ein Zeigerinstrument je Person: zeigt nach links, solange kein Code steht, sonst Mitte; gelöst: Grün.
    const solved = g.stage === 'reveal' && g.result?.solved;
    for (const li of x.$$('.rn-proposals li')) {
      const has = li.querySelector('span')?.textContent?.trim() !== '—', state = solved ? 'ok' : has ? 'set' : 'idle';
      const old = li.querySelector('.xp-rn-gauge');
      if (old?.dataset.state !== state) { old?.remove(); li.insertAdjacentHTML('afterbegin', needle(state)); }
    }
  },
  change(view, prev, x) {
    const g = view.g, p = prev.g || {}, group = []; if (!g) return;
    if (g.question !== p.question) { lastLevel = 0; seen = 0; }
    // Kühlung: Jeder neu eingetragene Code zischt.
    if (g.stage === 'write' && proposed(p, g).length) { x.play('hiss'); x.play('switch'); }
    if ((g.mistakes || 0) > (p.mistakes || 0)) { x.play('wrong'); x.highlight('fehler', 900, x.$('.rn-panel')); }
    if (g.stage === 'reveal' && p.stage !== 'reveal' && g.result) {
      if (g.result.solved) {
        // Erfolg: Entwarnung und Dampfwolke über dem Pult.
        x.play('allclear');
        const panel = x.$('.rn-panel'), layer = x.layer;
        if (panel && layer) {
          const r = panel.getBoundingClientRect(), box = layer.getBoundingClientRect();
          for (let i = 0; i < 6; i++) {
            const puff = document.createElement('i'); puff.className = 'xp-rn-steam';
            puff.style.left = `${r.left - box.left + r.width * (0.2 + i * 0.12)}px`; puff.style.top = `${r.top - box.top + 20}px`; layer.append(puff);
            group.push(x.plans.frames(puff, [{ transform: 'translate(-50%, 0) scale(.4)', opacity: 0 }, { transform: 'translate(-50%, -40px) scale(1)', opacity: 0.85, offset: 0.35 }, { transform: 'translate(-50%, -110px) scale(1.6)', opacity: 0 }], { duration: 1500, delay: i * 90 }));
            x.later(() => puff.remove(), x.animated ? 1600 + i * 90 : 0);
          }
        }
        x.$$('.xp-rn-gauge').forEach((el, n) => group.push(x.plans.frames(el, [{ transform: 'rotate(-30deg)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 200 + n * 70 })));
        if (lastSecond(g)) {
          // Highlight: Gerettet bei 99 %.
          x.play('sigh'); x.play('highlight');
          x.highlight('gerettet', 2600);
          x.plaque(t('Gerettet – in letzter Sekunde!', 'Saved – at the last second!'), { anchor: x.$('.rn-panel'), ms: 2600, material: null, cls: 'xp-rn-saved' });
        }
      } else x.play('alarm3');
    }
    if (group.length) x.run(group);
  },
  // Alarm steigt mit der Temperatur (alle 2,4 s ein weicher Doppelton, je heißer, desto höher). Die Säule läuft zwischen zwei Zuständen weiter.
  interval: { ms: 400, run(view, x) {
    const g = view.g; if (g?.stage !== 'write') return;
    const heat = heatOf(g, performance.now() - viewAt), panel = x.$('.rn-panel');
    if (panel) panel.style.setProperty('--xp-heat', heat.toFixed(3));
    const level = alarmLevel(heat), now = performance.now();
    if (level && (level > lastLevel || now - seen > 2400)) { seen = now; x.play('alarm' + level); }
    lastLevel = level;
  } },
};
