import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {globalPowers,startGlobalPlaytest,prepareGlobalBoard,saveGlobalPosition,purchasePlan,productionSlots,changeFacilityOrder,confirmPurchase} from '../global-game.js';
import {places,exercises,plan,available,commit,chooseBattle,rollAttack,rollDefense,casualties,defendingRows} from '../rules.js';
import {raidTargets,chooseRaid,currentRaid,setRaidTarget,setInterceptorCount,confirmInterceptors,advanceRaid,facilityHits} from '../raids.js';
import {beginNoncombat,noncombatPosition} from '../noncombat.js';

const prev={...places},old=exercises.global;
after(()=>{
  for(const id of Object.keys(places))if(!(id in prev))delete places[id];
  Object.assign(places,prev);if(old)exercises.global=old;else delete exercises.global;
});
const asset=n=>JSON.parse(readFileSync(new URL('../assets/'+n+'.json',import.meta.url)));
const setup=asset('global-setup'),atlas=asset('world-sectors');
const seats=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,1]));
const reload=s=>JSON.parse(JSON.stringify(s));
const units=(s,id,p,t)=>s.pieces[id].filter(([power,type])=>power===p&&type===t).reduce((n,row)=>n+row[2],0);
function position(edit=()=>{}){
  const match=startGlobalPlaytest(setup,seats),board=match.board;
  board['Holland Belgium'].units=[['Germans','fighter',2],['Germans','tactical_bomber',3],['Germans','bomber',3],['Germans','infantry',3]];
  board.France.units=[['French','factory_major',1],['French','airfield',1],['French','harbour',1],['French','aaGun',2]];
  board['Normandy Bordeaux'].units=[['French','factory_minor',1],['French','harbour',1],['French','airfield',1]];
  edit(board);
  return {match,...prepareGlobalBoard(setup,atlas,match)};
}
const send=(s,type,n,target,to='fr',from='hb',path=null)=>plan(s,from,to,{[type]:n},path,target);
function step(s,expected,faces=[],losses=[]){
  let i=0;advanceRaid(s,expected,losses,()=>{assert(i<faces.length,'Unexpected die');return faces[i++];});
  assert.equal(i,faces.length);
}
test('raid and escort planning reserves individual stacks across missions, targets and ordinary attacks',()=>{
  const {game:s}=position();
  assert.deepEqual(raidTargets(s,'fr','tactical_bomber'),['airfield','harbour']);assert.deepEqual(raidTargets(s,'wg','bomber'),[]);
  assert.throws(()=>send(s,'tactical_bomber',1,'factory_major'));assert.throws(()=>send(s,'fighter',1,'escort'));
  const longRoute=[110,111,112,113].map(n=>'world-'+n+'-sea-zone').concat('wg');
  assert.throws(()=>send(s,'bomber',1,'factory_major','fr','hb',longRoute),/landing/);
  assert.throws(()=>send(s,'bomber',1,'factory_major','world-western-united-states'),/legal|facility/);
  assert.throws(()=>send(s,'bomber',1,'factory_major','fr','hb',['world-japan']),/movement/);
  send(s,'bomber',1,'airfield');send(s,'tactical_bomber',1,'airfield');send(s,'bomber',1,'factory_major');
  send(s,'bomber',1,null);send(s,'fighter',1,'escort');
  assert.equal(s.orders.length,5);assert.equal(available(s,'hb').bomber,0);
  assert.throws(()=>send(s,'bomber',2,'factory_major'),/exceeds/);
  const orphan={...s,orders:s.orders.filter(o=>!o.raid||o.raid==='escort')},before=reload(orphan);
  assert.throws(()=>commit(orphan),/escort/);assert.deepEqual(orphan,before);
  commit(s);assert.equal(s.raids[0].planes.length,4);assert.equal(s.battles[0].attack.bomber,1);
});
test('both sides fire once, bomber targeting follows interception, and each facility takes only its own casualties',()=>{
  let {game:s}=position(b=>{b.France.units.push(['British','fighter',1],['French','fighter',2]);});
  send(s,'bomber',2,'factory_major');send(s,'tactical_bomber',1,'airfield');send(s,'fighter',1,'escort');commit(s);
  assert.throws(()=>chooseRaid(s,'fr'));setInterceptorCount(s,'fr','French',1);confirmInterceptors(s);chooseRaid(s,'fr');
  assert.equal(units(s,'fr','French','fighter'),1);assert.throws(()=>confirmInterceptors(s));
  step(s,'attack',[1,5,5,5]);s=reload(s);step(s,'defense',[1,5]);assert.equal(currentRaid(s).defenseDice.length,2);
  assert.throws(()=>advanceRaid(s,'airLoss',[]));step(s,'airLoss',[],[3]);
  assert.equal(currentRaid(s).interceptors.reduce((n,f)=>n+f.remaining,0),1);
  setRaidTarget(s,0,'airfield');assert.throws(()=>setRaidTarget(s,2,'factory_major'));assert.throws(()=>setRaidTarget(s,3,'airfield'));
  step(s,'targets',[1,6,5]);assert.equal(currentRaid(s).aaDice.length,3);
  assert.throws(()=>advanceRaid(s,'aaLoss',[1]));assert.throws(()=>advanceRaid(s,'aaLoss',[0,0]));
  step(s,'aaLoss',[],[2]);s=reload(s);step(s,'damage',[4,3]);
  assert.deepEqual(s.raidDamage.fr,{airfield:6,factory_major:5});assert.equal(s.phase,'review');assert.equal(s.owners.fr,'France');
  assert.throws(()=>advanceRaid(s,'damage'));beginNoncombat(s);
  assert.equal(units(s,'hb','Germans','bomber'),3);assert.equal(units(s,'hb','Germans','fighter'),1);
  assert.equal(units(s,'hb','Germans','tactical_bomber'),2);
});
test('an unopposed raid skips interception, exempts its escort from facility fire and preserves spent range',()=>{
  let {game:s}=position();
  send(s,'fighter',1,null,'nb');send(s,'bomber',1,'airfield');send(s,'fighter',1,'escort');commit(s);
  assert.throws(()=>chooseBattle(s,'nb'),/bombing raids/);chooseRaid(s,'fr');
  step(s,'targets',[1]);assert.throws(()=>advanceRaid(s,'aaLoss',[1]));step(s,'aaLoss',[],[0]);
  assert.equal(s.phase,'combat');assert(!s.raidDamage);
  chooseBattle(s,'nb');rollAttack(s,()=>6);rollDefense(s,()=>6);casualties(s,{});
  assert.equal(s.phase,'review');s=reload(s);beginNoncombat(s);
  const g=noncombatPosition(s);assert.equal(g.unused.hb.fighter,0);assert.equal(g.flights.length,2);
  assert(g.flights.some(f=>f.from==='fr'&&f.type==='fighter'&&f.range===3&&f.base==='hb'));
});
test('all raids precede occupation, and committed fighters cannot defend twice after the raids finish',()=>{
  let {game:s,match}=position(b=>{b.France.units=b.France.units.filter(r=>r[1]!=='aaGun');b.France.units.push(['French','fighter',1]);});
  send(s,'bomber',1,'factory_major');send(s,'tactical_bomber',1,'harbour','nb');plan(s,'hb','fr',{inf:1});commit(s);
  confirmInterceptors(s);assert.equal(units(s,'fr','French','fighter'),0);
  chooseRaid(s,'fr');step(s,'attack',[4]);step(s,'defense',[4]);step(s,'airLoss');step(s,'targets',[4]);step(s,'damage',[6]);
  assert.equal(s.phase,'combat');assert.equal(s.owners.fr,'France');assert.throws(()=>chooseBattle(s,'fr'));
  s=reload(s);chooseRaid(s,'nb');step(s,'targets',[3]);step(s,'damage',[5]);
  assert.equal(s.owners.fr,'Germany');assert.equal(s.phase,'review');assert.deepEqual(defendingRows(s,'fr'),[['Germans','inf',1]]);
  saveGlobalPosition(match,s);saveGlobalPosition(match,s);
  assert.equal(facilityHits(s,'fr','factory_minor'),6);
  assert.equal(match.board.France.facilityDamage.factory_minor,6);assert(!match.board.France.facilityDamage.factory_major);
  assert.equal(facilityHits(s,'nb','harbour'),5);
  beginNoncombat(s);saveGlobalPosition(match,s);
  assert.equal(units(s,'nb','French','fighter'),1);assert(s.record.some(e=>e.title.includes('Interceptor recovery')&&e.detail.includes('diverted')));
});
test('raid damage is capped, survives reload and is repairable for one IPC per point',()=>{
  const {game:s,match}=position(b=>{b.France.facilityDamage={factory_major:18,airfield:2};b['Normandy Bordeaux'].facilityDamage={factory_minor:5};});
  send(s,'bomber',1,'factory_major');send(s,'tactical_bomber',2,'airfield');send(s,'bomber',1,'factory_minor','nb');
  commit(s);chooseRaid(s,'fr');step(s,'targets',[2,2,2]);step(s,'damage',[6,3,2]);
  chooseRaid(s,'nb');step(s,'targets',[5]);step(s,'damage',[6]);
  saveGlobalPosition(match,reload(s));saveGlobalPosition(match,reload(s));
  assert.deepEqual(match.board.France.facilityDamage,{factory_major:20,airfield:6});
  assert.equal(match.board['Normandy Bordeaux'].facilityDamage.factory_minor,6);
  assert.equal(productionSlots(match.board.France),0);assert(s.record.some(e=>e.detail.includes('Added 2 damage. Total 20 of 20')));
  match.power='French';match.phase='purchase';const money=match.treasury.French;
  let board=prepareGlobalBoard(setup,atlas,match);assert.equal(board.exercise.movement.allowance('fr','fighter'),4);
  for(let i=0;i<4;i++)changeFacilityOrder(match,'French','France','airfield',1);
  assert.equal(purchasePlan(match).cost,4);confirmPurchase(match);board.exercise.refreshBases(match.board);
  assert.equal(match.treasury.French,money-4);assert.equal(board.exercise.movement.allowance('fr','fighter'),5);
  assert.equal(match.board.France.facilityDamage.airfield,2);assert.equal(match.board.France.facilityDamage.factory_major,20);
});
test('offshore scramblers are unavailable to intercept, and declining interception leaves the other fighters at home',()=>{
  const {game:s}=position(b=>{
    b['United Kingdom'].units=[['British','airfield',1],['British','fighter',4]];
    b['110 Sea Zone'].units=[['British','destroyer',1]];b['112 Sea Zone'].units=[['Germans','cruiser',1]];
  });
  const sea=n=>'world-'+n+'-sea-zone',home='world-united-kingdom';
  send(s,'bomber',1,'airfield',home,'hb',[sea(110)]);plan(s,sea(112),sea(110),{cruiser:1});commit(s);
  assert.equal(s.scrambles[0].n,3);assert.equal(s.raids[0].interceptors[0].n,1);
  setInterceptorCount(s,home,'British',0);confirmInterceptors(s);chooseRaid(s,home);
  assert.equal(currentRaid(s).step,'targets');assert.equal(units(s,home,'British','fighter'),1);
});
