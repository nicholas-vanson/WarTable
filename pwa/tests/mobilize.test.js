import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {globalPowers,startGlobalPlaytest,prepareGlobalBoard,changePurchase,confirmPurchase,saveGlobalPosition,changeFacilityOrder} from '../global-game.js';
import {commit,flightRecoveries} from '../rules.js';
import {beginNoncombat,noncombatPosition,noncombatRoutes} from '../noncombat.js';
import {beginMobilization,mobilizationPlan,placementOptions,finishMobilization,reviseLaunches} from '../mobilize.js';
const asset=n=>JSON.parse(readFileSync(new URL('../assets/'+n+'.json',import.meta.url)));
const setup=asset('global-setup'),atlas=asset('world-sectors'),seats=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,1]));
const berlin='world-germany',sea=n=>'world-'+n+'-sea-zone';
function turn(power='Germans',prepare=()=>{},buy=()=>{}){
  const match=startGlobalPlaytest(setup,seats);match.power=power;match.phase='purchase';
  prepare(match);buy(match);confirmPurchase(match);match.combatStart=structuredClone(match.board);
  const {game}=prepareGlobalBoard(setup,atlas,match);
  commit(game);beginNoncombat(game);
  const s=beginMobilization(game);match.phase='mobilize';match.combat={game:s};saveGlobalPosition(match,s);
  return {match,s};
}
const order=(unit,site,to=site,quantity=1,wallet='Germans')=>({wallet,unit,site,to,quantity});
test('paid orders preview and reload independently of the board, share production, and commit only once',()=>{
  const {match,s}=turn('Germans',m=>{m.board.Germany.facilityDamage={factory_major:8};},m=>{
    changeFacilityOrder(m,'Germans','Germany','factory_major',1);
    changePurchase(m,'infantry',1);changePurchase(m,'infantry',1);changePurchase(m,'destroyer',1);
  });
  const starting=structuredClone(match);let plan=mobilizationPlan(match,s);
  assert.equal(plan.slots[berlin],3);assert.equal(plan.required,3);
  assert.throws(()=>finishMobilization(match,s),/Assign/);
  s.placements=[order('infantry',berlin,berlin,2),order('destroyer',berlin,sea(113))];
  plan=mobilizationPlan(match,s);assert.equal(plan.slots[berlin],0);assert.equal(plan.game.placementMarks[berlin].inf,2);
  assert.deepEqual(match.board,starting.board);
  const next=finishMobilization(JSON.parse(JSON.stringify(match)),JSON.parse(JSON.stringify(s)));
  assert.equal(next.power,'Russians');assert.equal(next.board.Germany.units.find(r=>r[1]==='infantry')[2],13);
  assert.equal(next.mobilization.Germans,undefined);assert.equal(next.treasury.Germans,starting.treasury.Germans);
  assert.throws(()=>finishMobilization(next,s));assert(next.turnReviews.at(-1).record.some(r=>r.title==='113 Sea Zone'&&r.detail.includes('Germany')));
});
test('new facilities do not consume slots or produce, upgrades take effect next turn, new captures cannot build',()=>{
  const {s,match}=turn('Germans',m=>{m.board.Germany.units.find(r=>r[1]==='factory_major')[1]='factory_minor';},m=>changeFacilityOrder(m,'Germans','Germany','upgrade',1));
  match.mobilization.Germans={infantry:4,factory_minor:1,airfield:1};
  match.board.France.owner='Germans';s.owners.fr='Germany';
  const placements=[order('factory_minor','pl'),order('airfield','pl'),order('infantry',berlin,berlin,3)];
  const p=mobilizationPlan(match,s,placements);assert.equal(p.slots.pl,0);assert.equal(p.slots[berlin],0);
  assert(!placementOptions(p,'Germans','infantry').some(o=>[berlin,'fr','pl'].includes(o.to)));
  assert.throws(()=>mobilizationPlan(match,s,[order('factory_minor','fr')]));
  s.placements=[...placements,order('infantry','wg')];const next=finishMobilization(match,s);
  assert(next.board.Germany.units.some(r=>r[1]==='factory_major'));assert(!next.pendingUpgrades.Germany);
  assert(next.board.Poland.units.some(r=>r[1]==='factory_minor'));
});
test('ships can launch into hostile water, deck aircraft require an own undamaged berth and use a factory slot',()=>{
  const {s,match}=turn('Germans',m=>{
    m.board['113 Sea Zone'].units=[['Italians','carrier',1],['Germans','carrier',1],['British','destroyer',1]];
    m.board['113 Sea Zone'].shipDamage={Germans:{carrier:1}};
    m.board['Western Germany'].units=m.board['Western Germany'].units.filter(r=>r[1]!=='harbour');
    m.board['Norway'].units=m.board['Norway'].units.filter(r=>r[1]!=='harbour');
  });
  s.shipDamage[sea(113)]={Germans:{carrier:1}};match.mobilization.Germans={carrier:1,fighter:3,bomber:1};
  const zone=sea(113),initial=mobilizationPlan(match,s);
  assert(placementOptions(initial,'Germans','carrier').some(o=>o.to===zone));assert(!placementOptions(initial,'Germans','fighter').some(o=>o.to===zone));
  s.placements=[order('carrier',berlin,zone)];let p=mobilizationPlan(match,s);
  assert.equal(placementOptions(p,'Germans','fighter').find(o=>o.to===zone).limit,2);
  s.placements.push(order('fighter','wg',zone,2));p=mobilizationPlan(match,s);
  assert(!placementOptions(p,'Germans','fighter').some(o=>o.to===zone));assert(!placementOptions(p,'Germans','bomber').some(o=>o.to===zone));
  assert.throws(()=>mobilizationPlan(match,s,s.placements.slice(1)));
});
test('British economies retain separate limits, and China can mobilize in a recaptured Chinese territory',()=>{
  const {s,match}=turn('British');
  match.mobilization={British:{infantry:1},UK_Pacific:{infantry:1},Germans:{armour:2}};
  const p=mobilizationPlan(match,s),india='world-india',london='world-united-kingdom';
  assert(!placementOptions(p,'British','infantry').some(o=>o.to===india));
  assert(!placementOptions(p,'UK_Pacific','infantry').some(o=>o.to===london));
  s.placements=[order('infantry',london,london,1,'British'),order('infantry',india,india,1,'UK_Pacific')];
  const next=finishMobilization(match,s);assert.deepEqual(next.mobilization,{Germans:{armour:2}});
  const china=turn('Chinese');china.match.board.Jehol.owner='Chinese';china.s.owners['world-jehol']='China';china.match.mobilization.Chinese={artillery:3};
  assert(placementOptions(mobilizationPlan(china.match,china.s),'Chinese','artillery').some(o=>o.to==='world-jehol'&&o.limit===3));
});
test('excess historical reserves are refunded only when the available production has been used efficiently',()=>{
  const {s,match}=turn();
  match.mobilization.Germans={destroyer:2,infantry:2};match.board.Germany.facilityDamage={factory_major:9};match.board['Western Germany'].facilityDamage={factory_major:10};
  match.board['Greater Southern Germany'].units.push(['Germans','factory_minor',1]);match.combatStart['Greater Southern Germany'].units.push(['Germans','factory_minor',1]);
  const inland='world-greater-southern-germany',old=match.treasury.Germans;
  s.placements=[order('infantry',berlin),order('infantry',inland)];
  assert.throws(()=>finishMobilization(match,s),/Assign/);
  s.placements=[order('infantry',inland,inland,2),order('destroyer',berlin,sea(113))];
  assert.equal(finishMobilization(match,s).treasury.Germans,old+8);
});

