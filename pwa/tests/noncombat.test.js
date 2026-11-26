import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {globalPowers,startGlobalPlaytest,prepareGlobalBoard,nextPlaytestTurn,saveGlobalPosition} from '../global-game.js';
import {beginMobilization,finishMobilization} from '../mobilize.js';
import {plan,commit,retreat} from '../rules.js';
import {beginNoncombat,noncombatPosition,noncombatRoutes,completeNoncombat} from '../noncombat.js';
const asset=n=>JSON.parse(readFileSync(new URL('../assets/'+n+'.json',import.meta.url)));
const setup=asset('global-setup'),atlas=asset('world-sectors');
const seats=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,1]));
const berlin='world-germany',zone=n=>'world-'+n+'-sea-zone';
function opening(edit=()=>{}){
  const match=startGlobalPlaytest(setup,seats);edit(match.board);
  return {match,...prepareGlobalBoard(setup,atlas,match)};
}
const move=(from,type,to,quantity=1)=>({from,type,to,quantity});
function start(game){commit(game);beginNoncombat(game);return noncombatPosition(game);}
test('unused ground forces reinforce a new capture, aircraft need an original friendly landing, and drafts survive reload and undo',()=>{
  const {game,match}=opening(b=>b.France.units=[]);
  plan(game,'hb','fr',{inf:2});const preview=start(game);
  assert.equal(preview.unused.hb.inf,2);assert(!preview.unused.fr.inf);
  assert(noncombatRoutes(preview,move('hb','inf','fr')).has('fr'));
  assert(!noncombatRoutes(preview,move('hb','fighter','fr')).has('fr'));
  assert.throws(()=>noncombatPosition(game,[move('fr','inf','hb')]));
  game.noncombatOrders=[move('hb','inf','fr',2)];
  const projected=noncombatPosition(game);assert.equal(projected.unused.hb.inf,0);
  assert.deepEqual(projected.pieces,noncombatPosition(JSON.parse(JSON.stringify(game))).pieces);
  assert.throws(()=>noncombatPosition(game,[...game.noncombatOrders,move('fr','inf','hb')]));
  assert.deepEqual(noncombatPosition(game,[]).pieces,game.pieces);
  const finished=completeNoncombat(game);
  match.phase='noncombatMove';match.combat={game};assert.throws(()=>nextPlaytestTurn(match));
  saveGlobalPosition(match,finished);match.combat.game=finished;
  assert.throws(()=>nextPlaytestTurn(match),/mobilization/);
  match.combatStart=structuredClone(match.board);match.phase='mobilize';
  match.combat.game=beginMobilization(game);
  const next=finishMobilization(match,match.combat.game);assert.equal(next.power,'Russians');assert.equal(next.phase,'briefing');
  assert.equal(next.board.France.units.find(([p,t])=>p==='Germans'&&t==='infantry')[2],4);
  assert(next.turnReviews[0].record.some(r=>r.title==='Holland Belgium → France'));
});
test('neutral activation changes control only on the projected board and its garrison cannot move again',()=>{
  const {game}=opening();const g=start(game),bulgaria='world-bulgaria';
  const enter=move('ro','inf',bulgaria);
  assert(noncombatRoutes(g,enter).has(bulgaria));
  assert(!noncombatRoutes(g,move('ro','inf','world-yugoslavia')).has('world-yugoslavia'));
  const after=noncombatPosition(game,[enter]);
  assert.equal(after.owners[bulgaria],'Germany');assert.notEqual(game.owners[bulgaria],'Germany');
  assert(!after.unused[bulgaria].inf);
  assert.equal(after.pieces[bulgaria].filter(([p,t])=>p==='Germans'&&t==='inf').reduce((a,row)=>a+row[2],0),5);
});
test('a transport and its cargo each spend their move, including a load and unload in the same sea zone',()=>{
  const {game}=opening();const g=start(game);
  const crossing={...move(berlin,'artillery','pl'),transport:true,extraInf:true};
  assert.deepEqual(noncombatRoutes(g,crossing).get('pl'),[berlin,zone(114),'pl']);
  const crossed=noncombatPosition(game,[crossing]);
  assert.equal(crossed.unused[zone(114)].transport,0);
  assert.equal(crossed.unused[berlin].inf,g.unused[berlin].inf-1);
  assert.equal(crossed.unused.pl.artillery||0,0);
  assert.throws(()=>noncombatPosition(game,[crossing,crossing]));
  assert(!noncombatRoutes(g,{...crossing,quantity:2}).size);
});
test('a combat sortie may change its landing using remaining range; the same aircraft cannot fly a fresh sortie',()=>{
  const {game}=opening();
  plan(game,'hb','fr',{fighter:1});commit(game);
  game.active='fr';game.battles[0].step='decision';retreat(game,'hb');beginNoncombat(game);
  const g=noncombatPosition(game),f=g.flights[0];assert.equal(f.base,'hb');assert.equal(f.range,3);
  assert(completeNoncombat(game).record.some(r=>r.title==='France → Holland Belgium'&&r.detail.startsWith('Landing')));
  assert.equal(g.unused.hb.fighter,0);
  const landing={...move('fr','fighter','wg'),flight:0};
  assert(noncombatRoutes(g,landing).has('wg'));assert(!noncombatRoutes(g,landing).has('fr'));
  const after=noncombatPosition(game,[landing]);
  assert.equal(after.flights[0].available,0);assert.equal(after.unused.wg.fighter,g.unused.wg.fighter);
  assert.throws(()=>noncombatPosition(game,[landing,landing]));
});
test('carriers maintain berths and nationality, and damaged capital ships retain their damage when they move',()=>{
  const {game}=opening(b=>{
    b['113 Sea Zone'].units=[['Germans','carrier',1],['Italians','fighter',1],['Germans','tactical_bomber',1],['Germans','battleship',1]];
    b['113 Sea Zone'].shipDamage={Germans:{battleship:1}};
  });
  const g=start(game),ship=move(zone(113),'carrier',zone(112));
  assert(noncombatRoutes(g,ship).has(zone(112)));
  const after=noncombatPosition(game,[ship,move(zone(113),'battleship',zone(112))]);
  assert(after.pieces[zone(112)].some(([p,t,n])=>p==='Italians'&&t==='fighter'&&n===1));
  assert(!after.unused[zone(112)].tactical_bomber);
  assert.equal(after.shipDamage[zone(112)].Germans.battleship,1);assert.equal(after.shipDamage[zone(113)].Germans.battleship,0);
  assert(!noncombatRoutes(after,move('wg','fighter',zone(112))).has(zone(112)));
});
test('a stranded fighter can use a carrier brought into range and must take an available landing',()=>{
  const {game}=opening(b=>{
    b['113 Sea Zone'].units=[['Germans','carrier',1]];
  });
  start(game);
  game.landedFlights=[{from:zone(112),base:null,type:'fighter',range:0,count:1}];
  assert.match(completeNoncombat(game).record[0].detail,/lost without a landing/);
  game.noncombatOrders=[move(zone(113),'carrier',zone(112))];
  assert.throws(()=>completeNoncombat(game),/Choose a landing/);
  game.noncombatOrders.push({...move(zone(112),'fighter',zone(112)),flight:0});
  const finished=completeNoncombat(game);
  assert(finished.pieces[zone(112)].some(([p,t,n])=>p==='Germans'&&t==='fighter'&&n===1));
});
test('legacy neutral activations spend opening units and naval routes keep closed canals and hostile fleets impassable',()=>{
  const {game}=opening(b=>{b.Denmark.owner='British';});
  start(game);game.activationMoves={ro:{inf:1}};
  const g=noncombatPosition(game),battleship=move(zone(113),'battleship',zone(112));
  assert.equal(g.unused.ro.inf,game.pieces.ro.find(([,t])=>t==='inf')[2]-1);
  assert(!noncombatRoutes(g,battleship).has(zone(112)));
  assert(!noncombatRoutes(g,move('wg','inf','fr')).has('fr'));
  assert(!noncombatRoutes(g,move(berlin,'factory_major','wg')).size);
});
