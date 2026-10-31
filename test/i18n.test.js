import test from 'node:test';
import assert from 'node:assert/strict';
import { gameList } from '../games/index.js';
import { i18nContext } from './i18n-harness.js';
import { readFileSync } from 'node:fs';
import { PARTY_ENGLISH, bilingual } from '../games/party-english.js';
import { GAMES } from '../games/index.js';
import { parseNumber } from '../games/schaetzmeister/room.js';

test('Language: German is the default and unsupported values do not change it', () => {
  const c = i18nContext({}, 'fr');
  assert.equal(c.I18n.language, 'de');
  c.I18n.select('fr');
  assert.equal(c.I18n.language, 'de');
  assert.equal(c.I18n.t('Mitspielen'), 'Mitspielen');
});
test('Language: choice persists, html lang changes and the other profile preferences are preserved', () => {
  const c = i18nContext();
  c.localStorage.setItem('poker:prefs', '{"sound":false}');
  c.I18n.select('en');
  assert.equal(c.document.documentElement.lang, 'en');
  assert.equal(c.localStorage.getItem('poker:language'), '"en"');
  assert.equal(c.localStorage.getItem('poker:prefs'), '{"sound":false}');
  assert.equal(c.I18n.t('Mitspielen'), 'Play');
  assert.equal(c.I18n.t(' (du)'), ' (you)');
  c.I18n.select('de');
  assert.equal(c.I18n.t('Mitspielen'), 'Mitspielen');
});
test('Language: template values are opaque, even when a player name equals a German UI label', () => {
  const { I18n: i } = i18nContext({}, 'en');
  assert.match(i.html`<h2>Willkommen, ${'Spiele'}. Entdecke euer nächstes Spiel.</h2>`, /Welcome, Spiele\. Discover your next game/);
  assert.equal(i.html`<b>${'Spiele'}</b>`, '<b>Spiele</b>');
  assert.equal(i.html`<p>${'___I18N_0___ &lt;script&gt;'}</p>`, '<p>___I18N_0___ &lt;script&gt;</p>');
  assert.equal(i.html`<button data-g="${'Mitspielen'}">${'Regeln'}</button>`, '<button data-g="Mitspielen">Regeln</button>');
});
test('Language: static text and accessibility labels translate; identifiers and input values stay intact', () => {
  const { I18n: i } = i18nContext({}, 'en');
  const html = i.html`<input id="Spiel" value="Spiele" placeholder="Spiele suchen …"><button data-g="Mitspielen" aria-label="Spiel fortsetzen">Mitspielen</button>`;
  assert.match(html, /id="Spiel" value="Spiele" placeholder="Search games …"/);
  assert.match(html, /data-g="Mitspielen" aria-label="Resume game"/);
  assert.match(html, />Play<\/button>/);
});
test('Language: unknown copy falls back to German and slots can be reordered without changing player text', () => {
  const c = i18nContext({}, 'en');
  assert.equal(c.I18n.t('Unbekannter Text'), 'Unbekannter Text');
  c.EN['{0} und {1}'] = '{1} then {0}';
  assert.equal(c.I18n.html`${'Regeln'} und ${'Spiele'}`, 'Spiele then Regeln');
});
test('Language: every registered game has an English catalogue entry; technical metadata stays untouched', () => {
  const c = i18nContext({}, 'en');
  const games = gameList(), before = JSON.stringify(games);
  c.I18n.configureGames(games);
  assert.equal(Object.keys(c.EN_GAMES).length, games.length);
  for (const g of games) {
    assert.ok(c.EN_GAMES[g.id]?.description);
    assert.equal(c.I18n.t(g.name), c.EN_GAMES[g.id].name);
    assert.equal(c.I18n.t(g.description), c.EN_GAMES[g.id].description);
  }
  assert.equal(JSON.stringify(games), before);
});
test('Language: all 423 built-in party prompts have an English equivalent with the same IDs and answers', () => {
  let count = 0;
  for (const [game, file] of [['schaetzmeister', 'fragen'], ['schlagfertig', 'aufgaben'], ['werhatdasgesagt', 'fragen']]) {
    const catalogue = JSON.parse(readFileSync(new URL(`../games/${game}/${file}.json`, import.meta.url), 'utf8'));
    assert.deepEqual(Object.keys(PARTY_ENGLISH[game]).sort(), catalogue.map((q) => q.id).sort());
    const translated = bilingual(game, catalogue);
    for (let i = 0; i < catalogue.length; i++) {
      const { en, unitEn, ...original } = translated[i];
      assert.deepEqual(original, catalogue[i]);
      assert.ok(en?.length > 10, `${game}/${original.id}`);
      if (game === 'schaetzmeister') assert.ok(unitEn);
      if (game === 'schlagfertig') assert.ok(en.includes('___'));
    }
    count += catalogue.length;
  }
  assert.equal(count, 423);
});
test('Language: English party questions reveal no answers early; custom questions are never translated', (t) => {
  for (const game of ['schaetzmeister', 'schlagfertig', 'werhatdasgesagt']) {
    const r = GAMES[game].create('LANG', { rounds: 1 }, () => {});
    t.after(() => r.dispose());
    const ids = Array.from({ length: 3 }, (_, i) => { const p = r.addPlayer('Player ' + i, null); p.connected = true; r.sit(p.id); return p.id; });
    r.start(ids[0]);
    const g = r.view(ids[0]).g;
    if (game === 'schaetzmeister') {
      assert.ok(g.questionEn); assert.equal(g.reveal, null); assert.equal(g.answer, undefined);
      assert.equal(g.unitEn, r.cur.unitEn);
    } else if (game === 'schlagfertig') {
      assert.ok(g.tasks.every((q) => q.en)); assert.equal(g.results, undefined);
    } else { assert.ok(g.promptEn); assert.equal(g.results, undefined); }
    r.abortRound(ids[0]);
    const custom = r.parseCustom(game === 'schaetzmeister' ? 'My own English question? | 206 | bones' : 'Spiele – my own untranslated question?', 0);
    assert.equal(custom.en, undefined);
    assert.equal(custom.unitEn, undefined);
  }
});
test('Language: English decimal/thousands notation is sent as a number; German parser input is retained', () => {
  const { I18n: i } = i18nContext({}, 'en');
  for (const [s, n] of [['1,234.5', 1234.5], ['1.234', 1.234], ['1,234,567', 1234567], ['-3.5', -3.5], ['206', 206]]) assert.equal(i.number(s), n);
  for (const s of ['', '1,5', '1.2.3', '1e8', '<script>']) assert.equal(i.number(s), null);
  i.select('de');
  assert.equal(i.number('1.234,5'), '1.234,5');
});
test('Language: custom content has no English lookup, even when it matches a UI message', () => {
  const { I18n: i } = i18nContext({}, 'en');
  assert.equal(i.content('Spiele'), 'Spiele');
  assert.equal(i.content('Spiele', 'Games'), 'Games');
  i.select('de'); assert.equal(i.content('Spiele', 'Games'), 'Spiele');
});

