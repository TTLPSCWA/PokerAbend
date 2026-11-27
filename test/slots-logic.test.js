import test from 'node:test';
import assert from 'node:assert/strict';
import * as slots from '../public/singleplayer/slots-logic.js';

const {MACHINES}=slots;
const win=(id,cols)=>slots.evaluate(MACHINES[id],cols);

test('three machines with distinct mechanics, virtual chips only',()=>{
  assert.deepEqual(slots.MACHINE_IDS,['lucky-sevens','neon-nights','dragons-fortune']);
  assert.equal(MACHINES['lucky-sevens'].reels,3);assert.equal(MACHINES['neon-nights'].mode,'lines');assert.equal(MACHINES['dragons-fortune'].mode,'ways');
  assert.equal(MACHINES['neon-nights'].free.multiplier,'fixed');assert.equal(MACHINES['dragons-fortune'].free.multiplier,'ramp');
  for(const m of Object.values(slots.MACHINES)){assert.equal(m.strips.length,m.reels);for(const b of m.bets)assert.equal(b%m.divisor,0);}
});

test('lucky sevens pays on the middle line only; two cherries from the left pay',()=>{
  const m='lucky-sevens';
  assert.equal(win(m,[['bar','seven','bar'],['lemon','seven','lemon'],['bell','seven','bell']]).units,150);
  assert.equal(win(m,[['seven','cherry','seven'],['seven','cherry','seven'],['seven','bell','seven']]).units,3);
  assert.equal(win(m,[['cherry','bell','cherry'],['cherry','lemon','cherry'],['cherry','star','cherry']]).units,0,'outer rows have no payline');
  assert.equal(win(m,[['x','lemon','x'],['x','lemon','x'],['x','lemon','x']]).units,10);
});

test('neon nights: wild substitutes, scatter breaks a line, scatter count by reel',()=>{
  const m='neon-nights',f=(sym)=>[sym,sym,sym];
  const col=(mid)=>['jack',mid,'queen'];
  let r=win(m,[col('robot'),col('wild'),col('robot'),col('vinyl'),col('ace')]);
  const line1=r.wins.find((w)=>w.line===0);assert.equal(line1.count,3);assert.equal(line1.mult,8);
  r=win(m,[col('robot'),col('scatter'),col('robot'),col('robot'),col('robot')]);
  assert.equal(r.wins.find((w)=>w.line===0),undefined);assert.equal(r.scatters,1);
  r=win(m,[col('scatter'),['scatter','scatter','jack'],col('scatter'),col('ace'),col('king')]);
  assert.equal(r.scatters,3,'several scatters on one reel count once');
  assert.equal(f('a').length,3);
});

test('dragons fortune counts ways with wilds on inner reels',()=>{
  const m='dragons-fortune';
  const r=win(m,[['dragon','coin','gem'],['wild','dragon','coin'],['dragon','dragon','sword'],['gem','coin','shield'],['rune','gem','sword']]);
  const d=r.wins.find((w)=>w.symbol==='dragon');
  assert.equal(d.count,3);assert.equal(d.ways,1*2*2);assert.equal(d.mult,4*4);
});

test('exact RTP stays within a transparent 90-98 percent band and matches simulation',()=>{
  for(const m of Object.values(MACHINES)){
    const exact=slots.exactRtp(m);assert.ok(exact.total>.9&&exact.total<.98,`${m.id} ${exact.total}`);
    const s=slots.create({machine:m.id,seed:7,balance:slots.MAX_BALANCE});const bet=m.bets[0];slots.setBet(s,bet);
    const n=m.reels===3?60000:30000;let paid=0;
    for(let i=0;i<n;i++){const o=slots.spin(s);paid+=o.total;slots.settle(s);}
    const sim=paid/(n*bet);assert.ok(Math.abs(sim-exact.total)<(m.reels===3?.05:.2),`${m.id} sim ${sim} exact ${exact.total}`);
  }
});

test('spin settles the full result once; double clicks and repeated animation ends cannot duplicate chips',()=>{
  const s=slots.create({machine:'neon-nights',seed:3});const start=s.balance;
  const o=slots.spin(s);assert.ok(o);assert.equal(slots.spin(s),null,'second click while animating is ignored');
  assert.equal(s.balance,start-s.bet+o.total);assert.equal(slots.settle(s),true);assert.equal(slots.settle(s),false);
  assert.equal(s.balance,start-s.bet+o.total,'settling changes nothing');
  assert.equal(o.total,o.baseWin+o.bonusWin);assert.equal(s.stats.wagered,s.bet);assert.equal(s.stats.won,o.total);
});

test('spins are reproducible for equal seeds and the balance always reconciles with the statistics',()=>{
  const run=()=>{const s=slots.create({machine:'dragons-fortune',seed:99});const out=[];for(let i=0;i<300&&slots.canSpin(s);i++){out.push(slots.spin(s).total);slots.settle(s);}return {s,out};};
  const a=run(),b=run();assert.deepEqual(a.out,b.out);
  const {s}=a;assert.equal(s.balance,slots.START_BALANCE-s.stats.wagered+s.stats.won);
});

test('invalid bets and insufficient balance are rejected; free reset only when broke',()=>{
  const s=slots.create({machine:'lucky-sevens',seed:1,balance:7});
  assert.equal(slots.setBet(s,13),false);assert.equal(slots.setBet(s,5),true);assert.equal(slots.reset(s),false,'not broke yet');
  assert.ok(slots.spin(s));slots.settle(s);
  s.balance=2;assert.equal(slots.canSpin(s),false);assert.equal(slots.spin(s),null);assert.equal(slots.needsReset(s),true);
  assert.equal(slots.reset(s),true);assert.equal(s.balance,slots.START_BALANCE);assert.equal(s.stats.resets,1);
});

test('restore validates saved data and drops running animations',()=>{
  const s=slots.create({machine:'neon-nights',seed:5});slots.spin(s);
  const saved=JSON.parse(JSON.stringify(slots.serialize(s)));const r=slots.restore(saved);
  assert.equal(r.balance,s.balance);assert.equal(r.busy,false);assert.equal(r.last,null);assert.deepEqual(r.stats,s.stats);
  for(const bad of [null,{},{...saved,machine:'x'},{...saved,balance:-1},{...saved,balance:1.5},{...saved,bet:3},{...saved,seed:-4},{...saved,stats:{...saved.stats,won:'9'}},{...saved,stats:null}])assert.equal(slots.restore(bad),null);
});
