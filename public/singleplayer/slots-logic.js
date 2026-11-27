// Slot Arcade (SOLO-SLOTS-01): reine, lokale Spielautomaten-Logik mit virtuellen Chips ohne Geldwert.
// Das gesamte Ergebnis eines Spins (inklusive Freispiele) wird in spin() festgelegt und gutgeschrieben,
// bevor die Oberfläche animiert. Die Animation kann Chips weder erzeugen noch verdoppeln.
import {next,integer} from './random.js';

export const START_BALANCE=1000;
export const MAX_BALANCE=1e12;

// Gleichmäßig verteilter Walzenstreifen aus Symbolanzahlen: {symbol: anzahl}. Deterministisch.
export function strip(counts){
  const items=[];let order=0;
  for(const [sym,n] of Object.entries(counts)){for(let k=0;k<n;k++)items.push({sym,at:(k+.5)/n,order});order++;}
  return items.sort((a,b)=>a.at-b.at||a.order-b.order).map((i)=>i.sym);
}

const LINES10=[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,0,1,0]];

// pays: Vielfache des Einsatzes pro Linie (lines) beziehungsweise pro 1/20 Einsatz und Weg (ways).
export const MACHINES={
  'lucky-sevens':{
    id:'lucky-sevens',name:'Lucky Sevens',mode:'lines',reels:3,rows:3,divisor:1,lines:[[1,1,1]],bets:[5,10,25,50,100],
    strips:Array(3).fill(strip({cherry:5,lemon:4,bell:3,star:2,seven:1,bar:1})),
    wild:null,scatter:null,
    pays:{seven:{3:150},star:{3:50},bell:{3:25},bar:{3:15},lemon:{3:10},cherry:{3:10,2:3}},
    free:null
  },
  'neon-nights':{
    id:'neon-nights',name:'Neon Nights',mode:'lines',reels:5,rows:3,divisor:10,lines:LINES10,bets:[10,20,50,100,200],
    strips:[strip({neon7:1,robot:1,car:1,vinyl:2,ace:2,king:1,queen:1,jack:2,scatter:1}),strip({neon7:1,robot:1,car:1,vinyl:2,ace:2,king:1,queen:1,jack:1,wild:1,scatter:1}),strip({neon7:1,robot:1,car:1,vinyl:2,ace:2,king:1,queen:1,jack:1,wild:1,scatter:1}),strip({neon7:1,robot:1,car:1,vinyl:2,ace:2,king:1,queen:1,jack:1,wild:1,scatter:1}),strip({neon7:1,robot:1,car:1,vinyl:2,ace:2,king:1,queen:1,jack:2,scatter:1})],
    wild:'wild',scatter:'scatter',
    pays:{neon7:{3:15,4:80,5:400},robot:{3:8,4:35,5:150},car:{3:6,4:20,5:80},vinyl:{3:5,4:15,5:50},ace:{3:3,4:8,5:25},king:{3:2,4:6,5:20},queen:{3:2,4:5,5:15},jack:{3:2,4:4,5:10}},
    scatterPays:{3:1,4:4,5:20},
    free:{spins:{3:7,4:10,5:16},multiplier:'fixed',value:2}
  },
  'dragons-fortune':{
    id:'dragons-fortune',name:"Dragon's Fortune",mode:'ways',reels:5,rows:3,divisor:20,bets:[20,40,100,200,400],
    strips:[strip({dragon:1,rune:1,crystal:1,chest:1,sword:2,shield:2,gem:1,coin:2,scatter:1}),strip({dragon:1,rune:1,crystal:1,chest:1,sword:2,shield:2,gem:1,coin:1,wild:1,scatter:1}),strip({dragon:1,rune:1,crystal:1,chest:1,sword:2,shield:2,gem:1,coin:1,wild:1,scatter:1}),strip({dragon:1,rune:1,crystal:1,chest:1,sword:2,shield:2,gem:1,coin:1,wild:1,scatter:1}),strip({dragon:1,rune:1,crystal:1,chest:1,sword:2,shield:2,gem:1,coin:2,scatter:1})],
    wild:'wild',scatter:'scatter',
    pays:{dragon:{3:4,4:20,5:100},rune:{3:3,4:10,5:50},crystal:{3:3,4:8,5:40},chest:{3:2,4:6,5:25},sword:{3:2,4:4,5:12},shield:{3:1,4:3,5:10},gem:{3:1,4:3,5:8},coin:{3:1,4:2,5:6}},
    scatterPays:{3:1,4:5,5:25},
    free:{spins:{3:4,4:6,5:10},multiplier:'ramp',start:1,step:1,max:5}
  }
};
export const MACHINE_IDS=Object.keys(MACHINES);

