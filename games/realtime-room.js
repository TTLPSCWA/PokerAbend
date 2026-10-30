// Bauart C: feste Server-Schritte, kleine öffentliche Frames, ausschließlich Richtungseingaben.
import { randomBytes } from 'node:crypto';
import { TurnRoom } from '../server/turn-room.js';

export const ARENA = { width: 900, height: 600, radius: 18, tile: 60, cols: 15, rows: 10 };
export const STEP_MS = 50;
export const COUNTDOWN_MS = 3000;
export const INPUT_TTL = 350;
const JUMP_MS = 550, JUMP_GAP = 1100;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const directions = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

export class RealtimeRoom extends TurnRoom {
  static OPTIONS = [{ key: 'playSecs', label: 'Spielzeit in Sekunden', type: 'number', min: 10, max: 180 }];
  defaultSettings() { return { playSecs: 60 }; }
  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8 });
    this.loop = null; this.runId = null; this.tickNo = 0; this.bodies = []; this.inputs = new Map();
    this.rng = Math.random;
  }
  get kind() { return this.constructor.KIND; }
  get currentId() { return null; }
  botDue() { return null; } // Echtzeit-Bots laufen in denselben festen Schritten wie Menschen.
  setupRound() {
    this.stopLoop();
    this.runId = randomBytes(6).toString('hex'); this.tickNo = 0; this.elapsed = -COUNTDOWN_MS;
    this.inputs = new Map(); this.roster = [...this.order]; this.points = Object.fromEntries(this.roster.map((id) => [id, 0]));
    this.bodies = this.roster.map((id, i) => {
      const angle = i / this.roster.length * Math.PI * 2;
      return { id, x: 450 + Math.cos(angle) * 300, y: 300 + Math.sin(angle) * 180, alive: true, lives: this.settings.lives || 1, jumpUntil: -1, jumpReady: 0, immuneUntil: 0, held: 0 };
    });
    this.tiles = Array(ARENA.cols * ARENA.rows).fill(0);
    if (this.kind === 'floor' && this.settings.holes) {
      this.tiles = this.tiles.map(() => this.rng() < .08 ? -1 : 0);
      for (const p of this.bodies) for (const [dx, dy] of [[0, 0], ...directions]) {
        const x = Math.floor(p.x / 60) + dx, y = Math.floor(p.y / 60) + dy;
        if (x >= 0 && x < 15 && y >= 0 && y < 10) this.tiles[y * 15 + x] = 0;
      }
    }
    this.crown = { x: 450, y: 300, holder: null, lockedUntil: 0 };
    this.wave = 0; this.waveAt = 0; this.hazards = [];
    this.deadline = this.clock.now() + COUNTDOWN_MS + this.settings.playSecs * 1000;
  }
  canJump() { return this.kind === 'laser' || this.kind === 'floor' && this.settings.jump; }
  input(id, { runId, round, seq, x, y, jump = false } = {}) {
    if (this.phase !== 'playing' || runId !== this.runId || round !== this.roundNo) throw new Error('Diese Eingabe gehört nicht zur laufenden Runde');
    const p = this.bodies.find((p) => p.id === id);
    if (!this.order.includes(id) || !p?.alive) throw new Error('Du schaust gerade zu');
    if (!Number.isSafeInteger(seq) || seq < 1 || seq > 1e9 || ![-1, 0, 1].includes(x) || ![-1, 0, 1].includes(y) || typeof jump !== 'boolean') throw new Error('Ungültige Bewegung');
    if (seq <= (this.inputs.get(id)?.seq || 0)) throw new Error('Diese Eingabe ist bereits veraltet');
    this.setInput(p, x, y, jump, seq);
  }
  setInput(p, x, y, jump = false, seq = 0) {
    this.inputs.set(p.id, { x, y, at: this.tickNo, seq });
    if (jump && this.canJump() && this.elapsed >= 0 && this.elapsed >= p.jumpReady) {
      p.jumpUntil = this.elapsed + JUMP_MS; p.jumpReady = this.elapsed + JUMP_GAP;
    }
  }
  jumping(p) { return p.jumpUntil > this.elapsed; }
  // Ein Aufruf entspricht immer genau 50 ms; Zeit und Positionen kommen nie vom Client.
  step() {
    if (this.phase !== 'playing') return;
    this.tickNo++; this.elapsed += STEP_MS;
    if (this.elapsed < 0) return;
    if (this.tickNo % 4 === 0 && [...this.players.values()].some((p) => !p.bot && p.connected && !p.kicked)) {
      for (const p of this.bodies) if (p.alive && this.players.get(p.id)?.bot) this.botStep(p.id);
    }
    const before = new Map(this.bodies.map((p) => [p.id, { x: p.x, y: p.y }]));
    for (const p of this.bodies) {
      const player = this.players.get(p.id), input = this.inputs.get(p.id);
      if (!p.alive || !player || !player.connected || player.kicked || !input || (this.tickNo - input.at) * STEP_MS > INPUT_TTL) continue;
      const norm = Math.hypot(input.x, input.y) || 1;
      const speed = this.kind === 'crown' && this.crown.holder === p.id ? 145 : 190;
      p.x = clamp(p.x + input.x / norm * speed * STEP_MS / 1000, ARENA.radius, ARENA.width - ARENA.radius);
      p.y = clamp(p.y + input.y / norm * speed * STEP_MS / 1000, ARENA.radius, ARENA.height - ARENA.radius);
    }
    if (this.kind === 'floor') this.stepFloor();
    else if (this.kind === 'crown') this.stepCrown();
    else this.stepLaser(before);
    if (this.phase !== 'playing') return;
    if (this.bodies.filter((p) => p.alive).length <= 1 || this.elapsed >= this.settings.playSecs * 1000) this.finishArena();
  }
  tileOf(p) { return Math.floor(p.y / ARENA.tile) * ARENA.cols + Math.floor(p.x / ARENA.tile); }
  stepFloor() {
    const ring = this.elapsed < 18000 ? 0 : Math.min(4, 1 + Math.floor((this.elapsed - 18000) / 6000));
    this.tiles = this.tiles.map((time, i) => {
      const x = i % ARENA.cols, y = Math.floor(i / ARENA.cols);
      return x < ring || x >= ARENA.cols - ring || y < ring || y >= ARENA.rows - ring || time > 0 && time <= this.elapsed ? -1 : time;
    });
    const fallen = [];
    for (const p of this.bodies.filter((p) => p.alive)) {
      const i = this.tileOf(p);
      if (!this.jumping(p) && this.tiles[i] === -1) fallen.push(p.id);
      else if (!this.jumping(p) && this.tiles[i] === 0) this.tiles[i] = this.elapsed + 900;
    }
    this.eliminate(fallen);
  }
  stepCrown() {
    const alive = this.bodies.filter((p) => p.alive);
    let holder = alive.find((p) => p.id === this.crown.holder);
    if (this.crown.holder && !holder) this.crown.holder = null;
    if (this.elapsed >= this.crown.lockedUntil) {
      const target = holder || this.crown;
      const touching = alive.filter((p) => p !== holder && distance(p, target) <= ARENA.radius * 2 + 4).sort((a, b) => distance(a, target) - distance(b, target));
      if (touching.length) { holder = touching[0]; this.crown.holder = holder.id; this.crown.lockedUntil = this.elapsed + 1000; }
    }
    if (holder) {
      this.crown.x = holder.x; this.crown.y = holder.y;
      holder.held += STEP_MS; this.points[holder.id] = Math.floor(holder.held / 1000);
    }
  }
  makeHazards() {
    const speed = Math.min(340, 140 + this.wave * 18), axes = this.settings.doubleLaser ? ['x', 'y'] : [this.wave % 2 ? 'x' : 'y'];
    const age = this.elapsed - this.waveAt, warning = age < 1200;
    const hazards = axes.map((axis, i) => {
      const length = axis === 'x' ? ARENA.width : ARENA.height;
      const dir = (Math.floor(this.wave / 2) + i) % 2 ? -1 : 1;
      const travel = Math.max(0, age - 1200) / 1000 * speed;
      return { id: `${this.wave}:${axis}`, axis, dir, speed, warning, pos: dir === 1 ? -30 + travel : length + 30 - travel, length };
    });
    if (hazards.every((h) => h.dir === 1 ? h.pos > h.length + 100 : h.pos < -100)) { this.wave++; this.waveAt = this.elapsed; return []; }
    return hazards.filter((h) => h.pos >= -40 && h.pos <= h.length + 40 || h.warning);
  }
  stepLaser(before) {
    const old = this.hazards;
    this.hazards = this.makeHazards();
    const hit = [];
    for (const p of this.bodies.filter((p) => p.alive && !this.jumping(p) && this.elapsed >= p.immuneUntil)) {
      for (const h of this.hazards.filter((h) => !h.warning)) {
        const prev = old.find((o) => o.id === h.id && !o.warning) || h;
        const a = before.get(p.id)[h.axis] - prev.pos, b = p[h.axis] - h.pos;
        if (Math.min(Math.abs(a), Math.abs(b)) <= ARENA.radius + 5 || a * b <= 0) {
          p.lives--; p.immuneUntil = this.elapsed + 1200;
          if (p.lives <= 0) hit.push(p.id);
          break;
        }
      }
    }
    this.eliminate(hit);
  }
  eliminate(ids) {
    const out = this.bodies.filter((p) => p.alive && ids.includes(p.id));
    const points = (this.roster.length - this.bodies.filter((p) => p.alive).length) * 100;
    for (const p of out) { p.alive = false; this.inputs.delete(p.id); if (this.kind !== 'crown') this.points[p.id] = points; }
  }
  finishArena() {
    if (this.phase !== 'playing') return;
    this.stopLoop();
    if (this.kind !== 'crown') for (const p of this.bodies.filter((p) => p.alive)) this.points[p.id] = (this.roster.length - 1) * 100;
    const best = Math.max(0, ...Object.values(this.points));
    const winners = best > 0 ? this.roster.filter((id) => this.players.has(id) && this.points[id] === best) : [];
    const text = winners.length ? `${winners.map((id) => this.name(id)).join(' und ')} ${winners.length > 1 ? 'teilen sich den Sieg' : 'gewinnt'} mit ${best} Punkten` : 'Unentschieden – niemand gewinnt';
    this.deadline = null;
    this.finishRound(winners, text, { ...this.points });
  }
  dropOut(p, message) {
    if (!this.order.includes(p.id)) return;
    if (message) this.say(message);
    this.eliminate([p.id]); this.order = this.order.filter((id) => id !== p.id);
    if (this.crown.holder === p.id) this.crown.holder = null;
    if (this.bodies.filter((p) => p.alive).length <= 1) this.finishArena();
  }
  botStep(id) {
    const p = this.bodies.find((p) => p.id === id);
    if (!p?.alive || this.phase !== 'playing') return;
    let dx = 0, dy = 0, jump = false;
    if (this.kind === 'floor') {
      const safe = (x, y) => {
        if (x < 0 || x >= 15 || y < 0 || y >= 10) return false;
        const t = this.tiles[y * 15 + x]; return t === 0 || t > this.elapsed + 550;
      };
      if (!p.goal || distance(p, p.goal) < 12 || !safe(Math.floor(p.goal.x / 60), Math.floor(p.goal.y / 60))) {
        const x = Math.floor(p.x / 60), y = Math.floor(p.y / 60);
        const candidates = directions.map(([a, b]) => ({ x: x + a, y: y + b })).filter((t) => safe(t.x, t.y));
        candidates.sort((a, b) => {
          const score = (t) => directions.filter(([x, y]) => safe(t.x + x, t.y + y)).length * 2 + (this.tiles[t.y * 15 + t.x] === 0 ? 3 : 0);
          return score(b) - score(a);
        });
        if (candidates.length) { const best = candidates[0]; p.goal = { x: best.x * 60 + 30, y: best.y * 60 + 30 }; }
      }
      if (p.goal) { dx = Math.abs(p.goal.x - p.x) > 7 ? Math.sign(p.goal.x - p.x) : 0; dy = Math.abs(p.goal.y - p.y) > 7 ? Math.sign(p.goal.y - p.y) : 0; }
      const tile = this.tiles[this.tileOf(p)]; jump = tile === -1 || tile > 0 && tile - this.elapsed < 350;
    } else if (this.kind === 'crown') {
      const others = this.bodies.filter((b) => b.alive && b.id !== id).sort((a, b) => distance(a, p) - distance(b, p));
      const chasing = this.crown.holder !== id;
      const target = chasing ? this.crown : others[0];
      if (target) {
        dx = Math.sign(target.x - p.x) * (chasing ? 1 : -1); dy = Math.sign(target.y - p.y) * (chasing ? 1 : -1);
        if (!chasing) { if (p.x < 80) dx = 1; if (p.x > 820) dx = -1; if (p.y < 80) dy = 1; if (p.y > 520) dy = -1; }
      }
    } else {
      // Nur öffentlich sichtbare Laser; kein Blick auf kommende Wellen.
      jump = this.hazards.some((h) => !h.warning && (p[h.axis] - h.pos) * h.dir >= -10 && (p[h.axis] - h.pos) * h.dir <= h.speed * .25 + ARENA.radius);
    }
    this.setInput(p, dx, dy, jump);
  }
  frame() {
    return { game: this.game, runId: this.runId, round: this.roundNo, tick: this.tickNo, elapsed: this.elapsed, duration: this.settings.playSecs * 1000, kind: this.kind,
      arena: ARENA, jumping: this.canJump(),
      bodies: this.bodies.map(({ id, x, y, alive, lives, jumpUntil, jumpReady, immuneUntil }) => ({ id, x, y, alive, lives, jumpUntil, jumpReady, immuneUntil, points: this.points?.[id] || 0 })),
      ...(this.kind === 'floor' ? { tiles: [...this.tiles] } : this.kind === 'crown' ? { crown: { ...this.crown } } : { hazards: this.hazards.map((h) => ({ ...h })) }) };
  }
  gameView(id) { return { ...this.frame(), inputSeq: this.inputs.get(id)?.seq || 0 }; }
  publicPlayer(p) { return { pts: this.points?.[p.id] || 0, eliminated: this.bodies.find((b) => b.id === p.id)?.alive === false }; }
  afterChange() {
    if (this.gamePaused) return;
    if (this.phase !== 'playing') return this.stopLoop();
    if (this.loop) return;
    this.loop = this.clock.setInterval(() => { this.step(); if (this.phase === 'playing' && this.tickNo % 2 === 0) this.onChange('frame'); }, STEP_MS);
    this.loop.unref?.();
  }
  stopLoop() { this.clock.clearInterval(this.loop); this.loop = null; }
  onAbort() { this.stopLoop(); this.inputs.clear(); this.deadline = null; this.bodies = []; this.runId = null; }
  dispose() { this.stopLoop(); super.dispose(); }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}

export class FloorRoom extends RealtimeRoom {
  static KIND = 'floor';
  static OPTIONS = [...RealtimeRoom.OPTIONS, { key: 'jump', label: 'Sprung über Lücken erlauben', type: 'bool' }, { key: 'holes', label: 'Zufällige Löcher zu Beginn', type: 'bool' }];
  defaultSettings() { return { playSecs: 60, jump: false, holes: false }; }
}
export class CrownRoom extends RealtimeRoom { static KIND = 'crown'; }
export class LaserRoom extends RealtimeRoom {
  static KIND = 'laser';
  static OPTIONS = [...RealtimeRoom.OPTIONS, { key: 'lives', label: 'Leben pro Spieler', type: 'number', min: 1, max: 3 }, { key: 'doubleLaser', label: 'Zwei Laser gleichzeitig', type: 'bool' }];
  defaultSettings() { return { playSecs: 60, lives: 1, doubleLaser: false }; }
}
export const realtimeEvents = { steer: (room, p, data) => { room.input(p.id, data); return { frameOnly: true }; } };
