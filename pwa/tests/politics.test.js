import test,{afterEach,beforeEach} from 'node:test';
import {places,exercises} from '../rules.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startGlobalPlaytest,globalPowers,prepareGlobalBoard} from '../global-game.js';
import {declareWar,atWarWith,declarationDetails,declarationTargets,usIncomeChoice,rememberPoliticalCaptures} from '../politics.js';
import {collectIncome,openIncome,confirmPoliticalChoice,restoreChineseStatement} from '../income.js';
const load=n=>JSON.parse(readFileSync(new URL('../assets/'+n+'.json',import.meta.url)));
const setup=load('global-setup'),atlas=load('world-sectors');
const seats=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,1]));
// prepareGlobalBoard installs the active exercise into the shared map registry.
let priorPlaces,priorGlobal;
beforeEach(()=>{priorPlaces={...places};priorGlobal=exercises.global;});
afterEach(()=>{
  for(const key of Object.keys(places))if(!Object.hasOwn(priorPlaces,key))delete places[key];
  Object.assign(places,priorPlaces);
  if(priorGlobal)exercises.global=priorGlobal;else delete exercises.global;
});
function opening(power,round=1){
  const match=startGlobalPlaytest(setup,seats);match.power=power;match.round=round;match.phase='combatMove';
  match.combatStart=structuredClone(match.board);match.combat={game:prepareGlobalBoard(setup,atlas,match).game,ui:{}};
  return match;
}
function income(m){m.phase='mobilize';m.combat.game.phase='mobilize';return openIncome(m);}
test('declarations are explicit, before orders, immutable on preview, and independent of an attack',()=>{
  const m=opening('Germans');assert.deepEqual(declarationTargets(m),['Russians','Americans','Chinese']);
  const previous=JSON.stringify(m);
  assert.match(declarationDetails(m,['Russians']).title,/Germany declares war on the Soviet Union/);
  assert.equal(JSON.stringify(m),previous);
  const next=declareWar(m,['Russians']);assert(atWarWith(next,'Russians','Germans'));
  assert(!atWarWith(next,'Americans','Germans'));assert(!atWarWith(next,'Italians','Russians'));
  assert(prepareGlobalBoard(setup,atlas,next).exercise.movement.spaces.ep.attackLand);
  assert(!prepareGlobalBoard(setup,atlas,m).exercise.movement.spaces.ep.attackLand);
  assert.equal(next.combat.game.record.filter(e=>e.declaration).length,1);assert.throws(()=>declareWar(next,['Russians']));
  m.combat.game.orders=[{from:'hb',to:'fr'}];assert.throws(()=>declareWar(m,['Americans']));
  assert.throws(()=>declareWar(opening('Germans'),['British']));assert.throws(()=>declareWar(next,[]));
});
test('both directions of Pacific entry apply the linked powers, but only Japan starting it unlocks American entry and ends trade',()=>{
  const jp=declareWar(opening('Japanese'),['British']);
  for(const p of ['British','UK_Pacific','ANZAC','Dutch'])assert(atWarWith(jp,'Japanese',p));
  assert(!atWarWith(jp,'Japanese','Americans'));assert(jp.japanUnprovokedWesternWar);
  assert.equal(income(jp).incomeReport.accounts[0].objectives.find(o=>o.label==='American trade').earned,0);
  const uk=declareWar(opening('British'),['Japanese']);assert(!uk.japanUnprovokedWesternWar);
  assert(atWarWith(uk,'ANZAC','Japanese'));assert(atWarWith(uk,'Japanese','Dutch'));
  const american=opening('Americans');american.diplomacy=uk.diplomacy;assert.deepEqual(declarationTargets(american),[]);
  american.japanUnprovokedWesternWar=true;assert.equal(declarationTargets(american).length,3);
});
test('Soviet and Chinese entry use their own conditions, captures survive liberation, and theatres remain distinct',()=>{
  const soviet=opening('Russians');assert.deepEqual(declarationTargets(soviet),['Japanese']);
  assert.equal(declarationTargets(opening('Russians',4)).length,3);
  const germans=declareWar(opening('Germans'),['Russians']);soviet.diplomacy=germans.diplomacy;
  assert(declarationTargets(soviet).includes('Italians'));
  const br=opening('British');br.diplomacy=germans.diplomacy;
  const {spaces}=prepareGlobalBoard(setup,atlas,br).exercise.movement;
  assert(spaces['world-russia'].allowed);assert(!spaces['world-amur'].allowed);
  const china=opening('Chinese');assert.deepEqual(declarationTargets(china),[]);
  china.turnReviews=[{power:'Italians',record:[{title:'India → Burma → Yunnan'}]}];
  assert.deepEqual(declarationTargets(china),['Italians']);
  const capture=opening('Germans');capture.board['United Kingdom'].owner='Germans';rememberPoliticalCaptures(capture);
  capture.board['United Kingdom'].owner='British';capture.power='Americans';assert.equal(declarationTargets(capture).length,3);
  capture.power='Russians';assert(declarationTargets(capture).includes('Germans'));
});
test('American third-turn income offers peace or a single confirmed set of opponents before any payment',()=>{
  const us=income(opening('Americans',3));assert(usIncomeChoice(us));assert.throws(()=>collectIncome(us));
  const next=confirmPoliticalChoice(us,['Japanese','Italians']);assert(!usIncomeChoice(next));
  assert(!atWarWith(next,'Germans','Americans'));assert.equal(next.incomeReport.accounts[0].bonus,25);
  for(const name of ['Western United States','Central United States','Eastern United States']){
    assert(next.board[name].units.some(([,t])=>t==='factory_major'));assert(next.combatStart[name].units.some(([,t])=>t==='factory_major'));
  }
  assert.equal(next.treasury.Americans,us.treasury.Americans);
  assert.throws(()=>confirmPoliticalChoice(next,['Germans']));assert.throws(()=>confirmPoliticalChoice(next,[]));
  const neutral=confirmPoliticalChoice(us,[]);assert(!usIncomeChoice(neutral));assert.equal(neutral.incomeReport.accounts[0].bonus,0);assert.equal(collectIncome(neutral).power,'Chinese');
});
test('China never rolls convoys and existing pending or paid deductions are corrected exactly once',()=>{
  const china=opening('Chinese');china.board.Kiangsu.owner='Chinese';china.board['19 Sea Zone'].units=[['Japanese','submarine',2]];
  income(china);const a=china.incomeReport.accounts[0];
  assert.deepEqual(a.convoys,[]);assert(china.incomeReport.rolled);
  a.convoys=[{zone:19}];a.loss=2;china.incomeReport.rolled=false;
  china.turnReviews=[{power:'Chinese',record:[{income:{accounts:[{wallet:'Chinese',loss:2}]}}]}];
  const old=china.treasury.Chinese;restoreChineseStatement(china);restoreChineseStatement(china);
  assert.equal(china.treasury.Chinese,old+2);assert.equal(a.before,old+2);
  assert(china.incomeReport.rolled);assert.equal(a.loss,0);assert.equal(collectIncome(china).treasury.Chinese,old+2+a.land+a.bonus);
});
test('declaring on the relevant power changes naval patrol and land entry permissions immediately',()=>{
  const zone=n=>'world-'+n+'-sea-zone';
  const us=opening('Americans',4);
  const neutral=prepareGlobalBoard(setup,atlas,us).exercise;
  assert(!neutral.seaStop(zone(6),'destroyer'));assert(neutral.seaStop(zone(102),'destroyer'));assert(!neutral.seaStop(zone(102),'transport'));
  const pacific=prepareGlobalBoard(setup,atlas,declareWar(us,['Japanese'])).exercise;
  assert(pacific.seaStop(zone(6),'destroyer'));assert(!pacific.seaStop(zone(102),'transport'));
  assert(pacific.movement.spaces['world-yunnan'].friendly);
  const japan=opening('Japanese');
  assert(!prepareGlobalBoard(setup,atlas,japan).exercise.seaStop(zone(10),'destroyer'));
  assert(prepareGlobalBoard(setup,atlas,declareWar(japan,['Americans'])).exercise.seaStop(zone(10),'destroyer'));
});
