import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {globalPowers,startGlobalPlaytest,prepareGlobalBoard,saveGlobalPosition,confirmPurchase,purchasePlan} from '../global-game.js';
import {exercises,places,plan,commit,chooseBattle,rollAttack,rollDefense,casualties,changeFrenchDraft,placeFrenchAward} from '../rules.js';
import {reverseCapitalPayments} from '../occupation.js';
import {beginNoncombat} from '../noncombat.js';
import {beginMobilization,finishMobilization} from '../mobilize.js';
import {collectIncome,rollConvoys} from '../income.js';
const asset=n=>JSON.parse(readFileSync(new URL('../assets/'+n+'.json',import.meta.url)));
const setup=asset('global-setup'),atlas=asset('world-sectors');
const seats=Object.fromEntries(Object.keys(globalPowers).map(k=>[k,1]));
let oldPlaces,oldExercise;
beforeEach(()=>{oldPlaces={...places};oldExercise=exercises.global;});
afterEach(()=>{
  for(const key of Object.keys(places))if(!Object.hasOwn(oldPlaces,key))delete places[key];
  Object.assign(places,oldPlaces);
  if(oldExercise)exercises.global=oldExercise;else delete exercises.global;
});
function turn(power,edit){
  const m=startGlobalPlaytest(setup,seats);m.power=power;m.phase='purchase';edit(m.board,m);confirmPurchase(m);
  m.combatStart=structuredClone(m.board);const {game:g,exercise:ex}=prepareGlobalBoard(setup,atlas,m);
  m.combat={game:g};return {m,g,ex};
}
const save=(m,g)=>saveGlobalPosition(m,g);
function place(m,g){
  beginNoncombat(g);const s=beginMobilization(g);m.combat={game:s};m.phase='mobilize';
  return finishMobilization(m,s);
}
function defendParis(board){
  board.France.units=[['French','infantry',1],['French','factory_major',1]];
  board.France.facilityDamage={factory_major:8};
}
test('a resolved land battle takes the actual unspent treasury once and restart reverses it',()=>{
  const {m,g}=turn('Germans',(b,m)=>{defendParis(b);m.treasury.French=14;});
  plan(g,'hb','fr',{inf:2});commit(g);chooseBattle(g,'fr');
  rollAttack(g,()=>1);rollDefense(g,()=>6);casualties(g,{});
  save(m,g);save(m,JSON.parse(JSON.stringify(g)));
  assert.equal(m.board.France.owner,'Germans');assert.equal(m.treasury.French,0);assert.equal(m.treasury.Germans,44);
  assert.deepEqual(m.board.France.units.find(([,t])=>t==='factory_minor'),['Germans','factory_minor',1]);
  assert.deepEqual(m.board.France.facilityDamage,{factory_minor:6});
  assert.equal(g.record.filter(e=>e.seizure).length,1);assert.equal(g.record.find(e=>e.seizure).seizure.amount,14);
  assert.equal(purchasePlan({...m,power:'French'},'French').allowed,false);
  reverseCapitalPayments(m);assert.equal(m.treasury.French,14);assert.equal(m.treasury.Germans,30);
  const next=collectIncome(place(m,g));
  assert.equal(next.treasury.French,0);assert.equal(next.treasury.Germans,44+44);assert.equal(next.turnCapitalPayments,undefined);
});
test('an air-only win does not occupy Paris or seize its treasury',()=>{
  const {m,g}=turn('Germans',b=>{defendParis(b);b['Holland Belgium'].units.push(['Germans','fighter',1]);});
  plan(g,'hb','fr',{fighter:1});commit(g);chooseBattle(g,'fr');rollAttack(g,()=>1);rollDefense(g,()=>6);casualties(g,{});save(m,g);
  assert.equal(m.board.France.owner,'French');assert.equal(m.treasury.French,19);assert(!g.record.some(e=>e.seizure));
});
test('first liberation restores friendly-held French territory, keeps foreign troops, and pauses for French free placement',()=>{
  const {m,g}=turn('British',b=>{
    b.France.owner='Germans';b.France.units=[['Germans','factory_minor',1]];b.France.facilityDamage={factory_minor:3};
    b['Normandy Bordeaux'].owner='British';b['Normandy Bordeaux'].units=[['British','infantry',2],['British','factory_minor',1]];
    b['Southern France'].owner='Italians';
  });
  const before={...m.treasury};plan(g,'nb','fr',{inf:1});commit(g);save(m,g);
  assert.equal(m.board.France.owner,'French');assert.equal(m.board['Normandy Bordeaux'].owner,'French');assert.equal(m.board['Southern France'].owner,'Italians');
  assert.deepEqual(m.board.France.facilityDamage,{factory_minor:3});assert(m.board.France.units.some(([p,t])=>p==='British'&&t==='infantry'));
  assert(m.board['Normandy Bordeaux'].units.some(([p,t])=>p==='French'&&t==='factory_minor'));assert.deepEqual(before,m.treasury);
  assert.throws(()=>beginNoncombat(g));assert.throws(()=>changeFrenchDraft(g,'carrier',1));assert.throws(()=>changeFrenchDraft(g,'transport',1));
  changeFrenchDraft(g,'tank',1);changeFrenchDraft(g,'inf',1);changeFrenchDraft(g,'inf',1);assert.throws(()=>changeFrenchDraft(g,'inf',1));
  const resumed=JSON.parse(JSON.stringify(g));placeFrenchAward(resumed);assert.throws(()=>placeFrenchAward(resumed));save(m,resumed);
  assert.deepEqual(m.board.France.units.find(([p,t])=>p==='French'&&t==='armour'),['French','armour',1]);
  assert.deepEqual(m.board.France.units.find(([p,t])=>p==='French'&&t==='infantry'),['French','infantry',2]);
  assert.deepEqual(m.treasury,before);
  const next=place(m,resumed);const end=next.incomeReport.rolled?next:rollConvoys(next,()=>.99);
  assert.equal(collectIncome(end).frenchLiberationAwarded,true);
  const again=turn('British',(b,m)=>{m.frenchLiberationAwarded=true;b.France.owner='Germans';b.France.units=[];b['Normandy Bordeaux'].owner='British';b['Normandy Bordeaux'].units=[['British','infantry',1]];});
  plan(again.g,'nb','fr',{inf:1});commit(again.g);assert.equal(again.g.frenchAward,undefined);
});
test('regional capitals seize only their wallet and Britain receives Axis capital IPCs in the correct economy, even in exile',()=>{
  const {m,g,ex}=turn('Germans',()=>{});ex.occupy(g,'world-united-kingdom');save(m,g);
  assert.equal(m.treasury.British,0);assert.equal(m.treasury.UK_Pacific,17);assert.equal(m.treasury.Germans,58);
  const uk=turn('British',b=>{b.India.owner='Japanese';b['United Kingdom'].owner='Germans';});
  uk.ex.occupy(uk.g,'world-japan');uk.ex.occupy(uk.g,'world-germany');save(uk.m,uk.g);
  assert.equal(uk.m.treasury.British,58);assert.equal(uk.m.treasury.UK_Pacific,43);
  assert.equal(uk.m.treasury.Japanese,0);assert.equal(uk.m.treasury.Germans,0);
  const j=turn('Japanese',()=>{});j.ex.occupy(j.g,'world-india');save(j.m,j.g);
  assert.equal(j.m.treasury.UK_Pacific,0);assert.equal(j.m.treasury.British,28);
});
test('China, overseas liberation and same-turn control are resolved against the original owner and living capital',()=>{
  const {m,g,ex}=turn('British',b=>{b.France.owner='Germans';b['Normandy Bordeaux'].owner='Germans';b.Kiangsu.units=[['Japanese','factory_minor',1],['Japanese','airfield',1]];b.Kiangsu.facilityDamage={factory_minor:4,airfield:2};});
  ex.occupy(g,'nb');assert.equal(g.owners.nb,'United Kingdom');
  ex.occupy(g,'fr');assert.equal(g.owners.nb,'France');placeFrenchAward(g);
  ex.occupy(g,'world-kiangsu');save(m,g);assert.equal(m.board.Kiangsu.owner,'Chinese');assert.deepEqual(m.board.Kiangsu.units,[['Chinese','airfield',1]]);
  assert.deepEqual(m.board.Kiangsu.facilityDamage,{airfield:2});
  const c=turn('Chinese',b=>{b.India.owner='Japanese';b.Burma.owner='Japanese';});
  c.ex.occupy(c.g,'world-burma');save(c.m,c.g);assert.equal(c.m.board.Burma.owner,'Chinese');
  const india=turn('British',b=>{b.Burma.owner='Chinese';b.India.owner='Japanese';b.Egypt.owner='ANZAC';});
  india.ex.occupy(india.g,'world-india');save(india.m,india.g);
  assert.equal(india.m.board.Burma.owner,'UK_Pacific');assert.equal(india.m.board.Egypt.owner,'ANZAC');
});
test('a tank blitz can free Paris and the award resumes remaining automatic battles once',()=>{
  const {m,g}=turn('British',b=>{
    b.France.owner='Germans';b.France.units=[];
    b['Normandy Bordeaux'].owner='British';b['Normandy Bordeaux'].units=[['British','armour',1],['British','infantry',1]];
  });
  plan(g,'nb','nb',{tank:1},'fr');plan(g,'nb','fr',{inf:1});commit(g);
  assert.equal(g.frenchAward.status,'pending');assert.throws(()=>chooseBattle(g,'fr'));
  placeFrenchAward(g);save(m,g);assert.equal(g.phase,'review');assert.equal(g.record.filter(e=>e.title==='Paris liberated').length,1);
  assert.equal(m.board.France.owner,'French');assert(m.board.France.units.some(([p,t,n])=>p==='British'&&t==='infantry'&&n===1));
});

test('an unresolved combat saved before capital payments existed settles its first capture once',()=>{
  const {m,g}=turn('Germans',b=>defendParis(b));
  plan(g,'hb','fr',{inf:2});commit(g);chooseBattle(g,'fr');rollAttack(g,()=>1);
  const old=JSON.parse(JSON.stringify(m));const restored=old.combat.game;
  assert.equal(restored.controlChanges,undefined);assert.equal(old.turnCapitalPayments,undefined);
  prepareGlobalBoard(setup,atlas,{...old,board:old.combatStart});
  rollDefense(restored,()=>6);casualties(restored,{});save(old,restored);save(old,restored);
  assert.equal(old.board.France.owner,'Germans');assert.equal(old.treasury.Germans,49);
  assert.deepEqual(old.turnCapitalPayments,[{from:'French',to:'Germans',amount:19}]);
});
