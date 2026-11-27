// A combat route uses the printed adjacency graph, including edges across the map seam.
import {aircraft,ships} from './rules.js';

export const asPassages=value=>Array.isArray(value)?value:value?[value]:[];
export const orderPassages=order=>asPassages(order.passages??order.via);
export const entrySpace=order=>orderPassages(order).at(-1)||order.from;
export function samePassages(order,value){
  const a=orderPassages(order),b=asPassages(value);
  return a.length===b.length&&a.every((id,i)=>id===b[i]);
}

export function combatMovement(spaces,neighbors,canalOpen,seaStop=()=>true){
  const flightDistances=new Map();
  const flyOver=id=>{
    const p=spaces[id];
    return p.allowed&&(p.water||p.friendly||p.enemy);
  };
  function distancesFrom(target){
    if(flightDistances.has(target))return flightDistances.get(target);
    const distances=new Map([[target,0]]),queue=[target];
    for(const id of queue){
      for(const next of neighbors[id]){
        if(!flyOver(next)||distances.has(next))continue;
        distances.set(next,distances.get(id)+1);
        queue.push(next);
      }
    }
    flightDistances.set(target,distances);
    return distances;
  }
  function allowance(from,type){
    if(aircraft.includes(type))return (type==='bomber'?6:4)+Number(spaces[from].airBase);
    if(ships.includes(type))return 2+Number(spaces[from].navalBase);
    return type==='tank'||type==='mech_infantry'?2:1;
  }
  function landingSites(from,type,to,spent){
    const remaining=allowance(from,type)-spent,sites=[];
    for(const [id,distance] of distancesFrom(to)){
      if(distance>remaining)break;
      const p=spaces[id];
      if(p.friendly||p.water&&type!=='bomber')sites.push(id);
    }
    return sites;
  }
  function searchFor(from,type,{canBlitz=true,canLand=()=>true,supportZones}={}){
    const air=aircraft.includes(type),ship=ships.includes(type),armored=type==='tank'||type==='mech_infantry';
    const range=allowance(from,type);
    function edge(a,b){
      const p=spaces[b];
      return p.allowed&&(air|| (ship?p.water&&canalOpen(a,b,type):!p.water));
    }
    function transit(id){
      const p=spaces[id];
      if(air)return flyOver(id);
      if(ship)return type==='submarine'?!p.destroyer:!p.blockingFleet;
      return p.friendly||armored&&canBlitz&&p.blitz;
    }
    function finish(last,to,spent){
      const p=spaces[to];
      if(ship&&!seaStop(to,type))return false;
      if(p.water?!p.enemyFleet&&!supportZones?.has(to):!p.attackLand){
        return armored&&last!==from&&spaces[last].blitz&&p.friendly;
      }
      return !air||canLand(to,spent);
    }
    function legal(to,passages=[]){
      if(!spaces[to]||passages.length+1>range)return false;
      const used=new Set([from]);
      let current=from;
      for(const id of passages){
        if(used.has(id)||id===to||!neighbors[current].includes(id)||!edge(current,id)||!transit(id))return false;
        used.add(id);current=id;
      }
      if(to===from&&!(armored&&spaces[current].blitz))return false;
      return neighbors[current].includes(to)&&edge(current,to)&&finish(current,to,passages.length+1);
    }
    // Breadth-first search finds a continuation without enumerating entire flight paths.
    function reachable(prefix,goal){
      const start=prefix.at(-1)||from,skip=new Set([from,...prefix]),seen=new Set(skip);
      const ends=new Set(),queue=[[start,prefix.length]];
      for(const [at,spent] of queue){
        if(spent>=range)continue;
        for(const id of neighbors[at]){
          if(!edge(at,id))continue;
          if(!skip.has(id)||id===from&&armored&&spaces[at].blitz){
            if((!goal||id===goal)&&finish(at,id,spent+1)){
              ends.add(id);if(goal)return ends;
            }
          }
          if(id!==goal&&!seen.has(id)&&spent+1<range&&transit(id)){
            seen.add(id);queue.push([id,spent+1]);
          }
        }
      }
      return ends;
    }
    function passagesTo(to,prefix=[]){
      const at=prefix.at(-1)||from;
      if(prefix.length+1>=range)return [];
      return neighbors[at].filter(id=>id!==to&&id!==from&&!prefix.includes(id)&&edge(at,id)&&transit(id)&&reachable([...prefix,id],to).has(to));
    }
    function destinations(multiOnly=false){
      if(!multiOnly)return [...reachable([])];
      const ends=new Set();
      if(range>1)for(const id of neighbors[from]){
        if(!edge(from,id)||!transit(id))continue;
        for(const to of reachable([id]))ends.add(to);
      }
      return [...ends];
    }
    return {range,legal,passagesTo,destinations};
  }
  return {spaces,allowance,landingSites,searchFor};
}
