import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLanMatch,lanDecision,applyLanCommand} from '../lan-game.js';
import {places,exercises} from '../rules.js';

const asset=name=>JSON.parse(readFileSync(new URL('../assets/'+name+'.json',import.meta.url)));
const setup=asset('global-setup'),sectors=asset('world-sectors');
const oldPlaces={...places},oldGlobal=exercises.global;
after(()=>{
  for(const id of Object.keys(places))if(!(id in oldPlaces))delete places[id];
  Object.assign(places,oldPlaces);if(oldGlobal)exercises.global=oldGlobal;else delete exercises.global;
});
function session(side='Axis',research=false){
  let match=createLanMatch(setup,side,research);
  return {get match(){return match;},send(who,action,args){
    match=applyLanCommand(structuredClone(match),setup,sectors,who,action,args);
    return match;
  }};
}
test('LAN seats stay bound to their side from briefing through the income handoff',()=>{
  const t=session('Allies'),send=(action,args)=>t.send('Axis',action,args);
  assert.equal(t.match.controllers.Japanese,2);assert.equal(t.match.controllers.British,1);
  assert.throws(()=>t.send('Allies','begin-turn'));assert.throws(()=>send('collect'));
  send('begin-turn');assert.equal(t.match.phase,'purchase');const ipc=t.match.treasury.Germans;
  send('buy',{unit:'infantry',wallet:'Germans',delta:1});
  assert.equal(t.match.draft.infantry,1);send('pay');assert.equal(t.match.treasury.Germans,ipc-3);
  assert.throws(()=>send('pay'));send('commit');send('begin-noncombat');send('finish-noncombat');
  send('placements',{orders:[{wallet:'Germans',unit:'infantry',site:'wg',to:'wg',quantity:1}]});
  send('mobilize');if(!t.match.incomeReport.rolled)send('roll-convoys');
  send('collect');assert.equal(t.match.power,'Russians');assert.equal(lanDecision(t.match).side,'Allies');
  assert.throws(()=>send('begin-turn'));t.send('Allies','begin-turn');assert.equal(t.match.phase,'purchase');
});
test('LAN raid defenders direct their interceptors and roll interception from a resumed match',()=>{
  const t=session(),axis=(action,args)=>t.send('Axis',action,args),allies=(action,args)=>t.send('Allies',action,args);
  t.match.board['Holland Belgium'].units=[['Germans','bomber',2]];
  t.match.board.France.units=[['French','fighter',1],['French','factory_major',1]];
  axis('skip-research');axis('pay');axis('plan',{from:'hb',to:'fr',units:{bomber:1},raid:'factory_major'});
  axis('commit');assert.equal(lanDecision(t.match).side,'Allies');
  assert.throws(()=>axis('confirm-interceptors'));assert.throws(()=>allies('commit'));
  allies('interceptor',{to:'fr',power:'French',n:1});allies('confirm-interceptors');
  axis('raid-battle',{to:'fr'});axis('raid-step',{step:'attack',losses:[]});
  const rolls=structuredClone(t.match.combat.game.raids[0].attackDice);
  assert.throws(()=>axis('raid-step',{step:'defense'}));assert.throws(()=>allies('raid-step',{step:'damage'}));
  allies('raid-step',{step:'defense',losses:[]});assert.deepEqual(t.match.combat.game.raids[0].attackDice,rolls);
  assert.equal(lanDecision(t.match).side,'Axis');
});
test('French liberation interrupts either side and a finished board accepts no further actions',()=>{
  const m=createLanMatch(setup,'Allies',true);
  m.combat={game:{frenchAward:{status:'pending'}}};
  assert.deepEqual(lanDecision(m).actions,['french-unit','french-place']);assert.equal(lanDecision(m).side,'Allies');
  m.victory={side:'Allies'};assert.equal(lanDecision(m).side,null);
});
test('players set defense orders for their own side before movements are queued',()=>{
  const t=session();
  t.send('Allies','air-orders',{holds:{British:true}});
  assert(t.match.holdScrambles.British);assert.throws(()=>t.send('Axis','air-orders',{holds:{French:true}}));
  t.send('Axis','skip-research');t.send('Axis','pay');t.send('Axis','plan',{from:'hb',to:'fr',units:{inf:1}});
  assert.throws(()=>t.send('Allies','air-orders',{holds:{British:false}}));assert(t.match.holdScrambles.British);
});