const stripLen=(m,r)=>m.strips[r].length;
export function windowAt(m,stops){return stops.map((p,r)=>Array.from({length:m.rows},(_,k)=>m.strips[r][(p+k)%stripLen(m,r)]));}

// Bewertet ein Walzenfenster (window[reel][row]). Liefert Gewinne in Einsatzvielfachen*divisor ("Einheiten") und Scatter-Anzahl.
export function evaluate(m,window){
  const wins=[];let units=0;
  const pay=(sym,n)=>m.pays[sym]?.[n]||0;
  if(m.mode==='lines'){
    m.lines.forEach((line,li)=>{
      const cells=line.map((row,r)=>window[r][row]);
      let base=null;for(const c of cells){if(c===m.scatter)break;if(c!==m.wild){base=c;break;}}
      if(!base){if(cells[0]===m.wild){let n=0;while(n<cells.length&&cells[n]===m.wild)n++;const p=pay(m.wild,n);if(p){wins.push({line:li,symbol:m.wild,count:n,mult:p,positions:cells.slice(0,n).map((_,r)=>[r,line[r]])});units+=p;}}return;}
      let n=0;while(n<cells.length&&(cells[n]===base||cells[n]===m.wild))n++;
      const p=pay(base,n);if(p){wins.push({line:li,symbol:base,count:n,mult:p,positions:cells.slice(0,n).map((_,r)=>[r,line[r]])});units+=p;}
    });
  }else{
    const symbols=Object.keys(m.pays);
    for(const sym of symbols){
      let ways=1,n=0;const positions=[];
      for(let r=0;r<m.reels;r++){
        const hit=[];window[r].forEach((c,row)=>{if(c===sym||(c===m.wild&&sym!==m.scatter))hit.push([r,row]);});
        if(!hit.length)break;ways*=hit.length;n++;positions.push(...hit);
      }
      const p=pay(sym,n);if(p){wins.push({symbol:sym,count:n,ways,mult:p*ways,positions});units+=p*ways;}
    }
  }
  const scatters=m.scatter?window.filter((reel)=>reel.includes(m.scatter)).length:0; // Walzen mit mindestens einem Scatter
  return {wins,units,scatters};
}
const scatterUnits=(m,n)=>(m.scatterPays?.[Math.min(n,m.reels)]||0)*m.divisor; // Scatter zahlt Vielfache des Gesamteinsatzes
const freeCount=(m,n)=>m.free?.spins[Math.min(n,m.reels)]||0;
const multiplierAt=(f,i)=>f.multiplier==='ramp'?Math.min(f.max,f.start+f.step*i):f.value;
const money=(m,bet,units)=>Math.floor(units*bet/m.divisor); // bets sind Vielfache von divisor -> ganzzahlig

function draw(m,s){const stops=[];for(let r=0;r<m.reels;r++){const x=next(s.seed);s.seed=x.seed;stops.push(Math.floor(x.value*stripLen(m,r)));}return stops;}

export function create({machine='lucky-sevens',seed=1,balance=START_BALANCE}={}){
  const m=MACHINES[machine];if(!m)throw new Error('unknown machine');
  return {id:`slot-${machine}-${seed>>>0}`,machine,seed:seed>>>0,balance,bet:m.bets[1],spins:0,busy:false,
    stats:{spins:0,wagered:0,won:0,biggestWin:0,bonusRounds:0,freeSpinsPlayed:0,bestBalance:balance,resets:0},last:null};
}

export function setBet(s,bet){const m=MACHINES[s.machine];if(!m.bets.includes(bet))return false;s.bet=bet;return true;}
export const canSpin=(s)=>!s.busy&&s.balance>=s.bet&&MACHINES[s.machine].bets.includes(s.bet);
export const needsReset=(s)=>s.balance<MACHINES[s.machine].bets[0];

