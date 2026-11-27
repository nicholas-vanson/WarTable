import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {globalPowers,startGlobalPlaytest,prepareGlobalBoard,saveGlobalPosition} from '../global-game.js';
import {queueLanding,landingRoutes,landingWait,cargoSources,aboard} from '../assault.js';
import {exercises,places,available,chooseBattle,commit,plan,retreat,retreatSites,rollAttack,rollDefense,casualties} from '../rules.js';
import {beginNoncombat,noncombatPosition,noncombatRoutes} from '../noncombat.js';
const savedPlaces={...places},oldGlobal=exercises.global;
after(()=>{for(const id of Object.keys(places))if(!(id in savedPlaces))delete places[id];Object.assign(places,savedPlaces);
  if(oldGlobal)exercises.global=oldGlobal;else delete exercises.global;});
const asset=name=>JSON.parse(readFileSync(new URL('../assets/'+name+'.json',import.meta.url)));
const setup=asset('global-setup'),atlas=asset('world-sectors');
const seats=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,1]));
const sea=n=>'world-'+n+'-sea-zone',port=sea(112),shore=sea(110),target='nb';
function make(edit=()=>{}){
  const m=startGlobalPlaytest(setup,seats),b=m.board;
  b['112 Sea Zone'].units=[['Germans','transport',2],['Germans','cruiser',2]];
  b['110 Sea Zone'].units=[];b['Normandy Bordeaux'].units=[];
  b['United Kingdom'].facilityDamage={airfield:3}; // Isolate the naval and landing forces under test.
  edit(b);return {m,s:prepareGlobalBoard(setup,atlas,m).game};
}
const cargo=[{from:'wg',type:'artillery',n:1},{from:'wg',type:'inf',n:1}];
function land(s,rows=cargo,escorts=[],from=port,to=target,path=[port,shore],load=null){
  queueLanding(s,from,to,{cargo:rows,escorts,path,load});
}
function round(s,attack,defend,losses={}){
  rollAttack(s,()=>attack);rollDefense(s,()=>defend);casualties(s,losses);
}
const cruisers=n=>[{from:port,type:'cruiser',n}];
test('coastal planning honors transport capacity, cargo reservations, canals and declarations',()=>{
  const {s}=make();const routes=landingRoutes(s,port);
  assert(routes.get(target).some(path=>path.join()===[port,shore].join()));
  assert(!routes.has('fr'));assert(!routes.has('world-eastern-united-states'));
  assert.throws(()=>land(s,[{from:'wg',type:'artillery',n:1},{from:'hb',type:'tank',n:1}]));assert.equal(s.orders.length,0);
  land(s);assert.equal(available(s,port).transport,1);assert.equal(available(s,'wg').artillery,0);
  assert.throws(()=>land(s));s.orders=[];assert.equal(available(s,'wg').artillery,1);
  const enemy=make(b=>{b['110 Sea Zone'].units=[['British','cruiser',1]];}).s;
  assert(!cargoSources(enemy,[shore]).length);
  const gate=b=>{b['113 Sea Zone'].units=[['Germans','transport',1]];};
  assert(landingRoutes(make(gate).s,sea(113)).has(target));
  const locked=make(b=>{gate(b);b.Denmark.owner='British';}).s;
  assert(!landingRoutes(locked,sea(113)).has(target));
});
test('a clear coast lands exactly the reserved cargo, keeps the transport offshore and spends its move',()=>{
  const {s,m}=make();land(s);commit(s);saveGlobalPosition(m,s);
  assert.equal(s.phase,'review');assert.equal(m.board['Normandy Bordeaux'].owner,'Germans');
  assert(m.board['Normandy Bordeaux'].units.some(([,t,n])=>t==='artillery'&&n===1));
  assert(m.board['110 Sea Zone'].units.some(([,t,n])=>t==='transport'&&n===1));
  beginNoncombat(s);const g=noncombatPosition(s);
  assert.equal(g.unused[port].transport,1);assert(!g.unused[shore].transport);assert.equal(g.unused.wg.artillery,0);
});
test('bombardment is capped by cargo and fires in the first round only while defenders return fire',()=>{
  const {s}=make(b=>{b['Normandy Bordeaux'].units=[['French','infantry',3]];});
  land(s,[{from:'wg',type:'inf',n:1}],cruisers(2));commit(s);chooseBattle(s,target);
  const b=s.battles[0];rollAttack(s,()=>3);assert.equal(b.dice.attack.filter(d=>d.bombard&&d.hit).length,1);
  rollDefense(s,()=>6);assert.equal(b.dice.defense.length,3);casualties(s,{});
  assert.deepEqual(retreatSites(s,b),[]);rollAttack(s,()=>6);assert(!b.dice.attack.some(d=>d.bombard));
});
test('offshore combat blocks landing across reload, survivors land once and engaged ships cannot bombard',()=>{
  let {s}=make(b=>{b['110 Sea Zone'].units=[['British','destroyer',1]];});
  land(s,cargo,cruisers(1));commit(s);assert.throws(()=>chooseBattle(s,target));
  s=JSON.parse(JSON.stringify(s));const b=s.battles.find(b=>b.to===target);
  assert.deepEqual(landingWait(s,b),[shore]);chooseBattle(s,shore);round(s,1,6);
  assert.equal(s.phase,'review');assert.equal(s.owners[target],'Germany');assert.equal(b.bombard,undefined);
  assert.equal(s.record.filter(e=>e.title==='Normandy Bordeaux landing').length,1);
});
test('a sunk transport loses its cargo and cannot take an empty coast',()=>{
  const {s}=make(b=>{b['110 Sea Zone'].units=[['British','destroyer',2]];});
  land(s,cargo,cruisers(1));commit(s);chooseBattle(s,shore);round(s,6,1,{cruiser:1,transport:1});
  assert.equal(s.phase,'review');assert.equal(s.owners[target],'France');
  assert(s.record.some(e=>e.title.includes('Transport sunk')&&e.detail.includes('artillery')));
  assert(!s.pieces[target].some(([p,,n])=>p==='Germans'&&n));
});
test('a retreat preserves embarked cargo for a later landing or friendly unloading',()=>{
  const {s,m}=make(b=>{b['110 Sea Zone'].units=[['British','destroyer',1]];});
  land(s,cargo,cruisers(1));commit(s);chooseBattle(s,shore);round(s,6,6);retreat(s,port);
  assert.equal(s.phase,'review');assert.deepEqual(aboard(s,port)[0].units,{artillery:1,inf:1});
  saveGlobalPosition(m,s);beginNoncombat(s);
  let g=noncombatPosition(s);const load=aboard(s,port)[0].id;
  const order={from:port,type:'transport',quantity:1,load};
  assert(!noncombatRoutes(g,order).size);
  m.board['110 Sea Zone'].units=[];const next=prepareGlobalBoard(setup,atlas,m).game;
  const later=structuredClone(next);commit(later);beginNoncombat(later);
  g=noncombatPosition(later,[{...order,to:'wg'}]);assert(!aboard(g,port).length);
  assert(g.pieces.wg.some(([,t,n])=>t==='artillery'&&n===1));
  land(next,[],[],port,target,[port,shore],load);commit(next);assert.equal(next.owners[target],'Germany');
});
test('overland troops can withdraw together while the seaborne force continues fighting',()=>{
  const {s}=make(b=>{b['Normandy Bordeaux'].units=[['French','infantry',3]];});
  land(s,[{from:'wg',type:'inf',n:1}]);plan(s,'hb','nb',{tank:1});commit(s);chooseBattle(s,target);round(s,6,6);
  const b=s.battles[0];assert.deepEqual(retreatSites(s,b),['hb']);retreat(s,'hb');
  assert.equal(b.attack.inf,1);assert(!b.attack.tank);assert(!b.resolved);assert.deepEqual(retreatSites(s,b),[]);
});
test('ignoring an enemy submarine requires a warship; an unescorted order stays editable',()=>{
  const {s}=make(b=>{b['110 Sea Zone'].units=[['British','submarine',1]];});land(s);
  const before=structuredClone(s);assert.throws(()=>commit(s),/warship/);assert.deepEqual(s,before);
  s.orders=[];land(s,cargo,cruisers(1));commit(s);assert.equal(s.phase,'review');
  assert(s.pieces[shore].some(([p,t,n])=>p==='British'&&t==='submarine'&&n));
});

