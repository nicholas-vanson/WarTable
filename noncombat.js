import {recoverScrambles} from './scramble.js';
import {departures,aboard} from './assault.js';
// Drafts replay from the resolved battle position. Arrivals never replenish the
// opening allowance, including when a stack returns to its starting territory.
import {places,stats,ships,aircraft,samePower,exerciseOf,deckSpace,reservedBerths} from './rules.js';
import {neutralKey,takeFriendlyControl,hostileNeutral} from './neutral-rules.js';

export function beginNoncombat(game){
  if(game.frenchAward?.status==='pending')throw Error('France must finish its liberation placement first.');
  if(game.exercise!=='global'||game.phase!=='review'||game.battles.some(b=>!b.resolved))
    throw Error('Resolve every battle before starting noncombat movement.');
  recoverScrambles(game);
  game.phase='noncombat';game.noncombatOrders=[];
}
function sumStackType(rows,type,test){
  return rows.reduce((sum,[power,t,n])=>sum+(t===type&&test(power)?n:0),0);
}
function transferNoncombatUnits(g,from,to,type,n,test){
  if(!n||from===to)return;
  if(sumStackType(g.pieces[from],type,test)<n)throw Error('The departing stack is too small.');
  let left=n;
  for(const row of g.pieces[from]){
    if(row[1]!==type||!test(row[0])||!row[2])continue;
    const amount=Math.min(left,row[2]);row[2]-=amount;left-=amount;
    let target=g.pieces[to].find(([p,t])=>p===row[0]&&t===type);
    if(!target){target=[row[0],type,0];g.pieces[to].push(target);}
    target[2]+=amount;
    if(!left)break;
  }
  g.units[from][type]=Math.max(0,(g.units[from][type]||0)-n);
  g.units[to][type]=(g.units[to][type]||0)+n;
}
function freeCarrierSpaces(g,id){
  return deckSpace(g,id,exerciseOf(g).friendlyPowers[g.power]);
}
function friendlyDestination(g,id){return exerciseOf(g).friends[g.power].includes(g.owners[id]);}
function canActivateDestination(g,id){
  const key=neutralKey(g.owners[id]);
  return !!key&&exerciseOf(g).neutralEntry[id]&&!hostileNeutral(g.power,key);
}
function canEnterSeaZone(g,id,type){
  const enemies=exerciseOf(g).enemies;
  return !g.pieces[id].some(([p,t,n])=>n&&enemies.includes(p)&&ships.includes(t)&&
    (type==='submarine'?t==='destroyer':t!=='submarine'&&t!=='transport'));
}
function friendlyAtStart(g,id){
  return exerciseOf(g).friends[g.power].includes(places[id].startOwner);
}
function carrierPassengers(g,from,n){
  const ex=exerciseOf(g),rows=g.pieces[from],damaged=g.unusedDamage[from]?.carrier||0;
  const room=2*Math.max(0,n-damaged);
  let required=Math.max(0,room-freeCarrierSpaces(g,from));
  const passengers=[],available={...g.unused[from]};
  for(const [p,t,count] of rows){
    if(!required)break;
    if(!ex.friendlyPowers[g.power].includes(p)||!['fighter','tactical_bomber'].includes(t))continue;
    const own=samePower(p,g.power),remaining=own?available[t]||0:count;
    const seats=Math.min(required,count,remaining);
    if(seats){passengers.push([p,t,seats]);required-=seats;if(own)available[t]-=seats;}
  }
  return required?null:passengers;
}
// Breadth-first search on printed connections returns the shortest legal itinerary
// for each destination, including seams. A legal stop need not be a legal passage.
function shortestNoncombatRoutes(g,from,range,edge,transit,finish){
  const result=new Map(),visited=new Set([from]),queue=[[from]];
  for(const path of queue){
    if(path.length>range)continue;
    const last=path.at(-1);
    for(const to of exerciseOf(g).neighbors[last]){
      if(to===from||visited.has(to)||!edge(last,to))continue;
      const next=[...path,to];visited.add(to);
      if(finish(to))result.set(to,next);
      if(transit(to))queue.push(next);
    }
  }
  return result;
}
function shipRedeployments(g,from,type){
  const ex=exerciseOf(g);
  return shortestNoncombatRoutes(g,from,ex.movement.allowance(from,type),
    (a,b)=>places[b].water&&ex.movement.spaces[b].allowed&&ex.canalOpen(a,b,type)&&canEnterSeaZone(g,b,type),()=>true,id=>ex.seaStop(id,type));
}
function idleCargo(g,zone){return aboard(g,zone).filter(h=>!g.spentCargo.includes(h.id));}
function emptyTransports(g,zone){return Math.max(0,(g.unused[zone]?.transport||0)-idleCargo(g,zone).length);}
function transportCrossings(g,from){
  const ex=exerciseOf(g),choices=new Map();
  for(const port of ex.neighbors[from]){
    if(!places[port].water||!emptyTransports(g,port)||!canEnterSeaZone(g,port,'transport'))continue;
    const paths=[...shipRedeployments(g,port,'transport').values()];
    if(ex.seaStop(port,'transport'))paths.unshift([port]);
    for(const path of paths)for(const to of ex.neighbors[path.at(-1)]){
      if(to===from||places[to].water||!ex.movement.spaces[to].allowed||!(friendlyDestination(g,to)||canActivateDestination(g,to)))continue;
      const route=[from,...path,to];
      if(!choices.has(to)||route.length<choices.get(to).length)choices.set(to,route);
    }
  }
  return choices;
}
export function noncombatRoutes(g,order){
  const {from,type,quantity,flight,transport,extraInf}=order,ex=exerciseOf(g);
  const sortie=flight==null?null:g.flights[flight];
  if(!g.unused[from]||!stats[type]||!Number.isSafeInteger(quantity)||quantity<1||
    (flight!=null&&(!sortie||sortie.from!==from||sortie.type!==type))||
    quantity>(sortie?sortie.available:g.unused[from][type]||0))return new Map();
  if(order.load){
    if(type!=='transport'||quantity!==1||g.spentCargo.includes(order.load)||!aboard(g,from).some(h=>h.id===order.load))return new Map();
    const routes=new Map();
    for(const path of [[from],...shipRedeployments(g,from,type).values()]){
      const zone=path.at(-1);
      if(!ex.seaStop(zone,type)||!canEnterSeaZone(g,zone,type))continue;
      for(const id of ex.neighbors[zone])if(!places[id].water&&ex.movement.spaces[id].allowed&&
        (friendlyDestination(g,id)||canActivateDestination(g,id))&&!routes.has(id))routes.set(id,[...path,id]);
    }
    return routes;
  }
  if(transport){
    if(sortie||ships.includes(type)||aircraft.includes(type)||quantity>(type==='inf'?2:1)||
      (extraInf&&(type==='inf'||!(g.unused[from].inf>0))))return new Map();
    return transportCrossings(g,from);
  }
  if(extraInf)return new Map();
  if(ships.includes(type)){
    if(type==='carrier'&&!carrierPassengers(g,from,quantity))return new Map();
    return shipRedeployments(g,from,type);
  }
  if(aircraft.includes(type)){
    const slots=id=>type!=='bomber'&&(canEnterSeaZone(g,id,'carrier')||reservedBerths(g,id)>=quantity)&&freeCarrierSpaces(g,id)>=quantity;
    const canLand=id=>places[id].water?slots(id):friendlyAtStart(g,id)&&friendlyDestination(g,id);
    const range=sortie?sortie.range:ex.movement.allowance(from,type);
    const result=shortestNoncombatRoutes(g,from,range,(_,id)=>{
      const space=ex.movement.spaces[id];
      return space.allowed&&(space.water||space.enemy||friendlyAtStart(g,id)||friendlyDestination(g,id)&&!neutralKey(places[id].startOwner));
    },()=>true,canLand);
    if(sortie&&canLand(from))result.set(from,[from]);
    if(sortie)result.delete(sortie.base);
    return result;
  }
  return shortestNoncombatRoutes(g,from,ex.movement.allowance(from,type),(_,id)=>!places[id].water&&ex.movement.spaces[id].allowed&&
    (friendlyDestination(g,id)||canActivateDestination(g,id)),id=>friendlyDestination(g,id)&&!neutralKey(places[id].startOwner),()=>true);
}
function moveNoncombatShip(g,from,to,type,n){
  const own=p=>samePower(p,g.power);
  if(type==='transport'&&from!==to){
    const loads=idleCargo(g,from).slice(0,Math.max(0,n-emptyTransports(g,from)));
    for(const boat of loads){
      g.embarked[from]=g.embarked[from].filter(h=>h.id!==boat.id);
      (g.embarked[to]??=[]).push(boat);g.spentCargo.push(boat.id);
    }
  }
  if(type==='carrier'){
    const load=carrierPassengers(g,from,n);
    if(!load)throw Error('Move the aircraft to a legal landing site first.');
    for(const [power,t,seats] of load){
      transferNoncombatUnits(g,from,to,t,seats,p=>p===power);
      if(own(power))g.unused[from][t]-=seats;
    }
  }
  const damaged=Math.min(n,g.unusedDamage[from]?.[type]||0);
  if(damaged&&from!==to){
    const origin=g.shipDamage[from][g.power],dest=(g.shipDamage[to]??={})[g.power]??={};
    origin[type]-=damaged;dest[type]=(dest[type]||0)+damaged;
  }
  if(damaged)g.unusedDamage[from][type]-=damaged;
  transferNoncombatUnits(g,from,to,type,n,own);g.unused[from][type]-=n;
}
function applyNoncombatOrder(g,order){
  const path=noncombatRoutes(g,order).get(order.to);
  if(!path)throw Error('Choose an available unit and a highlighted destination.');
  const {from,to,type,quantity,flight,transport,extraInf}=order,own=p=>samePower(p,g.power);
  if(order.load){
    const boat=aboard(g,from).find(h=>h.id===order.load),zone=path.at(-2);
    g.embarked[from]=g.embarked[from].filter(h=>h.id!==boat.id);
    transferNoncombatUnits(g,from,zone,'transport',1,own);g.unused[from].transport--;
    if(canActivateDestination(g,to))takeFriendlyControl(g,to,g.power,exerciseOf(g).attacker);
    for(const [t,n] of Object.entries(boat.units)){
      let row=g.pieces[to].find(([p,k])=>p===boat.power&&k===t);
      if(!row){row=[boat.power,t,0];g.pieces[to].push(row);}
      row[2]+=n;g.units[to][t]=(g.units[to][t]||0)+n;
    }
    g.moves.push({...order,path,unloaded:boat.units});return;
  }
  if(flight!=null){
    const sortie=g.flights[flight];
    if(sortie.base)transferNoncombatUnits(g,sortie.base,to,type,quantity,own);
    else{
      let row=g.pieces[to].find(([p,t])=>p===g.power&&t===type);
      if(!row){row=[g.power,type,0];g.pieces[to].push(row);}
      row[2]+=quantity;g.units[to][type]=(g.units[to][type]||0)+quantity;
    }
    sortie.available-=quantity;
  }else if(ships.includes(type))moveNoncombatShip(g,from,to,type,quantity);
  else{
    if(transport)moveNoncombatShip(g,path[1],path.at(-2),'transport',1);
    if(canActivateDestination(g,to)){
      takeFriendlyControl(g,to,g.power,exerciseOf(g).attacker);
    }
    transferNoncombatUnits(g,from,to,type,quantity,own);g.unused[from][type]-=quantity;
    if(extraInf){transferNoncombatUnits(g,from,to,'inf',1,own);g.unused[from].inf--;}
  }
  g.moves.push({...order,path});
}
export function noncombatPosition(s,orders=s.noncombatOrders||[]){
  if(s.phase!=='noncombat')throw Error('Noncombat movement is not open.');
  const ex=exerciseOf(s),own=p=>samePower(p,s.power);
  const g={...s,pieces:structuredClone(s.pieces),owners:{...s.owners},units:structuredClone(s.units),
    shipDamage:structuredClone(s.shipDamage||{}),embarked:structuredClone(s.embarked||{}),spentCargo:[...(s.spentCargo||[])],unused:{},unusedDamage:{},moves:[],
    flights:(s.landedFlights||[]).map(f=>({...f,available:f.count}))};
  const spent=[...s.orders.flatMap(departures),...(s.navalParticipants||[]).filter(o=>o.garrison)];
  for(const [id,rows] of Object.entries(s.pieces)){
    const free=g.unused[id]={};
    for(const [p,t,n] of ex.shapes[id].garrison)if(own(p)&&stats[t])free[t]=(free[t]||0)+n;
    for(const o of spent)if(o.from===id)for(const [t,n] of Object.entries(o.units))free[t]=(free[t]||0)-n;
    for(const t of Object.keys(free))free[t]=Math.max(0,Math.min(sumStackType(rows,t,own),free[t]-(s.activationMoves?.[id]?.[t]||0)));
    for(const t of ['carrier','battleship']){
      const opening=ex.openingDamage?.[id]?.[s.power]?.[t]||0;
      const departed=spent.reduce((sum,o)=>sum+(o.from===id?(o.units[t]||0):0),0);
      (g.unusedDamage[id]??={})[t]=Math.max(0,Math.min(opening-departed,s.shipDamage?.[id]?.[s.power]?.[t]||0));
    }
  }
  for(const o of orders)applyNoncombatOrder(g,o);
  return g;
}