// Führt einen kompletten Spin atomar aus: Einsatz abziehen, Ergebnis festlegen, Gewinn gutschreiben.
// s.busy sperrt Mehrfachaufrufe bis settle() (Ende der Animation); ein erneuter Aufruf rechnet nichts doppelt.
export function spin(s){
  if(!canSpin(s))return null;
  const m=MACHINES[s.machine],bet=s.bet;
  s.balance-=bet;s.stats.wagered+=bet;s.stats.spins++;s.spins++;
  const stops=draw(m,s),window=windowAt(m,stops),base=evaluate(m,window);
  let total=money(m,bet,base.units+scatterUnits(m,base.scatters));
  const out={id:s.spins,machine:s.machine,bet,stops,window,wins:base.wins,scatters:base.scatters,baseWin:total,free:[],bonusWin:0,total:0};
  const n=freeCount(m,base.scatters);
  if(n){
    s.stats.bonusRounds++;
    for(let i=0;i<n;i++){
      const st=draw(m,s),w=windowAt(m,st),ev=evaluate(m,w),mult=multiplierAt(m.free,i),win=money(m,bet,ev.units)*mult;
      out.free.push({stops:st,window:w,wins:ev.wins,multiplier:mult,win});out.bonusWin+=win;
    }
    s.stats.freeSpinsPlayed+=n;
  }
  out.uncappedTotal=total+out.bonusWin;
  out.total=Math.min(MAX_BALANCE-s.balance,out.uncappedTotal);
  s.balance+=out.total;
  s.stats.won+=out.total;s.stats.biggestWin=Math.max(s.stats.biggestWin,out.total);s.stats.bestBalance=Math.max(s.stats.bestBalance,s.balance);
  s.last=out;s.busy=true;return out;
}
export function settle(s){const was=s.busy;s.busy=false;return was;}

// Kostenloser, klar gekennzeichneter Reset nur bei Guthabenmangel.
export function reset(s){if(s.busy||!needsReset(s))return false;s.balance=START_BALANCE;s.busy=false;s.stats.resets++;return true;}

// Exakte Auszahlungsquote (Return to Player) durch Aufzählung aller Walzenstellungen.
export function exactRtp(m){
  const lens=m.strips.map((x)=>x.length);let combos=1;lens.forEach((l)=>combos*=l);
  let sumUnits=0,sumScatterUnits=0;const pn={};
  const stops=Array(m.reels).fill(0);
  for(let i=0;i<combos;i++){
    let k=i;for(let r=0;r<m.reels;r++){stops[r]=k%lens[r];k=(k-stops[r])/lens[r];}
    const ev=evaluate(m,windowAt(m,stops));sumUnits+=ev.units;sumScatterUnits+=scatterUnits(m,ev.scatters);pn[ev.scatters]=(pn[ev.scatters]||0)+1;
  }
  const meanLine=sumUnits/combos;let bonus=0;
  if(m.free)for(const [n,c] of Object.entries(pn)){const sp=freeCount(m,+n);if(!sp)continue;let mults=0;for(let i=0;i<sp;i++)mults+=multiplierAt(m.free,i);bonus+=c/combos*mults*meanLine;}
  const base=(meanLine+sumScatterUnits/combos)/m.divisor;
  return {combos,base,bonus:bonus/m.divisor,total:base+bonus/m.divisor};
}

const STAT_KEYS=['spins','wagered','won','biggestWin','bonusRounds','freeSpinsPlayed','bestBalance','resets'];
export function restore(x){
  const m=x&&MACHINES[x.machine];
  if(!m||!integer(x.seed,0,2**32-1)||!integer(x.balance,0,MAX_BALANCE)||!m.bets.includes(x.bet)||!integer(x.spins,0,2**40))return null;
  if(!x.stats||!STAT_KEYS.every((k)=>integer(x.stats[k],0,2**50)))return null;
  const stats={};for(const k of STAT_KEYS)stats[k]=x.stats[k];
  // Eine laufende Animation wird beim Laden verworfen; das Ergebnis ist bereits gutgeschrieben.
  return {id:typeof x.id==='string'?x.id.slice(0,60):`slot-${x.machine}-restored`,machine:x.machine,seed:x.seed,balance:x.balance,bet:x.bet,spins:x.spins,busy:false,stats,last:null};
}
export const serialize=(s)=>({id:s.id,machine:s.machine,seed:s.seed,balance:s.balance,bet:s.bet,spins:s.spins,stats:{...s.stats}});
