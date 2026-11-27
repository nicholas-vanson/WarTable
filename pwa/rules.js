import {checkRaidOrders,prepareRaids,pendingRaids,raidTargets} from './raids.js';
import {scramblePlan,scrambleSupportZones,launchScrambles,scrambleRows,leaveScrambleBattle} from './scramble.js';
import {departures,aboard,checkLandingFleets,landingSeaBattle,landingWait} from './assault.js';
import {asPassages,orderPassages,entrySpace,samePassages} from './movement.js';
import {invadeNeutrals,settleMongolianPact,neutralKey} from './neutral-rules.js';
// The local exercise models adjacent overland attacks with infantry and tanks.
export const places = {
  hb: {name:'Holland Belgium', owner:'Germany', targets:['fr','nb'], lon:5.0, lat:51.6},
  wg: {name:'Western Germany', owner:'Germany', targets:['fr'], lon:8.9, lat:50.6},
  nb: {name:'Normandy Bordeaux', owner:'France', targets:[], lon:-.8, lat:47.45},
  fr: {name:'France', owner:'France', targets:[], lon:2.65, lat:48.45}
};
Object.assign(places,{
  ni:{name:'Northern Italy',owner:'Italy',targets:['af','sf']},
  af:{name:'France',owner:'France',targets:[]},
  sf:{name:'Southern France',owner:'France',targets:[]},
  bs:{name:'Baltic States',owner:'Soviet Union',targets:['pl']},
  ep:{name:'Eastern Poland',owner:'Soviet Union',targets:['pl','ro']},
  be:{name:'Bessarabia',owner:'Soviet Union',targets:['ro']},
  pl:{name:'Poland',owner:'Germany',targets:[]},
  ro:{name:'Romania',owner:'Germany',targets:[]}
});
export const exercises={
  west:{name:'Western Front',attacker:'Germany',defender:'France',camera:{x:590,y:985,z:1},
    forces:{hb:[5,2],wg:[4,3],nb:[2,0],fr:[3,1]}},
  alps:{name:'Alpine Front',attacker:'Italy',defender:'France',camera:{x:665,y:1175,z:1.28},
    forces:{ni:[7,3],af:[3,1],sf:[2,1]}},
  east:{name:'Eastern Front',attacker:'Soviet Union',defender:'Germany',camera:{x:1255,y:943,z:.72},
    forces:{bs:[4,2],ep:[6,3],be:[4,1],pl:[4,2],ro:[3,2]}}
};
export const exerciseOf=s=>exercises[s.exercise||'west'];
export const adjectives={Germany:'German',France:'French',Italy:'Italian','Soviet Union':'Soviet','United Kingdom':'British','United States':'American',Japan:'Japanese',China:'Chinese',ANZAC:'ANZAC',Netherlands:'Dutch'};
// Victory cities within this atlas, from Europe 1940 Second Edition, pp. 6 and 34.
export const theaterVictoryCities=[
  {name:'London',lon:-.12,lat:51.51,capitalOf:'United Kingdom'},
  {name:'Paris',lon:2.35,lat:48.86,capitalOf:'France',territory:'fr'},
  {name:'Berlin',lon:13.41,lat:52.52,capitalOf:'Germany'},
  {name:'Rome',lon:12.5,lat:41.9,capitalOf:'Italy'},
  {name:'Moscow',lon:37.62,lat:55.75,capitalOf:'Soviet Union'},
  {name:'Warsaw',lon:21.01,lat:52.23,territory:'pl'},
  {name:'Leningrad',lon:30.32,lat:59.94},
  {name:'Stalingrad',lon:44.51,lat:48.71}
];
export const types = ['inf','tank'];
export const stats = {
  inf:{name:'Infantry',attack:1,defense:2,cost:3},
  tank:{name:'Tank',attack:3,defense:3,cost:6}
};
Object.assign(stats,{
  artillery:{name:'Artillery',attack:2,defense:2,cost:4,code:'ART'},mech_infantry:{name:'Mechanized infantry',attack:1,defense:2,cost:4,code:'MECH'},
  aaGun:{name:'AAA',defense:0,cost:5,code:'AAA'},fighter:{name:'Fighter',attack:3,defense:4,cost:10,code:'FTR'},
  tactical_bomber:{name:'Tactical bomber',attack:3,defense:3,cost:11,code:'TAC'},bomber:{name:'Strategic bomber',attack:4,defense:1,cost:12,code:'BMR'}
});
Object.assign(stats,{
  submarine:{name:'Submarine',attack:2,defense:1,cost:6},transport:{name:'Transport',attack:0,defense:0,cost:7},
  destroyer:{name:'Destroyer',attack:2,defense:2,cost:8},cruiser:{name:'Cruiser',attack:3,defense:3,cost:12},
  carrier:{name:'Aircraft carrier',attack:0,defense:2,cost:16},battleship:{name:'Battleship',attack:4,defense:4,cost:20}
});
export const aircraft=['fighter','tactical_bomber','bomber'];
export const ships=['submarine','transport','destroyer','cruiser','carrier','battleship'];
const capitalsAtSea=['carrier','battleship'];
export const mobileTypes=Object.keys(stats).filter(type=>type!=='aaGun');
export const samePower=(a,b)=>a===b||[a,b].every(p=>p==='British'||p==='UK_Pacific');
export function targetsFor(s,from,type){
  const place=places[from];
  return place?.unitTargets?.[type]??(place?.unitTargets?[]:place?.targets||[]);
}
export function defendingRows(s,id){
  const rows=(s.pieces?.[id]||[]).filter(([p,t,n])=>n>0&&stats[t]&&
    (!places[id].water||exerciseOf(s).enemies.includes(p)));
  return s.scrambles&&places[id].water?rows.concat(scrambleRows(s,id)):rows;
}
export function strengthOf(rows){
  const force={inf:0,tank:0};
  for(const [,type,n] of rows)force[type]=(force[type]||0)+n;
  return force;
}
export const count=units=>Object.values(units).reduce((n,v)=>n+v,0);
const casualtyOrder=Object.keys(stats).sort((a,b)=>stats[a].cost-stats[b].cost);
export const describe = units => Object.keys(stats).filter(k=>units[k]).map(k=>k==='inf' ? units[k]+' infantry' : k==='tank'?units[k]+(units[k]===1?' tank':' tanks'):units[k]+' '+stats[k].name.toLowerCase()).join(', ') || 'no units';
const empty = () => ({inf:0,tank:0});
export function newGame(exercise='west') {
  const units={},owners={};
  for(const [id,[inf,tank]] of Object.entries(exercises[exercise].forces)){
    units[id]={inf,tank};owners[id]=places[id].owner;
  }
  return {version:1,exercise,phase:'plan',units,owners,orders:[],battles:[],active:null,record:[]};
}
function check(ok, message) { if (!ok) throw new Error(message); }
export function available(s, from, exceptTarget=null,via=null,raid=null,raidType=null) {
  const free=s.pieces?strengthOf(s.pieces[from].filter(([p,t])=>samePower(p,s.power)&&mobileTypes.includes(t))):{...s.units[from]};
  for(const order of s.orders){
    if(!order.landing&&(order.raid||null)===raid&&(!raid||order.units[raidType])&&order.from===from&&order.to===exceptTarget&&samePassages(order,via))continue;
    for(const leg of departures(order))if(leg.from===from)for(const [k,n] of Object.entries(leg.units))if(n)free[k]=(free[k]||0)-n;
  }
  return free;
}
function validUnits(units,limit) {
  return Object.entries(units).every(([k,n])=>mobileTypes.includes(k)&&Number.isSafeInteger(n)&&n>=0&&n<=(limit[k]||0));
}
// Use the same movement search for map choices, editing orders and final validation.
export function movementFor(s,from,type,quantity=1){
  const movement=exerciseOf(s).movement;
  if(!movement)return null;
  const free=available(s,from);
  const landingCache=new Map();
  function canLand(to,spent){
    const key=to+'/'+spent;
    if(landingCache.has(key))return landingCache.get(key);
    const flight={from,to,units:{[type]:quantity}};
    const possible=!!flightRecoveries(s,[...s.orders,flight],flight,spent);
    landingCache.set(key,possible);
    return possible;
  }
  const search=movement.searchFor(from,type,{canLand,supportZones:scrambleSupportZones(s)});
  if(type!=='mech_infantry')return search;
  const solo=movement.searchFor(from,type,{canBlitz:false});
  // A tank can escort one mechanized infantry only along the identical blitz route.
  const escorted=(to,via)=>{
    const prior=s.orders.find(o=>!o.landing&&o.from===from&&o.to===to&&samePassages(o,[via]));
    return (free.tank||0)+(prior?.units.tank||0)-(prior?.units.mech_infantry||0)>=quantity;
  };
  return {...search,
    legal(to,path=[]){
      return search.legal(to,path)&&(!path.length||!movement.spaces[path[0]].blitz||escorted(to,path[0]));
    },
    passagesTo(to,prefix=[]){return search.passagesTo(to,prefix).filter(v=>!movement.spaces[v].blitz||escorted(to,v));},
    destinations(multiOnly=false){
      return search.destinations(multiOnly).filter(to=>!multiOnly&&solo.legal(to)||this.passagesTo(to).length);
    }};
}
export function plan(s,from,to,units,via=null,raid=null) {
  check(s.phase==='plan','Movement has already been committed.');
  const path=asPassages(via),selected=Object.keys(units).filter(t=>units[t]>0);
  const existing=s.orders.find(o=>!o.landing&&(o.raid||null)===raid&&(!raid||o.units[selected[0]])&&o.from===from&&o.to===to&&samePassages(o,path));
  check(places[from]&&places[to]&&(selected.length||existing),'Choose a movement order.');
  check(validUnits(units,available(s,from,to,path,raid,selected[0])),'This order exceeds the forces available at its origin.');
  if(raid&&selected.length)check(selected.length===1&&raidTargets(s,to,selected[0]).includes(raid),'Choose a legal bombing or escort mission.');
  if(s.exercise==='global'){
    const movement=exerciseOf(s).movement;
    for(const type of selected){
      const paired=(units.tank||0)>=(units.mech_infantry||0);
      if(type==='mech_infantry'&&path.length&&movement.spaces[path[0]]?.blitz)
        check(paired,'Each mechanized infantry blitzing through enemy land needs a tank on the same route.');
      check(movement.searchFor(from,type,{canBlitz:type!=='mech_infantry'||paired,supportZones:scrambleSupportZones(s)}).legal(to,path),
        'This route is outside the legal combat movement of the '+stats[type].name.toLowerCase()+'.');
    }
  }else{
    check(!path.length&&s.owners[from]===exerciseOf(s).attacker&&s.owners[to]===exerciseOf(s).defender&&
      places[from].targets.includes(to)&&selected.every(t=>types.includes(t)),'These units cannot attack that space from this origin.');
  }
  const orders=s.orders.filter(o=>o!==existing);
  if(selected.length)orders.push({from,to,...(raid?{raid}:{}),...(path.length===1?{via:path[0]}:path.length?{passages:[...path]}:{}),units:{...units}});
  if(s.exercise==='global'&&selected.length)check(flightRecoveries(s,orders),'Aircraft need a landing place within their remaining movement.');
  s.orders=orders;
}
export function alterStack(s,id,power,type,delta){
  if(!s.pieces||!delta)return;
  if(delta<0){
    let needed=-delta;
    for(const row of s.pieces[id]){
      if(row[1]!==type||!samePower(row[0],power))continue;
      const take=Math.min(needed,row[2]);row[2]-=take;needed-=take;
    }
    check(!needed,'The units are no longer available.');
    return;
  }
  let row=s.pieces[id].find(([p,t])=>p===power&&t===type);
  if(!row){row=[power,type,0];s.pieces[id].push(row);}
  row[2]+=delta;
}
function battleAt(s,to){
  let b=s.battles.find(b=>b.to===to);
  if(!b){b={to,origins:[],attack:empty(),round:0,step:'ready',resolved:false};s.battles.push(b);}
  return b;
}
function boardCargo(s,id,boat){
  if(!boat||!count(boat.units))return;
  const group=(s.embarked??={})[id]??=[];
  group.push({id:boat.id,power:boat.power,units:{...boat.units}});
  (s.spentCargo??=[]).push(boat.id);
}
function landBoat(s,boat){
  const b=battleAt(s,boat.coast);b.beachForce??={};
  for(const [type,n] of Object.entries(boat.units)){
    b.attack[type]=(b.attack[type]||0)+n;b.beachForce[type]=(b.beachForce[type]||0)+n;
  }
  s.record.push({title:places[boat.coast].name+' landing',detail:'Offloaded '+describe(boat.units)+'.'});
}
// Assign cargo to individual transports. Empty transports depart first on a generic fleet order.
function takeBoat(s,from,id){
  const group=s.embarked?.[from];
  const index=group?.findIndex(h=>h.id===id)??-1;
  return index<0?null:group.splice(index,1)[0];
}
function prepareLandings(s){
  const naval=[],zones=new Set(),waves=s.orders.filter(o=>o.landing);
  for(const [i,o] of waves.entries()){
    const {from,to,units,landing}=o,{cargo,escorts,path}=landing,zone=path.at(-1);
    const coast=battleAt(s,to);coast.amphibious=true;
    const battle=landingSeaBattle(s,zone);
    for(const row of cargo){
      alterStack(s,row.from,s.power,row.type,-row.n);s.units[row.from][row.type]=Math.max(0,(s.units[row.from][row.type]||0)-row.n);
    }
    const carried=takeBoat(s,from,landing.load);
    let boatId=carried?.id||s.power+'/'+from+'/'+i;
    while(Object.values(s.embarked||{}).some(group=>group.some(h=>h.id===boatId))||naval.some(order=>order.boat?.id===boatId))boatId+='*';
    const boat={id:boatId,power:s.power,units:{...units},coast:to};
    s.record.push({title:'Amphibious assault on '+places[to].name,detail:describe(units)+' aboard a transport from '+places[from].name+' · Offload in '+places[zone].name+'.'});
    const fleet=[{from,type:'transport',n:1,path,boat},...escorts];
    if(battle){
      zones.add(zone);coast.offshore??=[];
      if(!coast.offshore.includes(zone))coast.offshore.push(zone);
    }
    for(const leg of fleet){
      if(battle){
        naval.push({from:leg.from,to:zone,passages:leg.path.slice(1,-1),stationary:leg.from===zone,units:{[leg.type]:leg.n},boat:leg.boat});
      }else{
        alterStack(s,leg.from,s.power,leg.type,-leg.n);alterStack(s,zone,s.power,leg.type,leg.n);
        const damage=s.shipDamage?.[leg.from]?.[s.power];
        if(leg.from!==zone&&capitalsAtSea.includes(leg.type)&&damage?.[leg.type]){
          const moved=Math.min(leg.n,damage[leg.type]);damage[leg.type]-=moved;
          const dest=damageAt(s,zone,s.power);dest[leg.type]=(dest[leg.type]||0)+moved;
        }
        if(['battleship','cruiser'].includes(leg.type)){
          coast.bombard??={};coast.bombard[leg.type]=(coast.bombard[leg.type]||0)+leg.n;
        }
      }
    }
    if(!battle){coast.bombardCapacity=(coast.bombardCapacity||0)+count(units);landBoat(s,boat);}
  }
  // All of the attacker's units remaining in a contested landing zone fight there.
  for(const zone of zones){
    const inPlace=strengthOf(s.pieces[zone].filter(([p,t])=>samePower(p,s.power)&&mobileTypes.includes(t)));
    for(const o of [...s.orders.filter(o=>!o.landing),...naval])if(o.from===zone)
      for(const [t,n] of Object.entries(o.units))inPlace[t]=(inPlace[t]||0)-n;
    const force=Object.fromEntries(Object.entries(inPlace).filter(([,n])=>n>0));
    if(count(force))naval.push({from:zone,to:zone,stationary:true,garrison:true,units:force});
  }
  return naval;
}
export function commit(s){
  if(s.orders.some(o=>o.landing||o.raid)){
    checkLandingFleets(s);checkRaidOrders(s);
    const draft=structuredClone(s);commitOrders(draft);Object.assign(s,draft);
  }else commitOrders(s);
}
function commitOrders(s) {
  check(s.phase==='plan' && (s.orders.length||s.exercise==='global'),'Plan at least one attack before committing.');
  if(s.pieces){
    const support=scrambleSupportZones(s);
    for(const to of new Set(s.orders.map(o=>o.to))){
      if(places[to].water&&!exerciseOf(s).movement.spaces[to].enemyFleet&&!support.has(to))
        throw Error('This offshore support order needs an amphibious assault. Restore the landing or remove the support order.');
      if(places[to].water&&s.orders.some(o=>o.landing?.path.at(-1)===to))continue;
      if(neutralKey(s.owners[to]))check(s.orders.some(o=>o.to===to&&Object.entries(o.units).some(([t,n])=>n&&!aircraft.includes(t))),
        'Include land units to invade a neutral territory.');
      check(s.orders.some(o=>o.to===to&&Object.entries(o.units).some(([t,n])=>n&&stats[t].attack>0)),
        'An attack needs a unit with attack strength. Add an escort or cancel the order.');
    }
    for(const id of new Set(s.orders.filter(o=>o.units.carrier).map(o=>o.from))){
      const orders=s.orders.filter(o=>o.from===id);
      const decksLeaving=orders.reduce((n,o)=>n+(o.units.carrier||0),0);
      const planesLeaving=orders.reduce((n,o)=>n+aircraft.reduce((sum,t)=>sum+(o.units[t]||0),0),0);
      const damaged=s.shipDamage?.[id]?.[s.power]?.carrier||0;
      check(deckSpace(s,id,exerciseOf(s).friendlyPowers[s.power])+planesLeaving>=2*Math.max(0,decksLeaving-damaged),
        'Moving this carrier would strand aircraft. Assign its aircraft first or keep the carrier here.');
    }
    const recoveries=flightRecoveries(s,s.orders);
    check(recoveries,'Aircraft need a landing place within their remaining movement.');
    for(const [order,bases] of recoveries)order.landings=bases;
    launchScrambles(s,scramblePlan(s));
    invadeNeutrals(s);
  }
  const ex=exerciseOf(s);
  for(const via of new Set(s.orders.filter(o=>!o.landing&&o.units.tank&&o.via).map(o=>o.via))){
    if(ex.friends[s.power].includes(s.owners[via]))continue;
    const control=ex.occupy(s,via);
    s.record.push({title:places[via].name,detail:control+' during a tank blitz.'});
  }
  const naval=prepareLandings(s);
  if(s.orders.some(o=>o.raid))prepareRaids(s);
  if(naval.length)s.navalParticipants=naval;
  const reservedTransports={};
  for(const o of naval)if(o.boat)reservedTransports[o.from]=(reservedTransports[o.from]||0)+1;
  for(const o of [...s.orders.filter(o=>!o.landing&&!o.raid),...naval]) {
    const path=[o.from,...orderPassages(o),o.to].map(id=>places[id].name).join(' → ');
    s.record.push({title:path,detail:describe(o.units)});
    if(o.via&&o.units.tank&&ex.friends[s.power].includes(places[o.to].startOwner)){
      for(const [type,n] of Object.entries(o.units)){
        if(!n)continue;
        alterStack(s,o.from,s.power,type,-n);alterStack(s,o.to,s.power,type,n);
        s.units[o.from][type]-=n;s.units[o.to][type]=(s.units[o.to][type]||0)+n;
      }
      continue;
    }
    const b=battleAt(s,o.to);
    if(o.boat){(b.boats??=[]).push(o.boat);reservedTransports[o.from]--;}
    else if(o.units.transport){
      const group=aboard(s,o.from),hulls=strengthOf(s.pieces[o.from].filter(([p])=>samePower(p,s.power))).transport||0;
      const reserved=reservedTransports[o.from]||0;
      const loaded=Math.max(0,o.units.transport-Math.max(0,hulls-group.length-reserved));
      for(const boat of group.slice(0,loaded))(b.boats??=[]).push(takeBoat(s,o.from,boat.id));
    }
    if(!b.origins.includes(entrySpace(o)))b.origins.push(entrySpace(o));
    for(const [k,n] of Object.entries(o.units)){
      if(!n)continue;
      b.attack[k]=(b.attack[k]||0)+n;
      s.units[o.from][k]=Math.max(0,(s.units[o.from][k]||0)-n);
      alterStack(s,o.from,s.power,k,-n);
      if(capitalsAtSea.includes(k)){
        const damage=s.shipDamage?.[o.from]?.[s.power];
        const moved=Math.min(n,damage?.[k]||0);
        if(moved){b.damage??={};b.damage[k]=(b.damage[k]||0)+moved;damage[k]-=moved;}
      }
    }
  }
  s.phase='combat';
  if(!pendingRaids(s).length)resumeCombat(s);
}
export function resumeCombat(s){
  s.phase=s.battles.some(b=>!b.resolved)?'combat':'review';
  if(s.phase==='review')settleMongolianPact(s);
  resolveUnopposed(s);
}
function resolveUnopposed(s){
  if(pendingRaids(s).length)return;
  for(const b of s.battles){
    if(s.frenchAward?.status==='pending')break;
    if(b.resolved||b.step!=='ready'||landingWait(s,b).length)continue;
    if(s.pieces&&places[b.to].water&&!exerciseOf(s).movement.spaces[b.to].enemyFleet&&
      s.orders.some(o=>o.landing?.path.at(-1)===b.to)&&!defendingRows(s,b.to).length){
      placeSurvivors(s,b,b.to);finishBattle(s,b,'Supported the landing without a sea battle.',undefined,b.to);continue;
    }
    if(b.amphibious&&!count(b.attack)){
      finishBattle(s,b,'Landing canceled. No attackers reached the coast.');continue;
    }
    if(s.controlChanges?.[b.to]){
      placeSurvivors(s,b,b.to);
      finishBattle(s,b,'Joined friendly forces in '+places[b.to].name+'.');
      continue;
    }
    if(s.pieces)s.units[b.to]=strengthOf(defendingRows(s,b.to));
    const landOccupation=s.pieces&&!places[b.to].water&&Object.entries(b.attack).some(([type,n])=>n&&!aircraft.includes(type));
    if(landOccupation&&!count(s.units[b.to]))captureBattle(s,b,exerciseOf(s).attacker);
  }
}
export function chooseBattle(s,to) {
  const b=s.battles.find(b=>b.to===to);
  check(s.frenchAward?.status!=='pending','France must finish its liberation placement first.');
  check(s.phase==='combat'&&!s.active&&b&&!b.resolved,'Finish the current battle before choosing another.');
  check(!pendingRaids(s).length,'Resolve all bombing raids before other battles.');
  check(!landingWait(s,b).length,'Resolve the offshore sea battle before this landing.');
  s.active=to;
}
export const currentBattle = s=>s.battles.find(b=>b.to===s.active);
export function die(){
  const bytes=new Uint8Array(1);
  do { crypto.getRandomValues(bytes); } while(bytes[0]>=252);
  return bytes[0]%6+1;
}
function rollUnit(type,threshold,random){
  const face=random();
  return {type,threshold,face,hit:face<=threshold};
}
function rollForce(force,mode,random) {
  let artillery=force.artillery||0,pairs=(force.tank||0)+(force.fighter||0);
  return Object.keys(stats).flatMap(type=>{
    const base=stats[type][mode];
    if(!base)return [];
    return Array.from({length:force[type]||0},()=>{
      let threshold=base;
      if(mode==='attack'&&['inf','mech_infantry'].includes(type)&&artillery>0){threshold++;artillery--;}
      if(mode==='attack'&&type==='tactical_bomber'&&pairs>0){threshold++;pairs--;}
      return rollUnit(type,threshold,random);
    });
  });
}
function finishBattle(s,b,result,heldBy,seaDestination){
  b.resolved=true;b.step='done';b.result=result;s.active=null;
  if(s.scrambles&&places[b.to].water)leaveScrambleBattle(s,b);
  if(heldBy)b.heldBy=heldBy;
  s.record.push({title:places[b.to].name,detail:result,...(heldBy?{heldBy}:{})});
  if(places[b.to].water&&b.boats){
    for(const boat of b.boats){
      if(seaDestination===b.to&&boat.coast&&b.seaVictory)landBoat(s,boat);
      else if(seaDestination)boardCargo(s,seaDestination,boat);
    }
  }
  if(places[b.to].water&&s.battles.some(land=>land.offshore?.includes(b.to)))resolveUnopposed(s);
  if(s.battles.every(b=>b.resolved)){s.phase='review';settleMongolianPact(s);}
}
export function defenderLosses(force,hits){
  const lost=empty();
  for(const k of casualtyOrder){if(force[k]){lost[k]=Math.min(force[k],hits);hits-=lost[k];}}
  return lost;
}
export function reservedBerths(s,id){
  return (s.carrierLaunches||[]).reduce((n,o)=>n+(o.to===id?2*o.quantity:0),0);
}
export function deckSpace(s,id,side){
  let spaces=side.includes(s.power)&&s.phase!=='mobilize'?reservedBerths(s,id):0;
  for(const [power,type,n] of s.pieces[id]){
    if(!side.includes(power))continue;
    if(type==='carrier')spaces+=2*(n-(s.shipDamage?.[id]?.[power]?.carrier||0));
    if(aircraft.includes(type))spaces-=n;
  }
  return spaces;
}
function reachableLandingSites(s,from,type,to,spent){
  const ex=exerciseOf(s);
  // The movement graph uses start-of-turn control. Land must also still be friendly.
  return ex.movement.landingSites(from,type,to,spent)
    .filter(id=>places[id].water||ex.friends[s.power].includes(s.owners[id]));
}
// Assign scarce carrier berths jointly so a flexible flight cannot strand another.
export function flightRecoveries(s,orders,preview=null,previewSpent=0){
  const ex=exerciseOf(s),plans=new Map(),decks=new Map(),flights=[];
  const scrambled=new Set((s.scrambles||scramblePlan(s,orders)).map(f=>f.zone));
  function capacity(id){
    if(decks.has(id))return decks.get(id);
    let room=deckSpace(s,id,ex.friendlyPowers[s.power]);
    let movingCarriers=0,arrivingCarriers=0;
    for(const o of orders){
      if(o.from===id){
        for(const t of aircraft)room+=o.units[t]||0;
        movingCarriers+=o.units.carrier||0;
      }
      if(o.to===id&&o.units.carrier){
        const damaged=s.shipDamage?.[o.from]?.[s.power]?.carrier||0;
        arrivingCarriers+=Math.max(0,o.units.carrier-damaged);
      }
    }
    // Only rely on arriving carriers when recovering in that same sea battle.
    const damaged=s.shipDamage?.[id]?.[s.power]?.carrier||0;
    room-=2*Math.max(0,movingCarriers-damaged);
    const berths=Array.from({length:Math.max(0,room)},()=>({}));
    if(ex.movement.spaces[id].enemyFleet||scrambled.has(id)){
      berths.length=Math.min(berths.length,reservedBerths(s,id));
      for(let i=0;i<2*arrivingCarriers;i++)berths.push({battle:id});
    }
    decks.set(id,berths);return berths;
  }
  for(const order of orders){
    for(const type of aircraft){
      const n=order.units[type];if(!n)continue;
      const spent=order===preview?previewSpent:orderPassages(order).length+1;
      const sites=reachableLandingSites(s,order.from,type,order.to,spent);
      const land=sites.includes(order.from)&&!places[order.from].water?order.from:sites.find(id=>!places[id].water);
      const bases=plans.get(order)||{};plans.set(order,bases);
      if(land){bases[type]=Array(n).fill(land);continue;}
      const options=sites.flatMap(id=>capacity(id).filter(slot=>!slot.battle||slot.battle===order.to).map(slot=>({id,slot})));
      if(options.length<n)return null;
      bases[type]=[];
      for(let i=0;i<n;i++)flights.push({options,bases:bases[type],i});
    }
  }
  function reserve(flight,visited){
    for(const {id,slot} of flight.options){
      if(visited.has(slot))continue;
      visited.add(slot);
      if(slot.flight&&!reserve(slot.flight,visited))continue;
      slot.flight=flight;flight.bases[flight.i]=id;return true;
    }
    return false;
  }
  return flights.every(f=>reserve(f,new Set()))?plans:null;
}
export function returnAircraft(s,b,order,type,n){
  const ex=exerciseOf(s),origin=order.from;
  const reachable=reachableLandingSites(s,origin,type,b.to,(order.stationary?0:orderPassages(order).length+1));
  let left=n;
  const range=ex.movement.allowance(origin,type)-(order.stationary?0:orderPassages(order).length+1);
  function noteFlight(base,count){
    const flights=s.landedFlights??=[];
    const prior=flights.find(f=>f.from===b.to&&f.type===type&&f.base===base&&f.range===range);
    if(prior)prior.count+=count;else flights.push({from:b.to,type,range,base,count});
  }
  const assigned=order.landings?.[type]||[];
  // Each reserved berth belongs to a particular surviving aircraft.
  const choices=[...assigned.slice(0,n).map(id=>[id,1]),...[origin,...reachable].map(id=>[id,n])];
  for(const [id,limit] of choices){
    if(!reachable.includes(id))continue;
    if(!left)break;
    let seats=Math.min(left,limit);
    if(places[id].water){
      if(type==='bomber'||defendingRows(s,id).length&&!reservedBerths(s,id))continue;
      seats=Math.min(seats,Math.max(0,deckSpace(s,id,ex.friendlyPowers[s.power])));
    }
    alterStack(s,id,s.power,type,seats);
    if(seats){s.units[id][type]=(s.units[id][type]||0)+seats;noteFlight(id,seats);}
    left-=seats;
  }
  if(left)noteFlight(null,left);
}
function placeSurvivors(s,b,destination){
  const origins=[...s.orders,...(s.navalParticipants||[])].filter(o=>!o.landing&&!o.raid&&o.to===b.to);
  for(const type of [...ships,...mobileTypes.filter(t=>!ships.includes(t)&&!aircraft.includes(t)),...aircraft]){
    const n=b.attack[type];
    if(!n)continue;
    if(aircraft.includes(type)){
      // Attribute survivors to sorties before using their remaining movement to land.
      let remaining=n;
      for(const order of origins){
        const returning=Math.min(remaining,order.units[type]||0);
        if(returning)returnAircraft(s,b,order,type,returning);
        remaining-=returning;
      }
    }else{
      alterStack(s,destination,s.power,type,n);
      s.units[destination][type]=(s.units[destination][type]||0)+n;
      if(b.damage?.[type]){
        const damage=damageAt(s,destination,s.power);damage[type]=(damage[type]||0)+b.damage[type];
      }
    }
  }
}
function captureBattle(s,b,attacker){
  const sea=places[b.to].water;
  const occupies=!sea&&Object.entries(b.attack).some(([t,n])=>n&&!aircraft.includes(t));
  let control='Captured by '+attacker;
  if(occupies){
    if(s.exercise==='global')control=exerciseOf(s).occupy(s,b.to);
    else s.owners[b.to]=attacker;
  }
  s.units[b.to]=empty();placeSurvivors(s,b,b.to);
  const result=occupies?control+' with '+describe(b.attack)+'.':
    sea?'Sea battle won by '+attacker+'.':'Defenders eliminated by air. Territory control is unchanged.';
  if(sea)b.seaVictory=true;
  finishBattle(s,b,result,undefined,sea?b.to:undefined);
}
export const frenchReinforcements=Object.keys(stats).filter(t=>!ships.includes(t)&&stats[t].cost<=12);
export function frenchReinforcementCost(draft){
  let spent=0;
  for(const [t,n] of Object.entries(draft)){
    check(frenchReinforcements.includes(t)&&Number.isInteger(n)&&n>=0,'Choose French land or air units.');
    spent+=stats[t].cost*n;
  }
  check(spent<=12,'France can place up to 12 IPCs of reinforcements.');
  return spent;
}
export function changeFrenchDraft(s,type,delta){
  check(s.frenchAward?.status==='pending'&&[1,-1].includes(delta),'French placement is closed.');
  const draft={...s.frenchAward.draft,[type]:(s.frenchAward.draft[type]||0)+delta};
  frenchReinforcementCost(draft);if(!draft[type])delete draft[type];
  s.frenchAward.draft=draft;
}
export function placeFrenchAward(s){
  check(s.frenchAward?.status==='pending'&&s.owners.fr==='France','French placement is closed.');
  const draft=s.frenchAward.draft,spent=frenchReinforcementCost(draft);
  for(const [type,n] of Object.entries(draft)){
    alterStack(s,'fr','French',type,n);s.units.fr[type]=(s.units.fr[type]||0)+n;
  }
  s.frenchAward.status='placed';
  s.record.push({title:'French liberation reinforcements',detail:spent?spent+' of 12 IPCs placed in France.':'France declined its one-time reinforcements.',frenchUnits:{...draft}});
  resolveUnopposed(s);
}
function damageAt(s,id,power){
  s.shipDamage??={};const area=s.shipDamage[id]??={};return area[power]??={};
}
function hitSlots(rows,damageFor){
  const slots=[];
  for(const [power,type,n] of rows){
    if(!n)continue;
    const spare=capitalsAtSea.includes(type)?n-(damageFor(power)?.[type]||0):0;
    for(let i=0;i<spare+n;i++)slots.push({power,type,damage:i<spare});
  }
  return slots.sort((a,b)=>Number(a.type==='transport')-Number(b.type==='transport')||
    Number(b.damage)-Number(a.damage)||stats[a.type].cost-stats[b.type].cost);
}
function canHit(die,type,destroyer){
  if(die.type==='aaGun')return aircraft.includes(type);
  if(die.type==='submarine')return !aircraft.includes(type);
  return type!=='submarine'||!aircraft.includes(die.type)||destroyer;
}
// Match restricted hits (e.g. air against subs) to real, eligible hit points.
function assignHits(dice,slots,destroyer){
  const hits=dice.filter(d=>d.hit),used=new Map();
  function assign(index,visited){
    for(let i=0;i<slots.length;i++){
      if(visited.has(i)||!canHit(hits[index],slots[i].type,destroyer))continue;
      visited.add(i);
      if(!used.has(i)||assign(used.get(i),visited)){used.set(i,index);return true;}
    }
    return false;
  }
  for(let i=0;i<hits.length;i++)assign(i,new Set());
  return [...used.keys()].sort((a,b)=>a-b).map(i=>slots[i]);
}
function victimSlots(s,b,attack){
  if(attack)return hitSlots(Object.entries(b.attack).map(([t,n])=>[s.power,t,n]),()=>b.damage);
  const rows=s.pieces?defendingRows(s,b.to):Object.entries(s.units[b.to]).map(([t,n])=>[s.owners[b.to],t,n]);
  return hitSlots(rows,p=>s.shipDamage?.[b.to]?.[p]);
}
function incomingDice(b){return b.step==='openingLosses'?b.openingDice:b.dice;}
export function casualtyLimits(s,b){
  const dice=incomingDice(b)?.defense||[],destroyer=s.units[b.to].destroyer>0;
  const slots=victimSlots(s,b,true),limits={};
  for(const {type} of slots){
    if(dice.some(d=>d.hit&&canHit(d,type,destroyer)))limits[type]=(limits[type]||0)+1;
  }
  return limits;
}
function canDamage(force,opponents,side){
  return Object.entries(force).some(([type,n])=>n&&stats[type][side]>0&&
    Object.entries(opponents).some(([target,number])=>number&&canHit({type},target,force.destroyer>0)));
}
function settleStrandedDefenders(s,b){
  const ex=exerciseOf(s),zone=b.to,side=ex.enemies;
  let excess=-deckSpace(s,zone,side);
  if(excess<=0)return;
  for(const [power,type,n] of s.pieces[zone].map(row=>[...row])){
    if(!side.includes(power)||!aircraft.includes(type)||!n||!excess)continue;
    const quantity=Math.min(n,excess);
    alterStack(s,zone,power,type,-quantity);
    s.units[zone][type]-=quantity;excess-=quantity;
    const neighbors=ex.neighbors[zone];
    const allied=ex.friends[power]||[power];
    const land=neighbors.find(id=>!places[id].water&&allied.includes(s.owners[id]));
    let left=quantity;
    for(const id of land?[land]:neighbors.filter(id=>places[id].water)){
      const seats=land?left:Math.max(0,Math.min(left,deckSpace(s,id,ex.friendlyPowers[power]||[power])));
      if(!seats)continue;
      alterStack(s,id,power,type,seats);s.units[id][type]=(s.units[id][type]||0)+seats;left-=seats;
      if(!left)break;
    }
    if(left)s.record.push({title:places[zone].name,detail:left+' defending '+stats[type].name+' lost without a landing space.'});
  }
}
function applyRound(s,b,losses,opening,choice){
  const dice=opening?b.openingDice:b.dice,defenders=s.units[b.to];
  const attacks=assignHits(dice.attack,victimSlots(s,b,false),b.attack.destroyer>0);
  const attackSlots=victimSlots(s,b,true);
  const all=assignHits(dice.defense,attackSlots,defenders.destroyer>0);
  const requested={...losses};
  const selected=attackSlots.filter(({type})=>requested[type]>0&&requested[type]--);
  check(count(losses)===all.length&&selected.length===all.length&&
    assignHits(dice.defense,selected,defenders.destroyer>0).length===all.length&&
    selected.filter(x=>x.type==='transport').length<=all.filter(x=>x.type==='transport').length,
    'Assign each hit to an eligible unit. Transports are taken last.');
  const nationalLosses={},lost=empty(),ownLost=empty();
  const beachLoss={};
  for(const [type,onBeach] of Object.entries(b.beachForce||{})){
    const hits=losses[type]||0,min=Math.max(0,hits-(b.attack[type]-onBeach)),max=Math.min(onBeach,hits);
    const n=choice.beach?.[type]??min;
    check(Number.isInteger(n)&&n>=min&&n<=max,'Choose which landing troops take these hits.');
    beachLoss[type]=n;
  }
  const chosenBoats=[...(choice.boats||[])];
  check(chosenBoats.length<=(losses.transport||0)&&new Set(chosenBoats).size===chosenBoats.length&&
    chosenBoats.every(id=>b.boats?.some(h=>h.id===id)),'Choose a transport involved in this battle.');
  const cargoValue=h=>Object.entries(h.units).reduce((v,[t,n])=>v+stats[t].cost*n,0);
  function take(slot,attacking){
    const {type,power,damage}=slot;
    const force=attacking?b.attack:defenders;
    if(capitalsAtSea.includes(type)){
      const ledger=attacking?(b.damage??={}):damageAt(s,b.to,power);
      if(damage){ledger[type]=(ledger[type]||0)+1;return;}
      ledger[type]=Math.max(0,(ledger[type]||0)-1);
    }
    if(attacking&&beachLoss[type]>0){b.beachForce[type]--;beachLoss[type]--;}
    if(type==='transport'){
      const loaded=attacking?(b.boats||[]):(s.embarked?.[b.to]||[]).filter(h=>samePower(h.power,power));
      const hulls=attacking?force.transport:s.pieces[b.to].filter(([p,t])=>samePower(p,power)&&t==='transport').reduce((a,r)=>a+r[2],0);
      const chosen=attacking?chosenBoats.shift():null;
      if(loaded.length&&(chosen||hulls<=loaded.length)){
        const id=chosen||loaded.reduce((a,h)=>cargoValue(h)<cargoValue(a)?h:a).id;
        const boat=attacking?loaded.splice(loaded.findIndex(h=>h.id===id),1)[0]:takeBoat(s,b.to,id);
        s.record.push({title:places[b.to].name+' · Transport sunk',detail:'Cargo lost: '+describe(boat.units)+'.'});
      }
    }
    force[type]--;
    const total=attacking?ownLost:lost;total[type]=(total[type]||0)+1;
    if(!attacking&&s.pieces){
      const row=s.pieces[b.to].find(([p,t,n])=>p===power&&t===type&&n>0);
      if(row)row[2]--;
      else s.scrambles.find(f=>f.zone===b.to&&!f.returning&&f.power===power&&f.type===type&&f.remaining>0).remaining--;
      const army=nationalLosses[power]??={};army[type]=(army[type]||0)+1;
    }
  }
  for(const slot of selected)take(slot,true);
  for(const slot of attacks)take(slot,false);
  const sea=places[b.to].water;
  if(sea){
    // Defenseless transports are removed as soon as only transports remain on their side.
    const defendersArmed={...defenders,transport:0},attackersArmed={...b.attack,transport:0};
    const fighting=canDamage(b.attack,defendersArmed,'attack')||canDamage(defenders,b.attack,'defense');
    if(defenders.transport&&!fighting&&canDamage(b.attack,{transport:defenders.transport},'attack')){
      for(const [power,type,n] of defendingRows(s,b.to))if(type==='transport')for(let i=0;i<n;i++)take({type,power},false);
    }
    if(b.attack.transport&&!canDamage(b.attack,defenders,'attack')&&!canDamage(defenders,attackersArmed,'defense')&&
      canDamage(defenders,{transport:b.attack.transport},'defense')&&!retreatSites(s,b).length){
      for(const slot of victimSlots(s,b,true))if(slot.type==='transport')take(slot,true);
    }
  }
  const defender=s.owners[b.to],attacker=exerciseOf(s).attacker;
  s.record.push({title:places[b.to].name+' · '+(opening?'opening fire · ':'')+'round '+b.round,dice,
    losses:{attack:ownLost,defense:lost},defender,nationalLosses,
    detail:'Losses — '+attacker+': '+describe(ownLost)+'; '+defender+': '+describe(lost)+'.'});
  if(!count(defenders)&&count(b.attack))captureBattle(s,b,attacker);
  else if(!count(b.attack)){
    if(sea)settleStrandedDefenders(s,b);
    const survivors=defendingRows(s,b.to).map(row=>[...row]);
    finishBattle(s,b,count(defenders)?(places[b.to].water?'Defending fleet':defender)+' held with '+describe(defenders)+'.':
      places[b.to].water?'Both fleets lost.':'Both forces lost. '+defender+' retains control.',survivors.length?survivors:undefined);
  }else if(sea&&!canDamage(b.attack,defenders,'attack')&&!canDamage(defenders,b.attack,'defense')){
    const site=retreatSites(s,b)[0]||b.to;
    placeSurvivors(s,b,site);
    settleStrandedDefenders(s,b);
    finishBattle(s,b,'Neither side can hit the other. The attacking force withdrew.',undefined,site);
  }else b.step=opening&&!(sea&&count(b.attack)===b.attack.transport)?'regular':'decision';
}
export function openingFireKind(s,b){
  const defenders=s.units[b.to];
  if(!b.round&&defenders.aaGun&&aircraft.some(t=>b.attack[t]>0))return 'Antiaircraft fire';
  if((b.attack.submarine&&!defenders.destroyer&&ships.some(t=>defenders[t]))||(defenders.submarine&&!b.attack.destroyer&&ships.some(t=>b.attack[t])))return 'Submarine surprise strike';
  return '';
}
export function rollOpening(s,random=die){
  const b=currentBattle(s),kind=openingFireKind(s,b);
  check(['ready','decision'].includes(b.step)&&kind,'Opening fire is unavailable.');
  b.round++;b.openingDice={attack:[],defense:[]};
  b.firedSubs={attack:false,defense:false};
  const defenders=defendingRows(s,b.to);
  b.openingDice.defendingPowers=[...new Set(defenders.map(([p])=>p))];
  if(kind==='Antiaircraft fire'){
    let planes=aircraft.reduce((sum,t)=>sum+(b.attack[t]||0),0);
    for(const [power,t,n] of defenders){
      if(t!=='aaGun')continue;
      const shots=Math.min(planes,3*n);planes-=shots;
      for(let i=0;i<shots;i++)b.openingDice.defense.push({...rollUnit(t,1,random),power});
    }
  }else{
    if(!s.units[b.to].destroyer){
      b.firedSubs.attack=true;
      for(let i=0;i<(b.attack.submarine||0);i++)b.openingDice.attack.push(rollUnit('submarine',2,random));
    }
    if(!b.attack.destroyer){
      b.firedSubs.defense=true;
      for(const [power,t,n] of defenders)if(t==='submarine')for(let i=0;i<n;i++)b.openingDice.defense.push({...rollUnit(t,1,random),power});
    }
  }
  b.step='openingLosses';b.hits=assignHits(b.openingDice.defense,victimSlots(s,b,true),false).length;
}
export function rollAttack(s,random=die){
  const b=currentBattle(s);
  check(b&&['ready','regular','decision'].includes(b.step),'Resolve casualties before rolling again.');
  if(b.step!=='regular'){
    check(!openingFireKind(s,b),'Resolve opening fire first.');b.round++;b.firedSubs=null;
  }
  b.dice={attack:rollForce({...b.attack,...(b.firedSubs?.attack?{submarine:0}:{})},'attack',random)};
  if(b.round===1&&b.bombard){
    let left=b.bombardCapacity;
    const guns=[];
    for(const type of ['battleship','cruiser']){
      const n=Math.min(left,b.bombard[type]||0);left-=n;
      for(let i=0;i<n;i++)guns.push({...rollUnit(type,stats[type].attack,random),bombard:true});
    }
    b.dice.attack.push(...guns);
    s.record.push({title:places[b.to].name+' · Offshore bombardment',
      detail:guns.length+' bombardment dice · '+guns.filter(d=>d.hit).length+' hits. Defenders return fire this round.'});
  }
  if(s.pieces)b.dice.defendingPowers=[...new Set(defendingRows(s,b.to).map(([power])=>power))];
  b.step='defense';
}
export function rollDefense(s,random=die){
  const b=currentBattle(s);
  check(b?.step==='defense','Roll the attack first. Each side rolls once per round.');
  b.dice.defense=s.pieces?defendingRows(s,b.to).flatMap(([power,type,n])=>{
    if(!stats[type]?.defense||type==='submarine'&&b.firedSubs?.defense)return [];
    return Array.from({length:n},()=>({...rollUnit(type,stats[type].defense,random),power}));
  }):rollForce(s.units[b.to],'defense',random);
  b.hits=assignHits(b.dice.defense,victimSlots(s,b,true),s.units[b.to].destroyer>0).length;
  b.step='losses';
}
export function casualties(s,losses,choice={}){
  const b=currentBattle(s);
  check(b&&['losses','openingLosses'].includes(b.step)&&validUnits(losses,casualtyLimits(s,b))&&count(losses)===b.hits,
    'Assign exactly one eligible hit point per hit.');
  applyRound(s,b,losses,b.step==='openingLosses',choice);
}
export function retreatSites(s,b){
  const orders=[...s.orders,...(s.navalParticipants||[])].filter(o=>!o.landing&&!o.raid&&o.to===b.to);
  if(b.beachForce&&count(b.beachForce)){
    const overland=Object.entries(b.attack).some(([t,n])=>!aircraft.includes(t)&&n>(b.beachForce[t]||0));
    if(!overland&&!aircraft.some(t=>b.attack[t]))return [];
    return [...new Set(orders.filter(o=>!overland||Object.entries(o.units).some(([t,n])=>n&&!aircraft.includes(t))).map(entrySpace))];
  }
  const surface=Object.entries(b.attack).some(([t,n])=>n&&!aircraft.includes(t));
  const sites=b.origins.filter(id=>id!==b.to&&(!places[b.to].water||!defendingRows(s,id).some(([,t,n])=>n&&ships.includes(t)&&t!=='submarine'&&t!=='transport'))&&(!surface||places[id].water===places[b.to].water&&
    orders.some(o=>entrySpace(o)===id&&Object.entries(o.units).some(([t,n])=>n&&!aircraft.includes(t)))));
  return sites;
}
export function retreat(s,origin){
  const b=currentBattle(s);
  check(b?.step==='decision'&&retreatSites(s,b).includes(origin),'Choose an eligible entry space for the retreat.');
  if(b.beachForce&&count(b.beachForce)){
    const staying={...b.beachForce};
    for(const [t,n] of Object.entries(staying))b.attack[t]-=n;
    placeSurvivors(s,b,origin);
    s.record.push({title:places[b.to].name,detail:'Withdrew '+describe(b.attack)+'. Seaborne troops remain in combat.'});
    b.attack=staying;return;
  }
  placeSurvivors(s,b,origin);
  if(places[b.to].water)settleStrandedDefenders(s,b);
  finishBattle(s,b,'Retreated to '+places[origin].name+' with '+describe(b.attack)+'.',undefined,origin);
}