test('Language: numeric drafts retain their value when switching decimal/thousands notation', () => {
  const { I18n: i } = i18nContext();
  for (const text of ['1.234', '1,234', '1.234,5', '1.234.567', '+206', '−3,5', '1 234,5', "1'234,5", '.5', '0', '-0,001', '0,0000001', '1,23456']) {
    const english = i.numberDraft(text, 'de', 'en');
    i.select('en'); assert.notEqual(i.number(english), null, text);
    assert.equal(parseNumber(i.number(english)), parseNumber(text), text);
  }
  for (const [text, expected] of [['1,234.5', '1234,5'], ['1.234', '1,234'], ['-3.5', '-3,5'], ['206', '206']]) {
    assert.equal(i.numberDraft(text, 'en', 'de'), expected);
    assert.equal(parseNumber(expected), i.number(text));
  }
  for (const text of ['', '-', '1,', '1.', 'wrong', '1.2.3']) {
    assert.equal(i.numberDraft(text, 'de', 'en'), text);
    assert.equal(i.numberDraft(text, 'en', 'de'), text);
  }
  assert.equal(i.numberDraft('1,234.5', 'en', 'en'), '1,234.5');
});
test('Language: storage changes sync the language, and blocked storage still permits an in-memory choice', () => {
  const c = i18nContext();
  c.dispatchEvent({ type: 'storage', key: 'poker:language', newValue: '"en"' });
  assert.equal(c.I18n.language, 'en');
  c.dispatchEvent({ type: 'storage', key: 'poker:language', newValue: null });
  assert.equal(c.I18n.language, 'de');
  const blocked = i18nContext({ localStorage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } });
  assert.doesNotThrow(() => blocked.I18n.select('en'));
  assert.equal(blocked.I18n.t('Spiele'), 'Games');
  assert.equal(blocked.I18n.t('__proto__'), '__proto__');
});
test('Language: text and accessibility originals on the same element survive switching both ways', () => {
  const c = i18nContext({}, 'en');
  const attributes = { title: 'Spiele' };
  const el = { textContent: 'Spiele', dataset: { i18nAttrs: 'title' }, getAttribute: (k) => attributes[k], setAttribute: (k, v) => { attributes[k] = v; } };
  const root = { querySelectorAll: (selector) => ['[data-i18n]', '[data-i18n-attrs]'].includes(selector) ? [el] : [] };
  c.I18n.staticText(root); assert.equal(el.textContent, 'Games'); assert.equal(attributes.title, 'Games');
  c.I18n.select('de'); c.I18n.staticText(root); assert.equal(el.textContent, 'Spiele'); assert.equal(attributes.title, 'Spiele');
});
