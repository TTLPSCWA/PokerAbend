// Gemeinsame Darstellung; bestehende Spiele verwenden weiterhin prefs und savePrefs.
'use strict';
window.UITheme = (() => {
  usePrefs({ reduceGlass: false, theme: 'classic' });
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  function apply() {
    const root = document.documentElement;
    root.dataset.glass = prefs.reduceGlass || transparency.matches ? 'reduced' : 'full';
    root.dataset.theme = prefs.theme === 'night' ? 'night' : 'classic';
    document.body.classList.toggle('calm', motionOff());
  }
  const glassPreference = () => `<label class="toggle"><span>Glaseffekt reduzieren<small>Deckende Flächen und weniger Transparenz</small></span><input type="checkbox" role="switch" data-ui-pref="reduceGlass" ${prefs.reduceGlass ? 'checked' : ''}></label>`;
  const preferences = () => {
    const toggle = (key, label) => `<label class="toggle"><span>${label}</span><input type="checkbox" role="switch" data-ui-pref="${key}" ${prefs[key] ? 'checked' : ''}></label>`;
    return `${toggle('sound', 'Töne')}${toggle('calm', 'Animationen aus')}${glassPreference()}
      ${GameDesign.cardPreference().replace('data-pref=', 'data-ui-pref=')}
      <label class="field"><span>Tisch</span><select data-ui-pref="theme"><option value="classic" ${prefs.theme !== 'night' ? 'selected' : ''}>Klassisch – grüner Filz</option><option value="night" ${prefs.theme === 'night' ? 'selected' : ''}>Nacht – blauer Filz</option></select></label>`;
  };
  document.addEventListener('change', (e) => {
    const input = e.target.closest('[data-ui-pref]');
    if (!input) return;
    prefs[input.dataset.uiPref] = input.type === 'checkbox' ? input.checked : input.value;
    savePrefs();
  });
  transparency.addEventListener('change', apply);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', apply);
  apply();
  return { apply, preferences, glassPreference };
})();
