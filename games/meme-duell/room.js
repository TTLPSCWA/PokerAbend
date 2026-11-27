import { PartyRoom } from '../party-room.js';
import { cleanText } from '../../server/security.js';
import { shuffle } from '../../server/random.js';
import { CARDS, EXTRA_CAPTIONS, EXTENDED_CAPTIONS, PACKS } from './catalog.js';
import { randomUUID } from 'node:crypto';
import { CHUNK_COUNT, CHUNK_LENGTH, ENCODED_LENGTH, encodeRaster } from './raster.js';

const ROOM_IMAGES_MAX = 4;
const UPLOAD_TTL = 60_000;
let reviewedCards = () => [];
export function configureReviewedMemeCards(readCards) { reviewedCards = readCards; }

const modeValues = [
  {value:'text', label:'Meme trifft Text'},
  {value:'image', label:'Memes Against Humanity'},
  {value:'creator', label:'Meme Creator'},
];

function textFields(data) {
  const fields = data?.fields;
  if (!Array.isArray(fields) || fields.length < 1 || fields.length > 3) throw Error('Füge bis zu drei Textfelder hinzu');
  return fields.map(field => {
    const {text, x, y, size, align} = field ?? {};
    if (typeof text !== 'string' || text.length > 160 || !cleanText(text, 160) ||
        !Number.isInteger(x) || x < 5 || x > 95 || !Number.isInteger(y) || y < 5 || y > 95 ||
        !Number.isInteger(size) || size < 16 || size > 52 || !['left', 'center', 'right'].includes(align)) {
      throw Error('Ungültiger Text oder ungültige Position');
    }
    return {text: cleanText(text, 160), x, y, size, align};
  });
}

export class MemeDuelRoom extends PartyRoom {
  static OPTIONS = [
    {key:'mode', label:'Meme-Modus', type:'select', values:modeValues},
    {key:'rounds', label:'Anzahl Runden', type:'number', min:1, max:15},
    {key:'writeSecs', label:'Zeit für Beiträge in Sekunden', type:'number', min:10, max:180},
    {key:'voteSecs', label:'Zeit für die Bewertung in Sekunden', type:'number', min:10, max:120},
    {key:'extended', label:'Erweiterten Humor erlauben', type:'bool'},
    {key:'privateImages', label:'Eigene Bilder aus diesem Raum verwenden', type:'bool'},
    {key:'creatorVote', label:'Abstimmung im Creator', type:'select', values:[
      {value:'group', label:'Gruppe'}, {value:'jury', label:'Wechselnde Jury'},
    ]},
    {key:'effects', label:'Meme-Klangeffekte', type:'bool'},
    ...Object.entries(PACKS).map(([key, names]) => ({key, label:'Meme-Paket: ' + names[0], type:'bool'})),
  ];

  constructor(code, settings, onChange) {
    super(code, settings, onChange, {minPlayers:3, maxPlayers:12});
    this.juryOrder = [];
    this.privateCards = [];
    this.pendingImage = null;
  }

  defaultSettings() {
    return {mode:'text', rounds:3, writeSecs:45, voteSecs:30, extended:false, privateImages:false, creatorVote:'group', effects:true,
      classics:true, gaming:true, everyday:true, absurd:true, community:true, trending:true};
  }

  static restore(data, onChange) {
    return PartyRoom.restoreInto(new this(data.code, data.settings, onChange), data);
  }

  get flow() { return ['write', 'vote', 'reveal']; }
  get stamp() { return this.roundNo + ':' + this.q + ':' + this.stage; }

  catalog() {
    const builtIn = [...CARDS,...reviewedCards()].filter(card =>
      this.settings[card.pack] && (!card.extended || this.settings.extended));
    return this.settings.privateImages ? [...builtIn, ...this.privateCards] : builtIn;
  }

  beginImage(id, title) {
    this.requireHost(id);
    if (this.phase === 'playing' || this.privateCards.length >= ROOM_IMAGES_MAX) throw Error('Bildlimit erreicht oder Partie läuft');
    const label = typeof title === 'string' && title.length <= 64 ? cleanText(title, 64) : '';
    if (!label) throw Error('Das Bild braucht einen kurzen Titel');
    const token = randomUUID();
    this.pendingImage = {id, token, label, expires:this.clock.now()+UPLOAD_TTL, chunks:[]};
    return {reply:{token}};
  }

