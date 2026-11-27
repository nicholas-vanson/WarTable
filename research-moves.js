import {exerciseOf,places,samePower,available,die,resumeCombat} from './rules.js';
import {entrySpace} from './movement.js';
import {hasTech} from './research.js';
import {raidTargets,damageLimit,facilityHits,raidFacilityNames} from './raids.js';

function supportedCoast(s,to){
  return s.orders.some(o=>o.to===to&&!o.raid&&!o.drop&&(o.landing||!places[entrySpace(o)].water&&
    ['inf','tank','artillery','mech_infantry'].some(t=>o.units[t]>0)));
}
export function researchRoutes(s,from,kind){
  const ex=exerciseOf(s),space=ex.movement?.spaces[from],routes=new Map();
  if(s.phase!=='plan'||!hasTech(ex,s.power,kind)||!space?.allowed||!space.airBase)return routes;
  if(kind==='rockets'&&!samePower(ex.shapes[from].homePower,s.power))return routes;
  const range=kind==='rockets'?4:3,seen=new Set([from]),queue=[[from]];
  for(const path of queue){
    if(path.length>range)continue;
    for(const to of ex.neighbors[path.at(-1)]){
      if(seen.has(to))continue;
      const p=ex.movement.spaces[to];
      if(!p.allowed||!(p.friendly||p.enemy||p.water))continue;
      seen.add(to);
      const next=[...path,to];queue.push(next);
      if(!p.enemy||p.water)continue;
      if(kind==='rockets'?raidTargets(s,to,'bomber').length:supportedCoast(s,to))routes.set(to,next);
    }
  }
  return routes;
}
export function dropRoom(s,from){
  const used=s.orders.filter(o=>o.drop&&o.from===from).reduce((n,o)=>n+o.units.inf,0);
  return Math.min(2-used,available(s,from).inf||0);
}
export function queueDrop(s,from,to,n){
  const path=researchRoutes(s,from,'paratroopers').get(to);
  if(!path||!Number.isSafeInteger(n)||n<1||n>dropRoom(s,from))throw Error('Choose up to two available infantry and a supported land attack.');
  s.orders=[...s.orders,{from,to,drop:true,passages:path.slice(1,-1),units:{inf:n}}];
}
export function queueRocket(s,from,to,target){
  if(!researchRoutes(s,from,'rockets').has(to)||!raidTargets(s,to,'bomber').includes(target))throw Error('Choose an enemy facility within four spaces of this air base.');
  s.rocketOrders=[...(s.rocketOrders||[]).filter(o=>o.from!==from),{from,to,target}];
}
export function validateResearchMoves(s){
  for(const o of s.orders.filter(o=>o.drop))if(!researchRoutes(s,o.from,'paratroopers').has(o.to))
    throw Error('Paratroopers need a ground or amphibious attack. Restore that attack or cancel the drop.');
  for(const o of s.rocketOrders||[])if(!researchRoutes(s,o.from,'rockets').has(o.to)||!raidTargets(s,o.to,'bomber').includes(o.target))
    throw Error('This rocket order needs an operational base and a reachable enemy facility.');
}
export const rocketsPending=s=>(s.rocketOrders||[]).some(o=>o.face==null);
export function fireRocket(s,from,random=die){
  const o=s.rocketOrders?.find(o=>o.from===from);
  if(s.phase!=='combat'||s.raidDefensePending||s.active||s.activeRaid||!o||o.face!=null)throw Error('This rocket attack is unavailable.');
  const before=facilityHits(s,o.to,o.target);o.face=random();o.total=Math.min(damageLimit[o.target],before+o.face);
  ((s.raidDamage??={})[o.to]??={})[o.target]=o.total;
  s.record.push({rocket:true,raid:true,title:'Rocket · '+places[o.to].name,detail:places[from].name+' rolled '+o.face+' against '+raidFacilityNames[o.target]+'. Added '+(o.total-before)+' damage, now '+o.total+' of '+damageLimit[o.target]+'.'});
  resumeCombat(s);
}
