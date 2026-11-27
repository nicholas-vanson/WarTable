import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {globalPowers,startGlobalPlaytest,nextPlaytestTurn,prepareGlobalBoard,saveGlobalPosition,changePurchase,confirmPurchase,unitPrice,purchasePlan,productionSlots,changeFacilityOrder} from '../global-game.js';
import {canResearch,buyResearch,discover,finishResearch,breakthroughs,hasTech} from '../research.js';
import {victoryStatus} from '../victory.js';
import {openIncome,rollBonds,splitBonds,bondsPending,incomeAmount,collectIncome,rollConvoys} from '../income.js';
import {dropRoom,queueDrop,researchRoutes,queueRocket,fireRocket} from '../research-moves.js';
import {places,exercises,plan,commit,available,movementFor,chooseBattle,currentBattle,rollOpening,rollAttack,casualtyLimits,casualties,retreatSites} from '../rules.js';
import {chooseRaid,currentRaid,confirmInterceptors,advanceRaid,facilityHits} from '../raids.js';

const asset=file=>JSON.parse(readFileSync(new URL('../assets/'+file+'.json',import.meta.url)));
const setup=asset('global-setup'),atlas=asset('world-sectors');
const seats=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,1]));
const fresh=()=>startGlobalPlaytest(setup,seats);
const oldPlaces={...places},oldGlobal=exercises.global;
after(()=>{
  for(const id of Object.keys(places))if(!(id in oldPlaces))delete places[id];
  Object.assign(places,oldPlaces);
  if(oldGlobal)exercises.global=oldGlobal;else delete exercises.global;
});
function handoff(m){
  m.phase='income';m.combat={game:{phase:'incomeCollected',record:[]}};
  return nextPlaytestTurn(m);
}
function setOwners(m,names,power){
  for(const name of names)m.board[name].owner=power;
}
test('Europe and Pacific require a complete uninterrupted hold by the capturing power',()=>{
  let m=fresh();
  assert.deepEqual(victoryStatus(m).map(g=>g.cities.length),[3,2,0]);
  setOwners(m,['France','Egypt','Novgorod','Volgograd','United Kingdom'],'Germans');
  m=handoff(m);
  assert.deepEqual(m.victoryHolds.europe,{power:'Germans',round:1});
  assert.equal(m.phase,'briefing');
  m.board.Novgorod.owner='Russians';m=handoff(m);assert.equal(m.victoryHolds.europe,undefined);
  setOwners(m,['Kwangtung','Philippines','India','Hawaiian Islands'],'Japanese');
  m=handoff(m);assert.deepEqual(m.victoryHolds.pacific,{power:'Japanese',round:1});
  while(m.power!=='Germans'){assert(!m.victory);m=handoff(m);}
  m.board.Novgorod.owner='Germans';m=handoff(m);assert.equal(m.victoryHolds.europe.round,2);
  m=handoff(JSON.parse(JSON.stringify(m)));
  assert.equal(m.phase,'victory');assert.equal(m.power,'Japanese');assert.equal(m.victory.key,'pacific');
  assert.equal(m.victory.round,2);assert.equal(m.victory.cities.length,6);assert.equal(m.victory.capitals.length,3);
  assert.throws(()=>nextPlaytestTurn(m),/income/);
});
test('capturing the decisive city in combat starts the timer at the income handoff',()=>{
  const m=fresh();setOwners(m,['Egypt','Russia','Novgorod','Volgograd'],'Germans');
  m.board.France.units=[];m.combatStart=structuredClone(m.board);
  assert.equal(victoryStatus(m)[0].cities.length,7);
  const {game}=prepareGlobalBoard(setup,atlas,m);
  plan(game,'hb','fr',{inf:1});commit(game);assert.equal(game.phase,'review');
  saveGlobalPosition(m,game);assert.equal(m.board.France.owner,'Germans');
  m.phase='mobilize';game.phase='mobilize';m.combat={game};openIncome(m);
  const next=collectIncome(m.incomeReport.rolled?m:rollConvoys(m,()=>.99));
  assert.deepEqual(next.victoryHolds.europe,{power:'Germans',round:1});
  assert.equal(next.phase,'briefing');assert.equal(next.power,'Russians');
});
test('Axis European and Allied capital victories require a home capital at adjudication',()=>{
  const europe=fresh();setOwners(europe,['France','Egypt','Novgorod','Volgograd','United Kingdom'],'Germans');
  let m=handoff(europe);
  while(m.power!=='Germans')m=handoff(m);
  assert.equal(m.victory.key,'europe');assert.equal(m.victory.cities.length,8);
  m=fresh();m.power='British';setOwners(m,['Germany','Southern Italy','Japan'],'British');
  setOwners(m,['France','Russia','United Kingdom','Eastern United States'],'Germans');
  m=handoff(m);
  while(m.power!=='British')m=handoff(m);
  assert(!m.victory);assert.equal(victoryStatus(m)[2].capitals.length,0);
  m.board['United Kingdom'].owner='British';
  do{m=handoff(m);}while(m.power!=='British');
  assert.equal(m.victory.side,'Allies');assert.deepEqual(m.victory.capitals,['London']);
});
test('research eligibility, British split funding, single breakthrough and duplicate rerolls persist',()=>{
  const m=fresh();m.phase='research';m.power='Chinese';assert(!canResearch(m));
  assert.throws(()=>buyResearch(m,1));m.power='British';m.researchEnabled=false;assert(!canResearch(m));
  m.researchEnabled=true;m.treasury.British=3;m.treasury.UK_Pacific=7;
  m.board['United Kingdom'].owner='Germans';assert.throws(()=>buyResearch(m,2,7));
  assert.equal(m.treasury.UK_Pacific,7);m.board['United Kingdom'].owner='British';
  m.technology.British=['submarines'];buyResearch(m,2,7,()=>6);
  assert.deepEqual(m.researchRoll.paid,{British:3,UK_Pacific:7});assert(!m.treasury.British&&!m.treasury.UK_Pacific);
  assert.throws(()=>buyResearch(m,1));assert.throws(()=>finishResearch(m,{record:[]}));
  const loaded=structuredClone(m),faces=[1,1,3];discover(loaded,1,()=>faces.shift());
  assert.deepEqual(loaded.researchRoll.breakthroughRolls,[1,1,3]);
  assert(hasTech(loaded,'UK_Pacific','shipyards'));assert(!hasTech(loaded,'Japanese','shipyards'));
  assert.throws(()=>discover(loaded,0));const game={record:[]};finishResearch(loaded,game);assert.equal(game.record.length,1);
  assert.equal(loaded.phase,'purchase');assert.equal(loaded.researchRoll,undefined);
  m.researchRoll.step='chart';m.technology.British=breakthroughs[1].map(([id])=>id);
  assert.throws(()=>discover(m,1));discover(m,0,()=>4);assert(hasTech(m,'British','factories'));
});
test('unsuccessful research and declining research proceed to purchase with exact balances',()=>{
  const m=fresh();m.phase='research';const before=m.treasury.Germans;
  assert.throws(()=>buyResearch(m,1.1));assert.throws(()=>buyResearch(m,100));assert.equal(m.treasury.Germans,before);
  buyResearch(m,1,0,()=>5);const game={record:[]};assert.throws(()=>discover(m,0));finishResearch(m,game);
  assert.equal(m.treasury.Germans,before-5);assert.match(game.record[0].title,/No breakthrough/);
  m.phase='research';finishResearch(m,game);assert.equal(game.record.length,1);
});
test('production, industrial repairs and shipyard purchases take effect immediately',()=>{
  const m=fresh();m.phase='purchase';m.technology.Germans=['factories','shipyards'];
  const a=m.board.Germany;a.units.push(['Germans','airfield',1]);a.facilityDamage={factory_major:3,airfield:2};
  assert.equal(productionSlots(a,{},true),9);assert.equal(productionSlots({units:[['Germans','factory_minor',1]]},{},true),4);
  changeFacilityOrder(m,'Germans','Germany','factory_major',1);changeFacilityOrder(m,'Germans','Germany','factory_major',1);
  assert.equal(purchasePlan(m).cost,1);
  changeFacilityOrder(m,'Germans','Germany','airfield',1);assert.equal(purchasePlan(m).cost,2);
  assert.deepEqual(['battleship','carrier','cruiser','destroyer','transport','submarine'].map(t=>unitPrice(m,t)),[17,13,9,7,6,5]);
  changePurchase(m,'battleship',1);assert.equal(purchasePlan(m).cost,19);
  const initial=m.treasury.Germans;confirmPurchase(m);assert.equal(m.treasury.Germans,initial-19);
  assert.equal(a.facilityDamage.factory_major,1);assert.equal(a.facilityDamage.airfield,1);
});
test('War Bonds roll once, survive reload and credit the elected UK treasuries on collection',()=>{
  const m=fresh();m.power='British';m.phase='mobilize';m.technology.British=['bonds'];
  m.combat={game:{phase:'mobilize',battles:[],record:[],pieces:{}}};openIncome(m);
  assert(bondsPending(m));assert.throws(()=>collectIncome(m),/War Bonds/);
  const rolled=rollBonds(m,()=>5);assert(!m.incomeReport.bondRoll);assert.throws(()=>rollBonds(rolled));
  const copy=structuredClone(rolled);splitBonds(copy,2);assert.deepEqual(copy.incomeReport.accounts.map(a=>a.bonds),[3,2]);
  assert.throws(()=>splitBonds(copy,6));const ready=copy.incomeReport.rolled?copy:rollConvoys(copy,()=>.99);
  const next=collectIncome(ready);for(const a of ready.incomeReport.accounts)assert.equal(next.treasury[a.wallet],a.before+incomeAmount(a));
});
function forces(technology,edit){
  const m=fresh();m.technology=technology;edit(m.board);
  return prepareGlobalBoard(setup,atlas,m).game;
}
test('paratroopers reserve infantry, require a supporting attack, take radar fire and retreat overland',()=>{
  const s=forces({Germans:['paratroopers'],French:['radar']},b=>{
    b['Western Germany'].units=[['Germans','airfield',1],['Germans','infantry',3]];
    b['Holland Belgium'].units=[['Germans','infantry',4]];b.France.units=[['French','aaGun',1],['French','infantry',4]];
  });
  assert(!researchRoutes(s,'wg','paratroopers').has('fr'));
  plan(s,'hb','fr',{inf:4});assert(researchRoutes(s,'wg','paratroopers').has('fr'));
  queueDrop(s,'wg','fr',2);assert.equal(dropRoom(s,'wg'),0);assert.equal(available(s,'wg').inf,1);assert.throws(()=>queueDrop(s,'wg','fr',1));
  assert.throws(()=>commit({...s,orders:s.orders.filter(o=>o.drop)}),/ground/);
  commit(s);chooseBattle(s,'fr');const b=currentBattle(s);rollOpening(s,()=>2);
  assert.equal(b.openingDice.defense.length,2);assert.equal(b.hits,2);assert.equal(casualtyLimits(s,b).inf,2);
  casualties(s,{inf:2});assert.equal(b.attack.inf,4);assert.equal(b.paratroops,0);assert.deepEqual(retreatSites(s,b),['hb']);
});
test('rockets use owned operating bases, reserve one shot each, cap damage and finish combat',()=>{
  const s=forces({Germans:['rockets']},b=>{
    b['Western Germany'].units=[['Germans','airfield',1]];
    b['Holland Belgium'].units=[['Germans','airfield',1]];b['Holland Belgium'].facilityDamage={airfield:3};
    b.France.units=[['French','factory_major',1],['French','airfield',1]];b.France.facilityDamage={airfield:5};
  });
  assert(!researchRoutes(s,'hb','rockets').size);assert(researchRoutes(s,'wg','rockets').get('fr').length<=5);
  assert.throws(()=>queueRocket(s,'wg','fr','harbour'));queueRocket(s,'wg','fr','factory_major');queueRocket(s,'wg','fr','airfield');
  assert.equal(s.rocketOrders.length,1);assert.throws(()=>fireRocket(s,'wg'));
  commit(s);assert.equal(s.phase,'combat');fireRocket(s,'wg',()=>5);
  assert.equal(s.phase,'review');assert.equal(facilityHits(s,'fr','airfield'),6);assert.throws(()=>fireRocket(s,'wg'));
});
test('artillery, mechanized, jet and heavy advances modify the correct dice and flight budget',()=>{
  const s=forces({Germans:['artillery','mechanized','jets','heavy','range']},b=>{
    b['Holland Belgium'].units=[['Germans','infantry',2],['Germans','artillery',1],['Germans','mech_infantry',1],['Germans','armour',1],['Germans','fighter',1],['Germans','bomber',1]];
    b.France.units=[['French','infantry',10]];
  });
  assert.equal(movementFor(s,'hb','fighter').range,5);assert.equal(movementFor(s,'hb','bomber').range,7);
  plan(s,'hb','fr',{inf:2,artillery:1,mech_infantry:1,tank:1,fighter:1,bomber:1});commit(s);chooseBattle(s,'fr');
  const faces=[2,2,2,2,2,4,6,1];rollAttack(s,()=>faces.shift());
  const dice=currentBattle(s).dice.attack;
  assert.deepEqual(dice.filter(d=>d.type==='inf').map(d=>d.threshold),[2,2]);assert.equal(dice.find(d=>d.type==='mech_infantry').threshold,2);
  assert.equal(dice.find(d=>d.type==='fighter').threshold,4);assert.deepEqual(dice.find(d=>d.type==='bomber').rolls,[6,1]);
  assert.equal(dice.find(d=>d.type==='bomber').face,1);
});
test('heavy bombers and jet fighters use raid air combat thresholds, Radar and better damage dice',()=>{
  const s=forces({Germans:['heavy','jets'],French:['radar','jets']},b=>{
    b['Holland Belgium'].units=[['Germans','bomber',2],['Germans','fighter',1]];
    b.France.units=[['French','fighter',1],['French','factory_major',1]];
  });
  plan(s,'hb','fr',{bomber:2},null,'factory_major');plan(s,'hb','fr',{fighter:1},null,'escort');
  commit(s);confirmInterceptors(s);chooseRaid(s,'fr');
  const step=(name,faces,losses=[])=>advanceRaid(s,name,losses,()=>faces.shift());
  step('attack',[4,1,6,5,2]);step('defense',[2]);const r=currentRaid(s);
  assert.equal(r.attackDice[0].face,1);assert.equal(r.attackDice[2].threshold,2);assert.equal(r.defenseDice[0].threshold,2);
  step('airLoss',[],[2]);step('targets',[2,6]);step('aaLoss',[],[0]);step('damage',[2,5]);
  assert.deepEqual(r.damageDice[0].rolls,[2,5]);assert.equal(facilityHits(s,'fr','factory_major'),7);
});
test('mechanized infantry blitz independently and super submarines hit on three in surprise strikes',()=>{
  const s=forces({Germans:['mechanized','submarines']},b=>{
    b['Holland Belgium'].units=[['Germans','mech_infantry',1]];b.France.units=[];
    b['110 Sea Zone'].units=[['Germans','submarine',1]];b['111 Sea Zone'].units=[['British','cruiser',1]];
  });
  const a='world-110-sea-zone',z='world-111-sea-zone';
  assert(movementFor(s,'hb','mech_infantry').legal('nb',['fr']));
  plan(s,'hb','nb',{mech_infantry:1},['fr']);plan(s,a,z,{submarine:1});commit(s);
  assert.equal(s.owners.fr,'Germany');chooseBattle(s,z);rollOpening(s,()=>3);
  const d=currentBattle(s).openingDice.attack[0];assert.equal(d.threshold,3);assert(d.hit);
});
