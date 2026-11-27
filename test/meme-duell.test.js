import assert from 'node:assert/strict';
import test from 'node:test';
import { MemeDuelRoom } from '../games/meme-duell/room.js';
import { GAMES } from '../games/index.js';
import { CHUNK_LENGTH, SIDE } from '../games/meme-duell/raster.js';

function table(t, mode, rounds = 2) {
  const room = new MemeDuelRoom('MEMES', {mode, rounds}, () => {});
  t.after(() => room.dispose());
  const members = ['Anna','Bo','Cleo','Dag'].map(name => {
    const p = room.addPlayer(name);
    p.connected = true;
    room.sit(p.id);
    return p.id;
  });
  const spectator = room.addPlayer('Zuschauer');
  spectator.connected = true;
  room.start(members[0]);
  return {room, members, spectator:spectator.id};
}

test('text mode deals private cards, rotates the judge, and resolves an anonymous ballot', t => {
  const {room,members:[a,b,c,d],spectator} = table(t,'text');
  assert.equal(GAMES['meme-duell'].minPlayers, 3);
  assert.equal(room.judge,a);
  const stamp = room.stamp;
  assert.equal(room.gameView(b).hand.length,7);
  assert.equal(room.gameView(spectator).hand,null);
  assert.throws(() => room.submit(a,{stamp,card:0}), /nicht mehr/);
  assert.throws(() => room.submit(spectator,{stamp,card:0}), /nicht mehr/);
  assert.throws(() => room.submit(b,{stamp,card:7}), /Hand/);
  room.submit(b,{stamp,card:0});
  assert.throws(() => room.submit(b,{stamp,card:1}), /nicht mehr/);
  assert.equal(room.gameView(c).choices,undefined);
  room.submit(c,{stamp,card:1});
  room.submit(d,{stamp,card:2});
  assert.equal(room.stage,'vote');
  const view = room.gameView(a);
  assert.ok(view.canVote);
  assert.equal(view.choices.length,3);
  assert.ok(view.choices.every(choice => !Object.hasOwn(choice,'name')));
  assert.throws(() => room.ballot(b,{stamp:room.stamp,choice:0}), /nicht abstimmen/);
  room.ballot(a,{stamp:room.stamp,choice:0});
  assert.equal(room.stage,'reveal');
  assert.equal(room.gameView(spectator).results.filter(entry => entry.winner).length,1);
  room.next(a);
  assert.equal(room.stage,'write');
  assert.equal(room.judge,b);
  assert.throws(() => room.submit(c,{stamp,card:0}), /nicht mehr/);
});

test('image mode enforces group voting without self-votes and awards tied first place', t => {
  const {room,members,spectator} = table(t,'image',1);
  room.settings.trending = false;
  for (const id of members) {
    assert.equal(new Set(room.gameView(id).hand).size,5);
    room.submit(id,{stamp:room.stamp,card:0});
  }
  assert.ok(!room.gameView(spectator).canVote);
  for (let i=0;i<members.length;i++) {
    const voter = members[i];
    const own = room.gameView(voter).choices.findIndex(choice => choice.mine);
    assert.throws(() => room.ballot(voter,{stamp:room.stamp,choice:own}), /fremden/);
    const next = room.display.indexOf(members[i ^ 1]);
    room.ballot(voter,{stamp:room.stamp,choice:next});
    assert.throws(() => room.ballot(voter,{stamp:room.stamp,choice:next}), /nicht abstimmen/);
  }
  assert.equal(room.stage,'reveal');
  assert.equal(room.gameView(spectator).results.filter(entry => entry.winner).length,4);
  assert.ok(Object.values(room.gamePts).every(points => points === 1));
  room.next(members[0]);
  assert.equal(room.phase,'over');
});

test('creator accepts bounded text and coordinates with no private text before reveal', t => {
  const {room,members:[a,b]} = table(t,'creator');
  const field = {text:'Zwei Figuren & ein Fragezeichen?', x:50,y:65,size:35,align:'left'};
  assert.throws(() => room.submit(a,{stamp:room.stamp,fields:[{...field, x: 1000}]}), /Position/);
  assert.throws(() => room.submit(a,{stamp:room.stamp,fields:[{...field, text:'x'.repeat(161)}]}), /Text/);
  assert.throws(() => room.submit(a,{stamp:room.stamp,fields:[field,field,field,field]}), /drei/);
  room.submit(a,{stamp:room.stamp,fields:[field]});
  assert.ok(!JSON.stringify(room.gameView(b)).includes(field.text));
  room.next(a);
  assert.equal(room.stage,'vote');
  assert.ok(room.gameView(b).choices.some(choice => choice.fields[0].text === field.text && !choice.mine));
  assert.ok(room.gameView(a).choices.some(choice => choice.mine));
});

test('a disconnected judge can be skipped and a late action cannot be replayed', t => {
  const {room,members:[a,b,c,d]} = table(t,'text');
  const original = room.stamp;
  room.players.get(a).connected = false;
  for (const id of [b,c,d]) room.submit(id,{stamp:original,card:0});
  assert.equal(room.stage,'reveal');
  assert.ok(Object.values(room.gamePts).every(points => points === 0));
  room.players.get(a).connected = true;
  assert.throws(() => room.ballot(a,{stamp:original,choice:0}), /nicht abstimmen/);
});

test('private room images are authorised, canonicalised, isolated and included in saves', t => {
  const room = new MemeDuelRoom('PRIVATE', {privateImages:true}, () => {});
  const other = new MemeDuelRoom('OTHER', {privateImages:true}, () => {});
  t.after(() => {room.dispose(); other.dispose();});
  const owner = room.addPlayer('Host');
  const peer = room.addPlayer('Peer');
  const outsider = other.addPlayer('Outsider');
  assert.throws(()=>room.beginImage(peer.id,'Bild'),/Host/);
  const {token} = room.beginImage(owner.id,'Privates Bild').reply;
  const data = Buffer.alloc(SIDE*SIDE*4,128).toString('base64');
  assert.throws(()=>room.acceptImageChunk(owner.id,{token,index:1,chunk:data.slice(0,CHUNK_LENGTH)}),/Bildabschnitt/);
  assert.throws(()=>room.acceptImageChunk(owner.id,{token,index:0,chunk:'x'}),/Bildabschnitt/);
  for (let offset=0,index=0; offset<data.length; offset+=CHUNK_LENGTH,index++) {
    room.acceptImageChunk(owner.id,{token,index,chunk:data.slice(offset,offset+CHUNK_LENGTH)});
  }
  const id = room.privateCards[0].id;
  const privateMedia = room.mediaFor(peer.id,[id]);
  const png = Buffer.from(privateMedia[id].split(',')[1],'base64');
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.equal(png.readUInt32BE(16),SIDE);
  assert.deepEqual(other.mediaFor(outsider.id,[id]),{});
  assert.deepEqual(room.mediaFor(outsider.id,[id]),{});
  assert.equal(room.view(peer.id).privateMemeCards,undefined);
  const restored = MemeDuelRoom.restore(room.snapshot(),()=>{});
  t.after(()=>restored.dispose());
  assert.equal(restored.mediaFor(peer.id,[id])[id],privateMedia[id]);
  assert.throws(()=>room.removeImage(peer.id,id),/Host/);
  room.removeImage(owner.id,id);
  assert.deepEqual(room.mediaFor(peer.id,[id]),{});
});
