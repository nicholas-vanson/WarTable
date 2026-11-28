import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startGlobalPlaytest,globalPowers} from '../global-game.js';
import {newGame,plan,commit,chooseBattle,rollAttack,rollDefense,casualties} from '../rules.js';
import {globalWarStatus,exerciseWarStatus} from '../war-status.js';

const setup=JSON.parse(readFileSync(new URL('../assets/global-setup.json',import.meta.url)));
const players=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,1]));
const opening=()=>startGlobalPlaytest(setup,players);

test('the opening global comparison agrees with victory control and both British economies',()=>{
  const match=opening(),before=structuredClone(match);
  const {sides:{Allies:a,Axis:x},goals}=globalWarStatus(match);
  assert.deepEqual([a.cities.length,x.cities.length],[14,5]);
  assert.equal(goals[0].cities.length+goals[1].cities.length,x.cities.length);
  assert.deepEqual([a.landIncome,a.bonus,a.income,a.treasury],[175,11,186,175]);
  assert.deepEqual([x.landIncome,x.bonus,x.income,x.treasury],[66,20,86,66]);
  assert.deepEqual([a.land,a.air,a.sea,a.military],[171,27,42,1310]);
  assert.deepEqual([x.land,x.air,x.sea,x.military],[145,36,33,1247]);
  assert.deepEqual(match,before);
});

test('capital capture updates control and collectible income independently of treasury and guest forces',()=>{
  const match=opening(),before=globalWarStatus(match).sides;
  match.board['United Kingdom'].owner='Germans';
  match.board.France.units.push(['British','bomber',2],['Neutral_Axis','infantry',8],['French','factory_minor',3]);
  match.treasury.British=0;
  const {Allies:a,Axis:x}=globalWarStatus(match).sides;
  assert.ok(x.cities.includes('London'));assert.equal(a.cities.length,13);
  assert.equal(a.landIncome,175-28);assert.equal(a.bonus,11-5);
  assert.equal(a.treasury,175-28);assert.equal(x.landIncome,66+match.board['United Kingdom'].ipc);
  assert.equal(a.military,before.Allies.military+24);assert.equal(x.military,before.Axis.military);
});

test('combat totals include surviving sorties, transport cargo and pending attackers exactly once',()=>{
  const m=opening(),before=globalWarStatus(m).sides;
  m.board['110 Sea Zone'].embarked=[{power:'British',units:{inf:1}}];
  const game={power:m.power,phase:'review',battles:[{attack:{tank:2},boats:[{power:'Germans',units:{artillery:1}}]},
      {resolved:true,attack:{inf:12},boats:[{power:'Germans',units:{tank:5}}]}],
    raids:[{step:'done',planes:[{type:'fighter'},{type:'bomber',lost:'aaLoss'}],interceptors:[{power:'UK_Pacific',remaining:1}]}],
    scrambles:[{power:'ANZAC',type:'tactical_bomber',remaining:2}],landedFlights:[{base:null,count:1,type:'bomber'},{base:'wg',count:1,type:'fighter'}]};
  m.combat={game};
  const combat=globalWarStatus(m).sides;
  assert.equal(combat.Axis.military-before.Axis.military,12+4+10+12);
  assert.equal(combat.Allies.military-before.Allies.military,3+10+22);
  game.battles[0].resolved=true;game.phase='noncombat';
  assert.equal(globalWarStatus(m).sides.Axis.military-before.Axis.military,12);
  game.phase='mobilize';assert.equal(globalWarStatus(m).sides.Axis.military,before.Axis.military);
});

test('exercise summary retains units through a real commit and updates both sides on casualties',()=>{
  const g=newGame('west');
  const initial=exerciseWarStatus(g).sides;
  plan(g,'hb','fr',{inf:3,tank:1});
  assert.deepEqual(exerciseWarStatus(g).sides,initial);
  commit(g);assert.deepEqual(exerciseWarStatus(g).sides,initial);
  chooseBattle(g,'fr');rollAttack(g,()=>1);rollDefense(g,()=>1);casualties(g,{inf:3,tank:1});
  const after=exerciseWarStatus(g).sides;
  assert.equal(after.Axis.military,initial.Axis.military-15);
  assert.equal(after.Allies.military,initial.Allies.military-15);
  assert.deepEqual(after.Allies.cities,['Paris']);
  assert.equal(exerciseWarStatus(newGame('east')).sides.Axis.cities[0],'Warsaw');
});
