import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {globalPowers,startGlobalPlaytest,prepareGlobalBoard} from '../global-game.js';
import {available,plan,commit,movementFor,retreat,retreatSites,ships} from '../rules.js';
import {orderPassages} from '../movement.js';

const load=name=>JSON.parse(readFileSync(new URL('../assets/'+name+'.json',import.meta.url)));
const setup=load('global-setup'),atlas=load('world-sectors');
const players=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,1]));
const zone=n=>'world-'+n+'-sea-zone';
function opening(change=()=>{}){
  const match=startGlobalPlaytest(setup,players);
  change(match.board);
  return prepareGlobalBoard(setup,atlas,match);
}

test('mechanized infantry traverses friendly land while infantry and artillery stop after one space',()=>{
  const {game}=opening();
  const routes=movementFor(game,'wg','mech_infantry',4);
  assert(routes.destinations().includes('nb'));
  assert.deepEqual(routes.passagesTo('nb'),['hb']);
  for(const type of ['inf','artillery']){
    assert(!movementFor(game,'wg',type).destinations().includes('nb'));
    assert.throws(()=>plan(game,'wg','nb',{[type]:1},['hb']));
  }
  plan(game,'wg','nb',{mech_infantry:3},['hb']);
  assert.equal(available(game,'wg').mech_infantry,1);
  assert.deepEqual(orderPassages(JSON.parse(JSON.stringify(game.orders[0]))),['hb']);
  assert.equal(available(game,'wg','nb',['hb']).mech_infantry,4);
  commit(game);
  assert.deepEqual(game.battles[0].origins,['hb']);
  assert.equal(game.owners.hb,'Germany');
});

test('a mechanized blitz must have one tank per unit on that exact route',()=>{
  const {game}=opening(board=>{
    board['Holland Belgium'].units.push(['Germans','mech_infantry',4]);
    board['Normandy Bordeaux'].units=[];
  });
  assert(!movementFor(game,'hb','mech_infantry',4).passagesTo('fr').includes('nb'));
  assert(movementFor(game,'hb','mech_infantry',2).passagesTo('fr').includes('nb'));
  assert.throws(()=>plan(game,'hb','fr',{tank:1,mech_infantry:2},'nb'));
  plan(game,'hb','hb',{tank:2,mech_infantry:2},'nb');commit(game);
  assert.equal(game.owners.nb,'Germany');
  assert.equal(game.units.hb.mech_infantry,4);
  assert.equal(game.battles.length,0);
});

test('ships check blocking fleets, strait control, and the starting naval base',()=>{
  const {game,exercise}=opening();
  for(const type of ships){
    const routes=movementFor(game,zone(113),type);
    assert.equal(routes.range,3);
    assert(routes.legal(zone(110),[zone(112)]));
    assert.equal(routes.legal('fr',[zone(112)]),false);
  }
  const shipsAt=enemy=>opening(board=>{
    board['112 Sea Zone'].units=enemy;
    board['Western Germany'].facilityDamage={harbour:3};
  });
  const {game:blocked}=shipsAt([['British','cruiser',1]]);
  assert(!movementFor(blocked,zone(113),'battleship').legal(zone(110),[zone(112)]));
  assert(movementFor(blocked,zone(113),'submarine').legal(zone(110),[zone(112)]));
  const {game:destroyer}=shipsAt([['British','destroyer',1]]);
  assert(!movementFor(destroyer,zone(113),'submarine').legal(zone(110),[zone(112)]));
  const {game:ignored}=shipsAt([['British','submarine',1],['British','transport',1]]);
  assert(movementFor(ignored,zone(113),'cruiser').legal(zone(110),[zone(112)]));
  assert.equal(movementFor(ignored,zone(113),'cruiser').range,2);
  const {game:closed}=opening(b=>{b.Denmark.owner='British';});
  assert(!movementFor(closed,zone(113),'cruiser').legal(zone(110),[zone(112)]));
  assert.equal(exercise.movement.allowance(zone(113),'cruiser'),3);
});

test('aircraft choose each passage and recover within the remaining allowance',()=>{
  const {game,exercise}=opening();
  const uk='world-united-kingdom',berlin='world-germany';
  const through=['wg','hb',zone(110)];
  const routes=movementFor(game,berlin,'bomber',1);
  for(let i=0;i<through.length;i++)assert(routes.passagesTo(uk,through.slice(0,i)).includes(through[i]));
  assert(!routes.legal(uk,['wg','hb','wg',zone(110)]));
  assert(!routes.legal(uk,['world-switzerland','hb',zone(110)]));
  assert(!routes.legal(uk,['wg','hb','nb','sf','world-spain',zone(110)]));
  assert.equal(movementFor(game,'wg','fighter').range,5);
  assert.equal(movementFor(game,'wg','tactical_bomber').range,5);
  assert.equal(routes.range,6);
  plan(game,berlin,uk,{bomber:1},through);
  plan(game,berlin,uk,{bomber:1},['wg',zone(112),zone(110)]);
  assert.equal(available(game,berlin).bomber,0);
  plan(game,berlin,uk,{},['wg',zone(112),zone(110)]);
  assert.deepEqual(orderPassages(game.orders[0]),through);
  commit(game);
  const landing=game.orders[0].landings.bomber[0];
  assert.notEqual(landing,berlin);
  assert(exercise.movement.landingSites(berlin,'bomber',uk,4).includes(landing));
  assert.deepEqual(game.battles[0].origins,[zone(110)]);
  const previous=game.units[landing].bomber||0;
  game.active=uk;game.battles[0].step='decision';
  retreat(game,retreatSites(game,game.battles[0])[0]);
  assert.equal(game.units[landing].bomber,previous+1);
  assert.equal(game.owners[zone(110)],'Sea zone');
});

test('an aircraft at full range cannot use a carrier one more space away',()=>{
  const {game}=opening(board=>{
    board['110 Sea Zone'].units=[['Germans','carrier',1],['Germans','fighter',1]];
    board['109 Sea Zone'].units=[];
    board['119 Sea Zone'].units=[['British','destroyer',1]];
    board['Western Germany'].facilityDamage={airfield:3};
  });
  const route=['hb',zone(110),zone(109)],end=zone(119);
  // The fighter is out of movement at its target. A friendly deck one zone away is too far.
  assert(!movementFor(game,'wg','fighter').legal(end,route));
  assert.throws(()=>plan(game,'wg',end,{fighter:1},route));
  assert.equal(game.orders.length,0);
});

test('fighters share carrier berths across sorties and strategic bombers require land',()=>{
  const {game,exercise}=opening(board=>{
    board['109 Sea Zone'].units=[['Germans','carrier',1],['Germans','fighter',1]];
    board['119 Sea Zone'].units=[['British','destroyer',1]];
  });
  const route=['hb',zone(110),zone(111)],to=zone(119);
  assert(movementFor(game,'wg','fighter',1).legal(to,route));
  assert(!movementFor(game,'wg','fighter',2).legal(to,route));
  plan(game,'wg',to,{fighter:1},route);
  assert(!movementFor(game,'wg','tactical_bomber').legal(to,route));
  assert.throws(()=>plan(game,'wg',to,{fighter:1,tactical_bomber:1},route));
  assert.deepEqual(game.orders[0].units,{fighter:1});
  assert(exercise.movement.landingSites('wg','bomber',to,6).every(id=>!exercise.movement.spaces[id].water));
  commit(game);assert.deepEqual(game.orders[0].landings.fighter,[zone(109)]);
});