  acceptImageChunk(id, data) {
    this.requireHost(id);
    const x = this.pendingImage;
    if (this.phase === 'playing' || !x || x.id !== id || data?.token !== x.token || this.clock.now() > x.expires) {
      throw Error('Dieser Upload ist nicht mehr aktiv');
    }
    const index = x.chunks.length;
    const final = index === CHUNK_COUNT-1;
    const size = final ? ENCODED_LENGTH-index*CHUNK_LENGTH : CHUNK_LENGTH;
    if (data.index !== index || typeof data.chunk !== 'string' || data.chunk.length !== size ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(data.chunk)) throw Error('Ungültiger Bildabschnitt');
    x.chunks.push(data.chunk);
    if (final) {
      this.pendingImage = null;
      const raster = x.chunks.join('');
      const png = encodeRaster(raster);
      if (this.privateCards.length >= ROOM_IMAGES_MAX) throw Error('Bildlimit erreicht');
      this.privateCards.push(this.makePrivateCard('private-'+x.token,x.label,raster,png));
      this.onChange('handDone');
    }
    return {reply:{complete:final}};
  }

  removeImage(id, key) {
    this.requireHost(id);
    if (this.phase === 'playing') throw Error('Bilder können nur zwischen Partien gelöscht werden');
    const index = this.privateCards.findIndex(card => card.id === key);
    if (index < 0) throw Error('Dieses Bild gibt es hier nicht');
    this.privateCards.splice(index, 1);
    this.onChange('handDone');
  }

  makePrivateCard(id, label, raster, png) {
    return {id, template:id, title:label, caption:[label,label], situation:[label,label], raster, png};
  }

  saveExtra() {
    return {privateCards:this.privateCards.map(({id,title,raster})=>({id,title,raster}))};
  }

  loadExtra(extra) {
    if (!Array.isArray(extra?.privateCards)) return;
    this.privateCards = extra.privateCards.slice(0, ROOM_IMAGES_MAX).flatMap(value => {
      try {
        if (!/^private-[0-9a-f-]{36}$/.test(value.id) || typeof value.title !== 'string' || value.title.length > 64) return [];
        return [this.makePrivateCard(value.id, cleanText(value.title, 64), value.raster, encodeRaster(value.raster))];
      } catch { return []; }
    });
  }

  view(viewer) {
    const v = super.view(viewer);
    if (v.you?.isHost && this.phase !== 'playing') {
      v.privateMemeCards = this.privateCards.map(({id,title})=>({id,title}));
    }
    return v;
  }

  mediaFor(viewer, ids) {
    const player = this.players.get(viewer);
    if (!player || player.kicked) return {};
    const keys = new Set(ids);
    return Object.fromEntries(this.privateCards.filter(card=>keys.has(card.id)).map(({id,png})=>[id,png]));
  }

  validateStart(ids) {
    if (!this.catalog().length) throw Error('Aktiviere mindestens ein Meme-Paket');
    if (ids.some(id => this.players.get(id)?.bot)) throw Error('Meme-Duell erwartet menschliche Mitspieler');
  }

  pickQuestions(n) {
    this.pendingImage = null;
    this.juryOrder = [...this.order];
    const catalog = this.catalog();
    const out = [];
    while (out.length < n) {
      const batch = shuffle([...catalog]);
      if (out.at(-1) === batch[0] && batch.length > 1) batch.push(batch.shift());
      out.push(...batch.slice(0, n - out.length));
    }
    return out;
  }

  startQuestion() {
    this.judge = null;
    if (this.settings.mode === 'text' || (this.settings.mode === 'creator' && this.settings.creatorVote === 'jury')) {
      const offset = this.q % this.juryOrder.length;
      const rotated = [...this.juryOrder.slice(offset), ...this.juryOrder.slice(0, offset)];
      this.judge = rotated.find(id => this.order.includes(id) && this.active(id)) || null;
    }
    this.entries = new Map();
    this.votes = new Map();
    this.display = [];
    this.results = [];
    this.hands = new Map(this.order.map(id => [id, this.hand()]));
  }

