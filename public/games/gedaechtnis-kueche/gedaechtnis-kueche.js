// Gedächtnisküche im Browser (Regeln und Wertung: public/games/gedaechtnis-kueche/logic.js). Rezept merken, dann die Zutaten in der Reihenfolge antippen.
'use strict';
{
  soloGame({
    id: 'gedaechtnis-kueche',
    name: 'Gedächtnisküche',
    terms: { waitWrite: 'kocht …' },
    intro: [
      ['Ziel', 'Merk dir das Rezept: Die Zutaten erscheinen nacheinander.'],
      ['Nachkochen', 'Tipp danach die Zutaten in genau der Reihenfolge an. Der erste Fehler beendet die Folge.'],
      ['Länger', 'Jede Runde wird das Rezept eine Zutat länger.'],
    ],
    short: [
      'Alle sehen dasselbe Rezept: eine Folge von Zutaten, jeweils kurz.',
      'Danach verschwindet es, und du tippst die Zutaten in der richtigen Reihenfolge an.',
      'Jede Runde ist das Rezept eine Zutat länger; ein Fehler beendet die Folge.',
      'Punkte nach Länge der richtig erinnerten Folge, dazu ein Bonus fürs ganze Rezept und für Tempo.',
    ],
    rules: I18n.html`<p>Ein Rezept ist eine Folge von Zutaten. Alle bekommen dasselbe Rezept und sehen die Zutaten kurz nacheinander.</p>
      <ul>
        <li>Danach verschwindet das Rezept, und du tippst die Zutaten <b>in derselben Reihenfolge</b> an.</li>
        <li>Der <b>erste Fehler</b> beendet die Folge: Du bekommst Punkte für die Zutaten, die bis dahin stimmten (10 je Zutat).</li>
        <li>Das ganze Rezept richtig: +20 und bis zu +10 für Tempo.</li>
        <li>Jede Runde wird das Rezept <b>eine Zutat länger</b>.</li>
        <li>Hausregel: Rezept rückwärts nennen (Host-Menü).</li>
      </ul>`,
    timed: false,
    phase(c) {
      const len = c.round.seq.length, per = c.round.showMsPerItem;
      if (c.t >= len * per + 200) return 'recall';
      const i = Math.min(len - 1, Math.floor(c.t / per));
      return I18n.html`show:${i}:${c.t >= len * per || (c.t % per) >= 600 ? 1 : 0}`; // zweite Zahl: Pause zwischen den Zutaten
    },
    sig(c) { return `${this.phase(c)}|${(c.local.taps || []).length}`; },
    render(c) {
      const ph = this.phase(c);
      if (ph !== 'recall') {
        const [, i, gap] = ph.split(':').map(Number);
        const idx = i, ing = c.L.INGREDIENTS[c.round.seq[idx]];
        return I18n.html`<div class="gk-show" role="status"><small>Zutat ${idx + 1} von ${c.round.seq.length}${c.round.reverse ? ' – später rückwärts nennen' : ''}</small><span class="gk-big" aria-label="${esc(ing.name)}">${gap ? '' : ing.icon}</span></div>`;
      }
      const taps = c.local.taps || [];
      const row = I18n.html`<div class="gk-taps" aria-label="Bisher: ${taps.length} von ${c.round.expected.length}">${c.round.expected.map((_, k) => `<i class="${k < taps.length ? 'on' : ''}">${k < taps.length ? c.L.INGREDIENTS[taps[k]].icon : ''}</i>`).join('')}</div>`;
      const btns = c.L.INGREDIENTS.map((x, k) => `<button type="button" data-g="gk-tap" data-i="${k}" aria-label="${esc(x.name)}">${x.icon}</button>`).join('');
      return `<div class="gk-recall"><small>${c.round.reverse ? 'Tipp die Zutaten rückwärts an (die letzte zuerst)' : 'Tipp die Zutaten in der Reihenfolge an'}</small>${row}<div class="so-btns">${btns}</div></div>`;
    },
    hint: (c) => (c.t < c.round.seq.length * c.round.showMsPerItem + 200 ? 'Merk dir die Zutaten' : 'Tipp die Zutaten in der richtigen Reihenfolge an'),
    onClick(el, c) {
      if (el.dataset.g !== 'gk-tap') return;
      const taps = c.local.taps ||= [];
      taps.push(Number(el.dataset.i));
      const k = taps.length - 1;
      if (taps[k] !== c.round.expected[k] || taps.length === c.round.expected.length) { c.submit({ taps }); return; }
      c.refresh();
    },
    payload: (c) => ({ taps: c.local.taps || [] }),
    solution: (sol) => I18n.html`<div class="sm-answer" role="status"><small>Das Rezept war${sol.reverse ? ' (rückwärts)' : ''}</small><b class="gk-recipe">${sol.recipe.map((i) => ['🥕', '🧅', '🍅', '🧀', '🥚', '🍄', '🌶️', '🥔'][i]).join(' ')}</b></div>`,
  });
}
