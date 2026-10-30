import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Use the real browser catalogue/runtime in isolated UI unit tests.
export function i18nContext(globals = {}, initial = 'de') {
  const saved = new Map([['poker:language', JSON.stringify(initial)]]);
  const listeners = new Map();
  const context = vm.createContext({
    document: { addEventListener() {}, querySelectorAll: () => [], documentElement: { lang: 'de' } },
    localStorage: { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) },
    addEventListener: (name, fn) => listeners.set(name, fn),
    dispatchEvent: (event) => listeners.get(event.type)?.(event),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    ...globals,
  });
  context.window = context;
  for (const file of ['i18n-en.js', 'i18n.js']) vm.runInContext(readFileSync(new URL('../public/' + file, import.meta.url), 'utf8'), context);
  return context;
}