test('a flight can depend on a purchased carrier from combat through noncombat and final placement',()=>{
  const match=startGlobalPlaytest(setup,seats);match.phase='purchase';changePurchase(match,'carrier',1);confirmPurchase(match);
  match.combatStart=structuredClone(match.board);
  const {game}=prepareGlobalBoard(setup,atlas,match),zone=sea(113);
  const hull=order('carrier',berlin,zone);
  // At zero remaining range this sea zone is the only possible recovery.
  const spent=5,sortie={from:'wg',to:zone,units:{fighter:1}};
  assert.equal(flightRecoveries(game,[sortie],sortie,spent),null);
  game.carrierLaunches=reviseLaunches(match,game,[hull]);
  assert.deepEqual(flightRecoveries(game,[sortie],sortie,spent).get(sortie).fighter,[zone]);
  commit(game);beginNoncombat(game);
  const landing={from:'wg',to:zone,type:'fighter',quantity:1};
  assert(noncombatRoutes(noncombatPosition(game),landing).has(zone));game.noncombatOrders=[landing];
  assert.throws(()=>reviseLaunches(match,game,[]));
  const s=beginMobilization(game);match.phase='mobilize';match.combat={game:s};saveGlobalPosition(match,s);
  assert.deepEqual(s.placements,[hull]);assert(!s.pieces[zone].some(([,t,n])=>t==='carrier'&&n));
  assert.throws(()=>mobilizationPlan(match,s,[]),/reserved carrier/);
  const next=finishMobilization(match,s);
  assert(next.board['113 Sea Zone'].units.some(([,t,n])=>t==='carrier'&&n===1));
  assert(next.board['113 Sea Zone'].units.some(([,t,n])=>t==='fighter'&&n===1));
});
