// Global 1940 Second Edition, Combat Move and Amphibious Assaults.
import {exerciseOf,places,available,samePower,ships,count} from './rules.js';
export const landingTroops=['inf','artillery','tank','mech_infantry'];
export const escortShips=['destroyer','cruiser','battleship','submarine'];
const totalUnits=rows=>{
  const total={};
  for(const {type,n} of rows)total[type]=(total[type]||0)+n;
  return total;
};
export function departures(order){
  if(!order.landing)return [{from:order.from,units:order.units}];
  const {cargo,escorts}=order.landing;
  return [{from:order.from,units:{transport:1}},...cargo.map(({from,type,n})=>({from,units:{[type]:n}})),...escorts.map(({from,type,n})=>({from,units:{[type]:n}}))];
}
export function aboard(s,from){
  return (s.embarked?.[from]||[]).filter(h=>samePower(h.power,s.power));
}
function seaPaths(s,from,type){
  const ex=exerciseOf(s),spaces=ex.movement.spaces,range=ex.movement.allowance(from,type);
  const queue=[[from]];
  for(const path of queue){
    const last=path.at(-1);
    if(path.length>range||path.length>1&&(type==='submarine'?spaces[last].destroyer:spaces[last].blockingFleet))continue;
    for(const next of ex.neighbors[last]){
      if(spaces[next].water&&spaces[next].allowed&&ex.canalOpen(last,next,type)&&
        (type==='transport'||!path.includes(next)))queue.push([...path,next]);
    }
  }
  return queue.filter(path=>ex.seaStop(path.at(-1),type));
}
export function cargoSources(s,path){
  const ex=exerciseOf(s),sources=new Set();
  for(const zone of path){
    if(ex.movement.spaces[zone].blockingFleet)continue;
    for(const id of ex.neighbors[zone]){
      const space=ex.movement.spaces[id];
      if(!space.water&&space.friendly&&space.allowed)sources.add(id);
    }
  }
  return [...sources].flatMap(from=>{
    const free=available(s,from);
    return landingTroops.filter(t=>free[t]>0).map(type=>({from,type,n:free[type]}));
  });
}
export function landingRoutes(s,from){
  const ex=exerciseOf(s),choices=new Map();
  if(s.phase!=='plan'||!places[from]?.water||!(available(s,from).transport>0))return choices;
  const loaded=aboard(s,from).filter(h=>!s.orders.some(o=>o.landing?.load===h.id));
  const variants=new Set(),ports=new Map();
  for(const path of seaPaths(s,from,'transport')){
    const zone=path.at(-1);
    const portsOnPath=[...new Set(path.flatMap(id=>{
      if(!ports.has(id))ports.set(id,cargoSources(s,[id]).map(row=>row.from));
      return ports.get(id);
    }))].sort();
    if(!loaded.length&&!portsOnPath.length)continue;
    const key=[zone,...portsOnPath].join('/');
    if(variants.has(key))continue;
    variants.add(key);
    for(const to of ex.neighbors[zone]){
      if(!ex.movement.spaces[to].attackLand||!ex.movement.spaces[to].allowed)continue;
      if(!choices.has(to))choices.set(to,[]);
      choices.get(to).push(path);
    }
  }
  return choices;
}
export function escortOptions(s,zone){
  const choices=[];
  for(const [from,rows] of Object.entries(s.pieces)){
    if(!places[from].water||!rows.some(([p,t,n])=>n&&samePower(s.power,p)&&escortShips.includes(t)))continue;
    const free=available(s,from);
    for(const type of escortShips){
      if(!free[type])continue;
      const path=seaPaths(s,from,type).find(p=>p.at(-1)===zone);
      if(path)choices.push({from,type,n:free[type],path});
    }
  }
  return choices;
}
export function queueLanding(s,from,to,draft){
  const {path,cargo,escorts,load}=draft;
  const routes=landingRoutes(s,from).get(to)||[];
  if(!routes.some(p=>p.join('/')===path.join('/')))throw Error('Choose a legal transport route to a hostile coast.');
  const free=available(s,from).transport,loads=aboard(s,from).filter(h=>!s.orders.some(o=>o.landing?.load===h.id));
  const onboard=loads.find(h=>h.id===load);
  if(load?!onboard:free<=loads.length)throw Error('Choose an available transport and its onboard cargo.');
  function validate(rows,options){
    const seen=new Set();
    for(const row of rows){
      const key=row.from+'/'+row.type,option=options.find(o=>o.from===row.from&&o.type===row.type);
      if(seen.has(key)||!option||!Number.isSafeInteger(row.n)||row.n<1||row.n>option.n)throw Error('These units are already assigned or cannot reach this landing.');
      seen.add(key);
    }
  }
  validate(cargo,cargoSources(s,path));
  const zone=path.at(-1),support=escortOptions(s,zone);validate(escorts,support);
  const units={...onboard?.units};
  for(const [t,n] of Object.entries(totalUnits(cargo)))units[t]=(units[t]||0)+n;
  if(!count(units)||count(units)>2||count(units)-(units.inf||0)>1)throw Error('Load one land unit and, optionally, one additional infantry.');
  const supportRows=escorts.map(({from,type,n})=>({from,type,n,path:support.find(r=>r.from===from&&r.type===type).path}));
  const landing={path:[...path],engage:!!draft.engage&&!!exerciseOf(s).movement.spaces[zone].enemyFleet,load:load||null,cargo:cargo.map(({from,type,n})=>({from,type,n})),escorts:supportRows};
  s.orders=[...s.orders,{from,to,passages:path.slice(1),units,landing}];
}
export function landingSeaBattle(s,zone){
  const space=exerciseOf(s).movement.spaces[zone];
  return s.scrambles?.some(f=>f.zone===zone)||space.blockingFleet||space.enemyFleet&&s.orders.some(o=>o.landing?
    o.landing.engage&&o.landing.path.at(-1)===zone:o.to===zone);
}
export function checkLandingFleets(s){
  const ex=exerciseOf(s),zones=new Set(s.orders.filter(o=>o.landing).map(o=>o.landing.path.at(-1)));
  for(const zone of zones){
    const fighting=landingSeaBattle(s,zone);
    const ignoredSub=s.pieces[zone].some(([p,t,n])=>ex.enemies.includes(p)&&t==='submarine'&&n);
    const force=available(s,zone);
    for(const o of s.orders){
      if(o.landing?.path.at(-1)===zone)for(const {type,n} of o.landing.escorts)force[type]=(force[type]||0)+n;
      if(!o.landing&&o.to===zone)for(const [t,n] of Object.entries(o.units))force[t]=(force[t]||0)+n;
    }
    if(fighting&&!Object.entries(force).some(([t,n])=>n>0&&['submarine','destroyer','cruiser','battleship','fighter','tactical_bomber','bomber'].includes(t)))
      throw Error('Assign a combat escort or air support to the sea battle in '+places[zone].name+'.');
    if(!fighting&&ignoredSub&&!ships.some(t=>t!=='transport'&&force[t]>0))
      throw Error('An enemy submarine is present. Assign a warship to escort the landing in '+places[zone].name+'.');
  }
}
export function landingWait(s,b){
  return (b.offshore||[]).filter(id=>!s.battles.find(f=>f.to===id)?.resolved);
}
