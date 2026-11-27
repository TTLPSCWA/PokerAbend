import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARDS } from '../games/meme-duell/catalog.js';

const catalogUrl = 'https://api.imgflip.com/get_memes';
const day = 86400000;
const maxPacks = 50;
const motifs = new Set(CARDS.map(card => card.template));
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const clean = (value, max) => typeof value === 'string' && value.length <= max
  ? value.trim().replace(/\s+/g, ' ') : '';
const textPair = (a, b, max) => [clean(a, max), clean(b, max)];

export function createMemePackLibrary(dir, { fetchCatalog = globalThis.fetch, now = Date.now } = {}) {
  const file = join(dir, 'meme-packs.json');
  const initial = { version:1, entries:[], providerEnabled:false, checkedAt:null, listings:[] };
  let data = existsSync(file) ? JSON.parse(readFileSync(file,'utf8')) : initial;
  if (data.version !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.listings)) {
    throw new Error('Ungültige Meme-Paketdatei');
  }
  let refreshPending = false;
  let retryAt = 0;
  function save(next) {
    mkdirSync(dir, { recursive:true });
    writeFileSync(file+'.tmp', JSON.stringify(next,null,2), { mode:0o600 });
    renameSync(file+'.tmp',file);
    data = next;
  }
  function create(input) {
    const title = textPair(input.titleDe,input.titleEn,70);
    const situation = textPair(input.situationDe,input.situationEn,180);
    const caption = textPair(input.captionDe,input.captionEn,160);
    const license = clean(input.license,220);
    const type = input.type;
    const template = input.template;
    if (![...title,...situation,...caption,license].every(Boolean) || !motifs.has(template)
        || !['community','trending'].includes(type) || typeof input.extended !== 'boolean') {
      fail('Titel, Motiv, Anlass, Text und Nutzungsnachweis werden benötigt');
    }
    const sourceText = clean(input.source,500);
    let source;
    try { source = new URL(sourceText); } catch { fail('Quelle muss ein gültiger HTTPS-Link sein'); }
    if (source.protocol !== 'https:' || source.username || source.password) fail('Quelle muss ein gültiger HTTPS-Link sein');
    const id = 'reviewed-' + createHash('sha256')
      .update(JSON.stringify([type,template,situation,caption]).normalize('NFKC').toLowerCase()).digest('hex').slice(0,20);
    if (data.entries.some(entry => entry.id === id)) fail('Dieser Beitrag existiert bereits',409);
    if (data.entries.length >= maxPacks) fail('Paketlimit erreicht',409);
    const entry = { id, title, situation, caption, template, type, license, source:source.href, extended:input.extended,
      status:'pending', createdAt:now(), reviewedAt:null };
    save({...data, entries:[...data.entries,entry]});
    return entry;
  }
  function review(id, status, confirmed) {
    if (!['approved','disabled'].includes(status) || (status === 'approved' && confirmed !== true)) {
      fail('Nutzungsrechte und Inhaltseignung ausdrücklich prüfen');
    }
    const old = data.entries.find(entry => entry.id === id);
    if (!old) fail('Meme-Beitrag fehlt',404);
    const entry = {...old,status,reviewedAt:now()};
    save({...data,entries:data.entries.map(row=>row.id===id ? entry : row)});
    return entry;
  }
  function configure(enabled) {
    if (typeof enabled !== 'boolean') fail('Bitte einen eindeutigen Ein- oder Ausschaltwert senden');
    save({...data,providerEnabled:enabled});
  }
  async function refresh() {
    if (!data.providerEnabled || refreshPending || now() < retryAt || (data.checkedAt !== null && now() - data.checkedAt < day)) return false;
    refreshPending = true;
    try {
      const result = await fetchCatalog(catalogUrl, {redirect:'error',signal:AbortSignal.timeout(5000),headers:{accept:'application/json'}});
      if (!result.ok) fail('Imgflip konnte nicht abgefragt werden',502);
      const payload = await result.json();
      if (payload?.success !== true || !Array.isArray(payload.data?.memes)) fail('Ungültige Antwort von Imgflip',502);
      if (!data.providerEnabled) return false;
      const prior = new Map(data.listings.map(entry => [entry.id,entry]));
      const seenIds = new Set(), seenNames = new Set(), checkedAt = now();
      const listings = payload.data.memes.slice(0,100).flatMap((item,i)=>{
        const id = typeof item?.id === 'string' && /^\d{1,20}$/.test(item.id) ? item.id : null;
        const name = clean(item?.name,100);
        const key = name.normalize('NFKC').toLowerCase();
        if (!id || !name || seenIds.has(id) || seenNames.has(key)) return [];
        seenIds.add(id); seenNames.add(key);
        const before = prior.get(id), rank = i + 1;
        const change = before ? before.rank - rank : 0;
        const observation = before ? (change >= 10 ? 'rank-rise' : 'popular') : (prior.size ? 'new-in-chart' : 'initial');
        return [{id,name,rank,change,observation,firstSeen:before?.firstSeen ?? checkedAt,checkedAt,
          source:'https://imgflip.com/memetemplate/'+id}];
      });
      save({...data,checkedAt,listings});
      return true;
    } catch (error) {
      retryAt = now() + 3600000;
      throw error;
    } finally { refreshPending = false; }
  }
  return {
    list: () => ({...structuredClone(data),motifs:[...motifs]}),
    approved: () => data.entries.filter(entry=>entry.status==='approved').map(entry=>({
      id:entry.id, pack:entry.type, template:entry.template, situation:entry.situation, caption:entry.caption, extended:entry.extended,
    })),
    create,review,configure,refresh,
  };
}