  hand() {
    const catalog = this.catalog();
    if (this.settings.mode === 'creator') return [];
    if (this.settings.mode === 'image') {
      const templates = Array.from(new Set(catalog.flatMap(card => card.png ? [card.template] : [card.template, card.template + '-alt'])));
      const choices = [];
      while (choices.length < 5) choices.push(...shuffle([...templates]));
      return choices.slice(0, 5);
    }
    return shuffle([...catalog.map(card => card.caption), ...EXTRA_CAPTIONS,
      ...(this.settings.extended ? EXTENDED_CAPTIONS : [])]).slice(0, 7);
  }

  canSubmit(id) {
    return this.phase === 'playing' && this.stage === 'write' && !this.gamePaused &&
      this.isPlayer(id) && this.active(id) && (this.settings.mode !== 'text' || id !== this.judge) && !this.entries.has(id);
  }

  canVote(id) {
    if (this.phase !== 'playing' || this.stage !== 'vote' || this.gamePaused ||
        !this.isPlayer(id) || !this.active(id) || this.votes.has(id)) return false;
    if ((this.judge || this.settings.mode === 'text') && id !== this.judge) return false;
    return this.display.some(author => author !== id);
  }

  submit(id, data) {
    if (data?.stamp !== this.stamp || !this.canSubmit(id)) throw Error('Dieser Beitrag kann nicht mehr eingereicht werden');
    const mode = this.settings.mode;
    let entry;
    if (mode === 'creator') {
      entry = { template:this.cur.template, fields:textFields(data) };
    } else {
      const hand = this.hands.get(id);
      const index = data.card;
      if (!Number.isInteger(index) || index < 0 || index >= hand.length) throw Error('Wähle eine Karte aus deiner Hand');
      entry = mode === 'text' ? {template:this.cur.template, caption:hand[index]} : {template:hand[index]};
    }
    this.entries.set(id, entry);
    this.checkDone();
  }

  ballot(id, data) {
    if (data?.stamp !== this.stamp || !this.canVote(id)) throw Error('Du kannst gerade nicht abstimmen');
    const index = data.choice;
    if (!Number.isInteger(index) || index < 0 || index >= this.display.length || this.display[index] === id) {
      throw Error('Wähle einen fremden Beitrag');
    }
    this.votes.set(id, this.display[index]);
    this.checkDone();
  }

  waiting(stage) {
    if (stage === 'write') return this.order.filter(id => (this.settings.mode !== 'text' || id !== this.judge) && !this.entries.has(id));
    if (stage === 'vote') return this.order.filter(id => this.canVote(id));
    return [];
  }

  closeStage(stage) {
    if (stage === 'write') this.display = shuffle([...this.entries.keys()].filter(id => this.isPlayer(id)));
  }

  isReady(id) {
    return this.stage === 'write' ? this.entries.has(id) : this.votes.has(id);
  }

  enter(stage) {
    if (stage !== 'reveal') return;
    const counts = new Map();
    for (const author of this.votes.values()) counts.set(author, (counts.get(author) || 0) + 1);
    const best = Math.max(0, ...counts.values());
    this.results = this.display.map(author => {
      const votes = counts.get(author) || 0;
      const winner = best > 0 && votes === best;
      if (winner) this.addPoints(author, 1);
      return { ...this.entries.get(author), name:this.name(author), votes, winner };
    });
  }

  stageView(id) {
    const mode = this.settings.mode;
    const grouped = {
      mode, stamp:this.stamp, judge:this.judge ? this.name(this.judge) : null,
      template:mode === 'image' ? null : this.cur.template,
      situation:mode === 'image' ? this.cur.situation : null,
    };
    if (this.stage === 'write') {
      const hand = id !== this.judge ? this.hands.get(id) ?? null : null;
      return {...grouped, hand, canSubmit:this.canSubmit(id), submitted:this.entries.has(id),
        media:this.mediaFor(id,[grouped.template,...(mode === 'image' && hand ? hand : [])])};
    }
    if (this.stage === 'vote') {
      const choices = this.display.map(author => ({ ...this.entries.get(author), mine:author === id }));
      return {...grouped, choices, canVote:this.canVote(id), voteSent:this.votes.has(id),
        media:this.mediaFor(id,choices.map(choice=>choice.template))};
    }
    return {...grouped, results:this.results, media:this.mediaFor(id,this.results.map(result=>result.template))};
  }
}
