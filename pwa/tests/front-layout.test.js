import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyGroups,approachGap,frontGrid} from '../front-layout.js';

test('only compatible nearby approaches share a head, including in a chain',()=>{
  const leg=(x,dx=1,dy=0)=>({direction:[dx,dy],upstream:[x-30*dx,-30*dy],tip:[x,0]});
  const a=leg(0),b=leg(20),c=leg(65),opposite=leg(0,-1),crossing=leg(0,0,1),loop={...a,loop:true};
  assert.deepEqual(nearbyGroups([a,b,c,opposite,crossing,loop],approachGap,50),[[a,b],[c],[opposite],[crossing],[loop]]);
});

test('a crowded front uses aligned, unoccupied seats and a distant arrival stays local',()=>{
  const entry=(from,x,y,count)=>({from,center:[x,y],slots:Array.from({length:count},(_,i)=>({key:from+i,point:[x+i,y]}))});
  const north=entry('north',5,10,4),east=entry('east',25,25,5),south=entry('south',10,240,1);
  const homes=[[0,20],[41,30],[3,-13]];
  const layout=frontGrid([north,east,south],homes,1,()=>true);
  const other=frontGrid([south,east,north],homes,1,()=>true);
  assert.deepEqual(layout,other);
  assert.equal(layout.seats.size,10);
  assert.deepEqual(layout.seats.get('south0'),[10,240]);
  const block=layout.fronts.get('north0');
  assert.equal(block,layout.fronts.get('east0'));
  assert.equal(block.length,9);
  const all=Array.from(layout.seats.values());
  for(const [i,[x,y]] of all.entries()){
    for(const [u,v] of [...homes,...all.slice(i+1)])assert(Math.abs(x-u)>=42||Math.abs(y-v)>=26);
  }
  for(const [x,y] of block){
    assert.equal((x-block[0][0])%44+0,0);
    assert.equal((y-block[0][1])%28+0,0);
  }
});