test('a surviving attacking transport can retreat with its cargo after losing its escort',()=>{
  const {s}=make(b=>{b['110 Sea Zone'].units=[['British','destroyer',1]];});
  land(s,cargo,cruisers(1));commit(s);chooseBattle(s,shore);round(s,6,1,{cruiser:1});
  const fleet=s.battles.find(b=>b.to===shore);assert.equal(fleet.attack.transport,1);
  assert.deepEqual(retreatSites(s,fleet),[port]);retreat(s,port);assert(aboard(s,port).length);
});
test('multiple transports share a prerequisite and the attacker can identify which cargo is lost',()=>{
  const {s}=make(b=>{b['110 Sea Zone'].units=[['British','destroyer',2]];});
  land(s,[{from:'wg',type:'artillery',n:1}],cruisers(1));
  land(s,[{from:'wg',type:'inf',n:2}]);commit(s);chooseBattle(s,shore);
  const fleet=s.battles.find(b=>b.to===shore);
  rollAttack(s,()=>1);rollDefense(s,()=>1);
  const which=fleet.boats.find(h=>h.units.artillery).id;
  casualties(s,{transport:1,cruiser:1},{boats:[which]});
  assert.equal(fleet.boats.length,1);assert.equal(fleet.boats[0].units.inf,2);
  retreat(s,port);assert.deepEqual(aboard(s,port)[0].units,{inf:2});
});
test('the attacker chooses between overland and seaborne casualties of the same type',()=>{
  const {s}=make(b=>{b['Normandy Bordeaux'].units=[['French','infantry',1]];});
  land(s,[{from:'wg',type:'inf',n:1}]);plan(s,'hb','nb',{inf:1});
  commit(s);chooseBattle(s,target);rollAttack(s,()=>6);rollDefense(s,()=>1);
  casualties(s,{inf:1},{beach:{inf:1}});const b=s.battles.find(b=>b.to===target);
  assert.equal(b.beachForce.inf,0);retreat(s,'hb');assert(b.resolved);assert.equal(s.owners[target],'France');
});
test('attacking an otherwise ignorable fleet prevents bombardment for all landings from that zone',()=>{
  const {s}=make(b=>{b['110 Sea Zone'].units=[['British','transport',1]];b['Normandy Bordeaux'].units=[['French','infantry',2]];});
  queueLanding(s,port,target,{path:[port,shore],cargo,escorts:cruisers(1),engage:true});
  land(s,[{from:'wg',type:'inf',n:1}],cruisers(1));commit(s);
  assert.throws(()=>chooseBattle(s,target));chooseBattle(s,shore);round(s,1,6);
  chooseBattle(s,target);rollAttack(s,()=>6);assert(!s.battles[0].dice.attack.some(d=>d.bombard));
});
