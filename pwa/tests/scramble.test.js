import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {globalPowers,startGlobalPlaytest,prepareGlobalBoard,saveGlobalPosition} from '../global-game.js';
import {exercises,places,commit,plan,chooseBattle,rollAttack,rollDefense,casualties,retreat,defendingRows,deckSpace,movementFor} from '../rules.js';
import {queueLanding,landingWait} from '../assault.js';
import {beginNoncombat} from '../noncombat.js';
import {scramblePlan,recoverScrambles} from '../scramble.js';

const originalPlaces={...places},originalExercise=exercises.global;
after(()=>{
  for(const id of Object.keys(places))if(!(id in originalPlaces))delete places[id];
  Object.assign(places,originalPlaces);
  if(originalExercise)exercises.global=originalExercise;else delete exercises.global;
});
const asset=name=>JSON.parse(readFileSync(new URL('../assets/'+name+'.json',import.meta.url)));
const setup=asset('global-setup'),atlas=asset('world-sectors');
const seats=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,1]));
const sea=n=>'world-'+n+'-sea-zone',port=sea(112),zone=sea(110),coast='nb';
const home='world-united-kingdom',scotland='world-scotland';
const num=(s,id,p,t)=>s.pieces[id].filter(([power,type])=>power===p&&type===t).reduce((sum,row)=>sum+row[2],0);
const countFlights=flights=>flights.reduce((n,f)=>n+f.n,0);
function position(edit=()=>{}){
  const match=startGlobalPlaytest(setup,seats),board=match.board;
  board['112 Sea Zone'].units=[['Germans','transport',1],['Germans','cruiser',2]];
  board['110 Sea Zone'].units=[];
  board['Normandy Bordeaux'].units=[];
  board['United Kingdom'].units=[['British','airfield',1],['British','fighter',1],['French','tactical_bomber',1]];
  edit(board,match);
  return {match,...prepareGlobalBoard(setup,atlas,match)};
}
function landing(s,escort=0){
  queueLanding(s,port,coast,{path:[port,zone],cargo:[{from:'wg',type:'inf',n:1}],
    escorts:escort?[{from:port,type:'cruiser',n:escort}]:[]});
}
function roll(s,a,d,losses={}){
  rollAttack(s,()=>a);rollDefense(s,()=>d);casualties(s,losses);
}

