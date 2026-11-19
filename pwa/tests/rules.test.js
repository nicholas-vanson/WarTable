import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,plan,available,commit,chooseBattle,rollRound,casualties,retreat} from '../rules.js';
const units=(inf,tank)=>({inf,tank});
test('revising and cancelling releases units and leaves no history',()=>{
 const s=newGame();plan(s,'hb','fr',units(5,1));
 assert.throws(()=>plan(s,'hb','nb',units(1,1)));
 plan(s,'hb','fr',units(2,0));plan(s,'hb','nb',units(3,1));
 plan(s,'hb','fr',units(0,0));
 assert.deepEqual(available(s,'hb'),units(2,1));assert.equal(s.record.length,0);
 assert.throws(()=>plan(s,'wg','nb',units(1,0)));assert.throws(()=>plan(s,'fr','wg',units(1,0)));
});
test('player orders battles; simultaneous losses return fire and ties retain defender control',()=>{
 const s=newGame();plan(s,'hb','nb',units(2,0));plan(s,'wg','fr',units(0,1));commit(s);
 chooseBattle(s,'nb');assert.throws(()=>chooseBattle(s,'fr'));rollRound(s,()=>1);
 assert.throws(()=>casualties(s,units(1,0)));casualties(s,units(2,0));
 assert.equal(s.owners.nb,'France');assert.equal(s.active,null);assert.equal(s.phase,'combat');
 chooseBattle(s,'fr');rollRound(s,()=>1);casualties(s,units(0,1));assert.equal(s.phase,'review');
});
test('defender loses cheapest units; full force may retreat to either contributing origin',()=>{
 const s=newGame();plan(s,'hb','fr',units(1,1));plan(s,'wg','fr',units(1,0));commit(s);chooseBattle(s,'fr');
 const seq=[1,6,6,6,6,6,6];rollRound(s,()=>seq.shift());assert.deepEqual(s.units.fr,units(2,1));
 assert.throws(()=>retreat(s,'nb'));retreat(s,'wg');assert.deepEqual(s.units.wg,units(5,4));assert.equal(s.phase,'review');
});
test('stored casualty step can resume with original dice and capture survives serialization',()=>{
 const s=newGame();plan(s,'hb','nb',units(1,2));commit(s);chooseBattle(s,'nb');
 const seq=[6,2,3,1,6];rollRound(s,()=>seq.shift());
 const copy=JSON.parse(JSON.stringify(s));assert.throws(()=>rollRound(copy));casualties(copy,units(0,1));
 assert.equal(copy.owners.nb,'Germany');assert.deepEqual(copy.units.nb,units(1,1));assert.equal(copy.phase,'review');
});