export function completeNoncombat(s){
  const g=noncombatPosition(s),record=[...s.record];
  for(const [index,f] of g.flights.entries()){
    if(!f.available)continue;
    if(f.base){
      record.push({title:places[f.from].name+' → '+places[f.base].name,detail:'Landing · '+f.available+' × '+stats[f.type].name});
      continue;
    }
    if(noncombatRoutes(g,{from:f.from,type:f.type,quantity:1,flight:index}).size)
      throw Error('Choose a landing site for the remaining '+stats[f.type].name.toLowerCase()+'.');
    record.push({title:places[f.from].name,detail:f.available+' '+stats[f.type].name+' lost without a landing space.'});
  }
  for(const m of g.moves)record.push({title:m.path.map(id=>places[id].name).join(' → '),
    detail:m.unloaded?'Unloaded transport cargo · '+Object.entries(m.unloaded).map(([t,n])=>n+' × '+stats[t].name).join(', '):(m.flight!=null?'Landing · ':m.transport?'Sea crossing · ':'Noncombat move · ')+m.quantity+' × '+stats[m.type].name+(m.extraInf?' + 1 infantry':'')});
  if(!g.moves.length)record.push({title:'Noncombat move',detail:'No redeployments ordered.'});
  return {...s,phase:'noncombatComplete',pieces:g.pieces,units:g.units,owners:g.owners,shipDamage:g.shipDamage,embarked:g.embarked,record};
}