test('operative bases share a limit across nationalities and zones; priority is assault, value, then zone number',()=>{
  const {game:s,exercise:ex}=position(b=>{
    b['United Kingdom'].units.push(['British','fighter',1],['Americans','fighter',4],['British','bomber',4]);
    b['United Kingdom'].facilityDamage={airfield:2};
    b['109 Sea Zone'].units=[['British','battleship',2]];b['110 Sea Zone'].units=[['British','destroyer',1]];
  });
  const fleet=[{to:zone},{to:sea(109)}],invasion={to:coast,landing:{path:[port,zone]}};
  const high=scramblePlan(s,fleet);assert.equal(countFlights(high),4);
  assert(high.every(f=>f.zone===sea(109)));assert.equal(countFlights(high.filter(f=>f.from===home)),3);
  s.pieces[sea(109)]=[['British','destroyer',1]];
  assert(scramblePlan(s,fleet).every(f=>f.zone===sea(109)));
  const preferred=scramblePlan(s,[...fleet,invasion]);
  assert(preferred.filter(f=>f.from===home).every(f=>f.zone===zone));
  assert(preferred.some(f=>f.from===scotland&&f.zone===sea(109)));
  assert(preferred.every(f=>['British','French'].includes(f.power)&&['fighter','tactical_bomber'].includes(f.type)));
  ex.holdScrambles.British=true;assert.deepEqual(scramblePlan(s,[invasion]).map(f=>[f.power,f.type,f.n]),[['French','tactical_bomber',1]]);
  assert.deepEqual(scramblePlan(s,[{to:'fr',passages:[zone]}]),[]);
});
test('damaged or absent air bases and carrier aircraft cannot launch a scramble',()=>{
  for(const option of ['damage','remove']){
    const {game:s}=position(b=>{
      if(option==='damage')b['United Kingdom'].facilityDamage={airfield:3};
      else b['United Kingdom'].units.shift();
      b['110 Sea Zone'].units=[['British','carrier',1],['British','fighter',2]];
    });
    assert.deepEqual(scramblePlan(s,[{to:zone}]),[]);
  }
});
test('a fleet attack rolls national defending aircraft at 4 and 3, with separate carrier space and losses',()=>{
  const {game:s}=position(b=>{b['110 Sea Zone'].units=[['British','carrier',1],['British','fighter',1]];});
  plan(s,port,zone,{cruiser:2});commit(s);
  assert.equal(num(s,home,'British','fighter'),0);assert.equal(num(s,home,'French','tactical_bomber'),0);
  assert.equal(deckSpace(s,zone,['British','French']),1);
  chooseBattle(s,zone);rollAttack(s,()=>1);rollDefense(s,()=>4);
  const b=s.battles.find(b=>b.to===zone);
  assert.deepEqual(b.dice.defense.filter(d=>d.type==='fighter').map(d=>[d.power,d.threshold,d.hit]),[['British',4,true],['British',4,true]]);
  assert(b.dice.defense.some(d=>d.power==='French'&&d.threshold===3&&!d.hit));
  casualties(s,{cruiser:2});
  // A carrier took its first hit; one British fighter was also destroyed. The
  // other fighter scrambled from land and does not need the damaged deck.
  assert.equal(num(s,zone,'British','fighter'),0);assert.equal(s.phase,'review');
  assert(s.scrambles.every(f=>f.returning&&f.remaining===1));
  beginNoncombat(s);assert.equal(num(s,home,'British','fighter'),1);assert.equal(num(s,home,'French','tactical_bomber'),1);
});
test('an empty offload zone becomes a sea battle; a lost unescorted transport loses its cargo',()=>{
  const {game:s}=position();landing(s);
  assert(movementFor(s,'wg','fighter').destinations().includes(zone));
  commit(s);const beach=s.battles.find(b=>b.to===coast);
  assert.deepEqual(landingWait(s,beach),[zone]);assert.throws(()=>chooseBattle(s,coast),/offshore/);
  chooseBattle(s,zone);roll(s,6,1,{transport:1});
  assert.equal(s.phase,'review');assert.equal(s.owners[coast],'France');
  assert(s.record.some(e=>e.title.includes('Transport sunk')&&e.detail.includes('infantry')));
  assert.deepEqual(defendingRows(s,zone),[]);assert.equal(num(s,home,'British','fighter'),0);
  beginNoncombat(s);assert.equal(num(s,home,'British','fighter'),1);
});
test('separate air support can join offshore and a sea battle against aircraft cancels bombardment',()=>{
  const {game:s}=position(b=>{b['Normandy Bordeaux'].units=[['French','infantry',1]];});
  landing(s,2);plan(s,'wg',zone,{fighter:1},['hb']);
  const detached=structuredClone(s);detached.orders.shift();assert.throws(()=>commit(detached),/offshore support/);
  commit(s);chooseBattle(s,zone);roll(s,1,6);assert(s.scrambles.every(f=>f.remaining===0));
  chooseBattle(s,coast);rollAttack(s,()=>6);assert(!s.battles.find(b=>b.to===coast).dice.attack.some(d=>d.bombard));
});
test('a mainland attack and an offshore battle cannot use the same defenders, in either battle order',()=>{
  for(const first of [zone,home]){
    let {game:s,match}=position(b=>{
      b.Scotland={owner:'Germans',units:[['Germans','infantry',2]]};
      b['United Kingdom'].units.push(['British','infantry',1]);
      b['110 Sea Zone'].units=[['British','transport',1]];
    });
    plan(s,scotland,home,{inf:2});plan(s,port,zone,{cruiser:1});commit(s);
    for(const id of [first,first===home?zone:home]){
      chooseBattle(s,id);
      if(id===home){
        assert.deepEqual(defendingRows(s,home),[['British','inf',1]]);
        roll(s,1,6);assert.equal(s.owners[home],'Germany');
      }else{roll(s,6,6);retreat(s,port);}
      s=JSON.parse(JSON.stringify(s));
    }
    assert.equal(s.phase,'review');assert.equal(num(s,coast,'British','fighter'),0);
    beginNoncombat(s);saveGlobalPosition(match,s);
    assert.equal(num(s,coast,'French','tactical_bomber'),1);assert.equal(num(s,coast,'British','fighter'),1);
    assert(s.record.filter(e=>e.scrambleRecovery).every(e=>e.detail.includes('diverted')));
    recoverScrambles(s);assert.equal(num(s,coast,'British','fighter'),1);
    assert(match.board['Normandy Bordeaux'].units.some(([p,t,n])=>p==='French'&&t==='tactical_bomber'&&n===1));
  }
});
test('diverting survivors share actual free berths and cannot use a full or damaged carrier',()=>{
  const {game:s}=position(b=>{
    b['Normandy Bordeaux'].owner='Germans';b['109 Sea Zone'].units=[['British','carrier',1],['British','fighter',1]];
    b['111 Sea Zone'].units=[['British','carrier',1]];b['111 Sea Zone'].shipDamage={British:{carrier:1}};
    b['105 Sea Zone'].units=[['British','carrier',1],['British','fighter',2]];
  });
  s.owners[home]='Germany';s.phase='review';
  s.scrambles=[{from:home,zone,power:'British',type:'fighter',n:2,remaining:2,returning:true}];
  beginNoncombat(s);assert.equal(num(s,sea(109),'British','fighter'),2);
  assert.equal(num(s,sea(111),'British','fighter'),0);assert.equal(num(s,sea(105),'British','fighter'),2);
  assert(s.record.some(e=>e.title==='Scrambled aircraft lost'&&e.detail.startsWith('1 ×')));
});
test('support sent to a second landing arrives uncontested when the same base covers the higher-value assault',()=>{
  const other=sea(109);
  const {game:s}=position(b=>{
    b['109 Sea Zone'].units=[['Germans','transport',1]];
    b.Scotland={owner:'Germans',units:[['Germans','infantry',1]]};
    b['Normandy Bordeaux'].units=[['French','infantry',12]];
  });
  landing(s,1);
  queueLanding(s,other,home,{path:[other],cargo:[{from:scotland,type:'inf',n:1}],escorts:[]});
  plan(s,port,other,{cruiser:1},[zone]);commit(s);
  assert(s.scrambles.every(f=>f.zone===zone));
  const support=s.battles.find(b=>b.to===other);
  assert(support.resolved);assert(num(s,other,'Germans','cruiser')===1);
  assert.equal(s.owners[home],'Germany');assert(s.battles.find(b=>b.to===coast).offshore.includes(zone));
});
