// Global 1940 Second Edition, "Scramble". Each base shares one dispatch limit
// across allied powers and adjacent zones for the attacker's entire turn.
import {exerciseOf,places,stats,ships,deckSpace} from './rules.js';

function threatenedZones(s,orders){
  const ex=exerciseOf(s),zones=new Map();
  for(const order of orders){
    const landing=order.landing,zone=landing?landing.path.at(-1):order.to;
    if(!places[zone]?.water)continue;
    if(!zones.has(zone))zones.set(zone,{zone,coasts:new Set(),powers:new Set(),value:0});
    if(landing)zones.get(zone).coasts.add(order.to);
  }
  for(const item of zones.values()){
    for(const id of [item.zone,...item.coasts]){
      if(item.coasts.has(id))item.powers.add(ex.shapes[id].homePower);
      for(const [power,type,n] of s.pieces[id]){
        if(n&&stats[type]&&ex.enemies.includes(power)){item.powers.add(power);item.value+=stats[type].cost*n;}
      }
    }
  }
  return [...zones.values()].sort((a,b)=>Number(!!b.coasts.size)-Number(!!a.coasts.size)||
    b.value-a.value||parseInt(places[a.zone].name)-parseInt(places[b.zone].name));
}
export function scramblePlan(s,orders=s.orders){
  const ex=exerciseOf(s),flights=[];
  if(!ex.defensiveBases?.length||!orders.length)return flights;
  const zones=threatenedZones(s,orders);
  for(const from of ex.defensiveBases){
    let room=3;
    const crews=s.pieces[from].filter(([p,t,n])=>n&&p!=='Chinese'&&!ex.holdScrambles[p==='UK_Pacific'?'British':p]&&ex.enemies.includes(p)&&
      ex.friends[p]?.includes(s.owners[from])&&(t==='fighter'||t==='tactical_bomber'))
      .map(([power,type,n])=>({power,type,n})).sort((a,b)=>stats[b.type].defense-stats[a.type].defense||
        Number(b.power===ex.shapes[from].homePower)-Number(a.power===ex.shapes[from].homePower)||a.power.localeCompare(b.power));
    for(const {zone,powers} of zones){
      if(!room)break;
      if(!ex.neighbors[from].includes(zone))continue;
      for(const crew of crews){
        if(!crew.n||!room||!ex.friendlyPowers[crew.power].some(p=>powers.has(p)))continue;
        const n=Math.min(crew.n,room);
        flights.push({from,zone,power:crew.power,type:crew.type,n,remaining:n});
        crew.n-=n;room-=n;
      }
    }
  }
  return flights;
}
// Support may be committed to any announced landing that could draw a scramble,
// even when the standing orders ultimately send the planes to another landing.
export function scrambleSupportZones(s){
  const zones=new Set();
  for(const order of s.orders){
    if(order.landing&&scramblePlan(s,[order]).length)zones.add(order.landing.path.at(-1));
  }
  return zones;
}
export function launchScrambles(s,flights){
  if(!flights.length)return;
  s.scrambles=flights;
  for(const f of flights){
    const row=s.pieces[f.from].find(([p,t,n])=>p===f.power&&t===f.type&&n>=f.n);
    row[2]-=f.n;s.units[f.from][f.type]-=f.n;
    s.record.push({title:'Defensive scramble · '+places[f.zone].name,
      detail:f.n+' × '+stats[f.type].name+' from '+places[f.from].name+'.',scramblePower:f.power});
  }
}
export function scrambleRows(s,zone){
  return (s.scrambles||[]).filter(f=>f.zone===zone&&!f.returning&&f.remaining)
    .map(f=>[f.power,f.type,f.remaining]);
}
export function leaveScrambleBattle(s,b){
  for(const f of s.scrambles||[]){
    if(f.zone!==b.to||f.returning)continue;
    f.returning=true;
    if(f.remaining)s.units[b.to][f.type]=Math.max(0,(s.units[b.to][f.type]||0)-f.remaining);
  }
}
function landDefender(s,f,id,n){
  let row=s.pieces[id].find(([p,t])=>p===f.power&&t===f.type);
  if(!row){row=[f.power,f.type,0];s.pieces[id].push(row);}
  row[2]+=n;s.units[id][f.type]=(s.units[id][f.type]||0)+n;
}
// Only after all combat is the launch territory's final controller known.
// Retain aircraft nationality and share scarce carrier spaces across diversions.
export function recoverScrambles(s){
  const interceptors=(s.raids||[]).flatMap(r=>r.interceptors.filter(f=>f.remaining).map(f=>
    ({...f,from:r.to,zone:r.to,type:'fighter',intercept:true})));
  const defendingFlights=[...(s.scrambles||[]),...interceptors];
  if(!defendingFlights.length||s.scramblesRecovered)return;
  const ex=exerciseOf(s),atSea=[],outcomes=new Map();
  function land(f,id,n){
    if(id)landDefender(s,f,id,n);
    const key=[f.from,f.zone,f.power,f.type,id].join('/');
    const item=outcomes.get(key)||{f,id,n:0};item.n+=n;outcomes.set(key,item);
  }
  for(const f of defendingFlights){
    if(!f.remaining)continue;
    const friendly=id=>!places[id].water&&!places[id].blocked&&ex.friends[f.power].includes(s.owners[id])&&
      (f.power!=='Chinese'||places[id].original==='Chinese'||['Burma','Kwangtung'].includes(places[id].name));
    const adjacent=ex.neighbors[f.zone];
    const landSite=friendly(f.from)?f.from:adjacent.find(friendly);
    if(landSite){land(f,landSite,f.remaining);continue;}
    const side=ex.friendlyPowers[f.power];
    const choices=[f.zone,...adjacent].filter(id=>places[id].water&&f.power!=='Chinese'&&
      !s.pieces[id].some(([p,t,n])=>n&&ex.hostileTo(f.power,p)&&ships.includes(t)&&t!=='submarine'&&t!=='transport'));
    for(let i=0;i<f.remaining;i++)atSea.push({f,side,choices});
  }
  // Match each aircraft to an actual carrier berth. A flexible flight can give
  // up a berth to one with only a single reachable carrier.
  const slots=new Map(),occupants=new Map();
  for(const flight of atSea){
    flight.options=[];
    for(const id of flight.choices){
      const capacity=deckSpace(s,id,flight.side);
      if(capacity<=0)continue;
      let room=capacity;
      for(const [p,t,n] of s.pieces[id]){
        if(t!=='carrier'||!flight.side.includes(p))continue;
        const berths=2*Math.max(0,n-(s.shipDamage?.[id]?.[p]?.carrier||0));
        for(let i=0;i<berths&&room>0;i++,room--){
          const key=[id,p,i].join('/');
          slots.set(key,id);flight.options.push(key);
        }
      }
    }
  }
  function reserve(flight,seen){
    for(const key of flight.options){
      if(seen.has(key))continue;
      seen.add(key);
      if(!occupants.has(key)||reserve(occupants.get(key),seen)){
        occupants.set(key,flight);flight.base=slots.get(key);return true;
      }
    }
    return false;
  }
  for(const flight of atSea)reserve(flight,new Set());
  for(const {f,base} of atSea)land(f,base||null,1);
  for(const {f,id,n} of outcomes.values()){
    s.record.push({title:id?(f.intercept?'Interceptor recovery · ':'Scramble recovery · ')+places[id].name:f.intercept?'Interceptor lost':'Scrambled aircraft lost',
      detail:n+' × '+stats[f.type].name+' from '+places[f.zone].name+
        (id===f.from?' returned to '+places[id].name+'.':id?' diverted to '+places[id].name+' after '+places[f.from].name+' fell.':
          ' lost after '+places[f.from].name+' fell. No friendly landing space was available.'),scramblePower:f.power,scrambleRecovery:true});
  }
  s.scramblesRecovered=true;
}
