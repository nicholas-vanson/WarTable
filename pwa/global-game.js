import {globalCities,checkVictoryHandoff} from './victory.js';
import {hasTech} from './research.js';
import {homeCapitals,occupyTerritory,settleCapitalPayments} from './occupation.js';
import {politicalPowers,atWarWith} from './politics.js';
import {combatMovement} from './movement.js';
import {places,exercises,stats,aircraft,ships,mobileTypes,samePower,strengthOf} from './rules.js';
import {neutralOwners,neutralKey,canEnterNeutral,hostileNeutral,openingLand} from './neutral-rules.js';
// Global 1940 Second Edition order of play. Both British economies share a controller.
export const globalPowers=politicalPowers;
export const ownerNames={...globalPowers,UK_Pacific:'United Kingdom',Dutch:'Netherlands',
  ...neutralOwners};
// Both British treasuries can field pieces in the same battle under the same flag.
export function nationalArmies(stacks){
  const armies={};
  for(const [power,type,n] of stacks){
    if(!n)continue;
    const nation=ownerNames[power]||power,army=armies[nation]??={};
    army[type]=(army[type]||0)+n;
  }
  return armies;
}
export const globalUnits={
  infantry:['Infantry',3],artillery:['Artillery',4],mech_infantry:['Mechanized infantry',4],armour:['Tank',6],aaGun:['AAA',5],
  fighter:['Fighter',10],tactical_bomber:['Tactical bomber',11],bomber:['Strategic bomber',12],
  submarine:['Submarine',6],transport:['Transport',7],destroyer:['Destroyer',8],cruiser:['Cruiser',12],
  carrier:['Aircraft carrier',16],battleship:['Battleship',20],factory_minor:['Minor industrial complex',12],
  factory_major:['Major industrial complex',30],airfield:['Air base',15],harbour:['Naval base',15]
};
export function startGlobalMatch(setup,controllers){
  for(const power of Object.keys(globalPowers)){
    if(!Number.isInteger(controllers[power])||controllers[power]<1||controllers[power]>9)throw Error('Assign a local player to each power.');
  }
  const match={version:1,round:1,power:'Germans',phase:'purchase',controllers:{...controllers},
    treasury:{...setup.treasury},draft:{},mobilization:{},board:Object.fromEntries(
      Object.entries(setup.regions).map(([name,r])=>[name,{owner:r.owner,units:r.units.map(stack=>[...stack])}]))};
  preparePurchaseSites(match,setup);
  return match;
}
// The briefing precedes spending for each power.
export function startGlobalPlaytest(setup,controllers){
  const match=startGlobalMatch(setup,controllers);
  match.phase='briefing';
  return match;
}
const turnOrder=Object.keys(globalPowers);
export function seasonForRound(round){
  const index=round-1,year=1940+Math.floor(index/4);
  const season=['Spring','Summer','Autumn','Winter'][index%4];
  return season+' '+year+(index%4===3?'–'+String(year+1).slice(-2):'');
}
export function nextPower(power){
  return turnOrder[(turnOrder.indexOf(power)+1)%turnOrder.length];
}
export function nextPlaytestTurn(match){
  if(match.phase!=='income'||match.combat?.game.phase!=='incomeCollected')throw Error('Collect income before handing over the turn.');
  const power=nextPower(match.power);
  const review={power:match.power,round:match.round,record:match.combat.game.record};
  const next={...match};
  delete next.turnCapitalPayments;
  if(match.combat.game.frenchAward?.status==='placed')next.frenchLiberationAwarded=true;
  const round=match.round+Number(power===turnOrder[0]);
  checkVictoryHandoff(next,power,round);
  return {...next,power,round,phase:next.victory?'victory':'briefing',
    turnReviews:[...(match.turnReviews||[]),review],combat:null,combatStart:null,combatStartPactBroken:!!match.mongolianPactBroken};
}
export function openingAddress(match,seat){
  const powers=seat===match.controllers[match.power]?[match.power]:turnOrder.filter(power=>match.controllers[power]===seat);
  const names=powers.map(power=>({British:'the United Kingdom',Americans:'the United States',Russians:'the Soviet Union'}[power]||globalPowers[power]));
  return names.length?'You command '+new Intl.ListFormat('en').format(names)+'.':'You are observing this game.';
}
export const purchaseGroups={
  Land:['infantry','artillery','mech_infantry','armour','aaGun'],
  Air:['fighter','tactical_bomber','bomber'],
  Sea:['submarine','transport','destroyer','cruiser','carrier','battleship'],
  Facilities:['factory_minor','factory_major','airfield','harbour']
};
export const isFacility=type=>purchaseGroups.Facilities.includes(type);
// Global rules pp. 34–35. West India is UK Pacific and mainland North America is UK Europe.
const pacificOriginals=new Set(['UK_Pacific','Japanese','Chinese','ANZAC','Mongolians']);
const otherPacificLand=new Set(['French Indo China','New Hebrides','Celebes','Java','Dutch New Guinea','Sumatra',
  'Sakha','Evenkiyskiy','Yenisey','Soviet Far East','Amur','Yakut S.S.R.','Timguska','Siberia','Kazakhstan','Buryatia',
  'Philippines','Line Islands','Guam','Wake Island','Johnston Island','Hawaiian Islands','Midway']);
export const capitals=homeCapitals;

function preparePurchaseSites(match,setup){
  match.technology??={};
  match.diplomacy??=structuredClone(setup.diplomacy);
  for(const [name,region] of Object.entries(setup.regions)){
    const area=match.board[name];
    if(!area)continue;
    if(region.water){
      area.coasts??=region.links.filter(link=>!setup.regions[link].water);
    }else{
      area.ipc=region.ipc;area.original=region.original;
      area.coastal=region.links.some(link=>setup.regions[link].water);
      area.island=area.coastal&&region.links.every(link=>setup.regions[link].water);
    }
  }
}
export const spendingEconomies=match=>match.power==='British'?['British','UK_Pacific']:[match.power];
const hasFacility=(area,type)=>area.units.some(([,unit,n])=>unit===type&&n>0);
export function productionSlots(area,repairs={},improved=false){
  const unit=hasFacility(area,'factory_major')?'factory_major':hasFacility(area,'factory_minor')?'factory_minor':null;
  return unit?Math.max(0,(unit==='factory_major'?(improved?12:10):(improved?4:3))-(area.facilityDamage?.[unit]||0)+(repairs[unit]||0)):0;
}
export function facilitySite(area,unit,wallet){
  if(unit==='harbour')return area.coastal&&!hasFacility(area,unit);
  if(unit==='airfield')return !hasFacility(area,unit);
  if(!['factory_major','factory_minor'].includes(unit)||area.island||area.ipc<2||
    hasFacility(area,'factory_major')||hasFacility(area,'factory_minor'))return false;
  return unit==='factory_minor'||area.original===wallet&&area.ipc>=3;
}
const shipyardPrices={battleship:17,carrier:13,cruiser:9,destroyer:7,transport:6,submarine:5};
export function unitPrice(match,unit){
  return hasTech(match,match?.power,'shipyards')&&shipyardPrices[unit]||globalUnits[unit][1];
}
export function purchaseTotal(draft,match){
  return Object.entries(draft).reduce((sum,[unit,n])=>sum+n*unitPrice(match,unit),0);
}
export const burmaRoadOpen=board=>['India','Burma','Yunnan','Szechwan'].every(name=>['British','UK_Pacific','Chinese','Americans','ANZAC','French','Russians'].includes(board[name]?.owner));
export function purchasePlan(match,wallet=match.power){
  if(!spendingEconomies(match).includes(wallet))throw Error('Choose an economy of the active power.');
  const orders=(wallet===match.power?match.draft:match.pacificDraft)||{};
  const allowed=purchaseCapitalAvailable(match,wallet);
  const roadOpen=burmaRoadOpen(match.board);
  const repairs=[],upgrades=[],sites={factory_minor:0,factory_major:0,airfield:0,harbour:0};
  let capacity=0,coastalCapacity=0,cost=purchaseTotal(orders,match),combatCount=0,seaCount=0;
  for(const [name,area] of Object.entries(match.board)){
    if(area.owner!==wallet)continue;
    const minor=hasFacility(area,'factory_minor'),major=hasFacility(area,'factory_major');
    for(const unit of purchaseGroups.Facilities){
      const damage=area.facilityDamage?.[unit]||0;
      if(damage&&hasFacility(area,unit)){
        const quantity=match.repairDraft?.[name]?.[unit]||0;
        const perIPC=hasTech(match,wallet,'factories')&&unit.startsWith('factory_')?2:1;
        repairs.push({name,unit,damage,quantity,perIPC});cost+=Math.ceil(quantity/perIPC);
      }
    }
    if(minor||major){
      const unit=major?'factory_major':'factory_minor';
      const slots=productionSlots(area,match.repairDraft?.[name],hasTech(match,wallet,'factories'));
      capacity+=slots;if(area.coastal)coastalCapacity+=slots;
      if(minor&&area.original===wallet&&area.ipc>=3&&!match.pendingUpgrades?.[name]){
        const selected=!!match.upgradeDraft?.[name],ready=(area.facilityDamage?.[unit]||0)===(match.repairDraft?.[name]?.[unit]||0);
        upgrades.push({name,selected,ready});if(selected)cost+=20;
      }
    }
    for(const unit of purchaseGroups.Facilities)if(facilitySite(area,unit,wallet))sites[unit]++;
  }
  for(const [unit,n] of Object.entries(orders)){
    if(!purchaseGroups.Facilities.includes(unit))combatCount+=n;
    if(purchaseGroups.Sea.includes(unit))seaCount+=n;
  }
  const remaining=match.treasury[wallet]-cost;
  const limits={};
  for(const unit of Object.keys(globalUnits)){
    const price=unitPrice(match,unit);
    let room=wallet==='Chinese'?(unit==='infantry'||unit==='artillery'&&roadOpen?Infinity:0):capacity-combatCount;
    if(wallet!=='Chinese'&&Object.hasOwn(sites,unit)){
      room=sites[unit]-(orders[unit]||0);
      if(unit.startsWith('factory_'))room=Math.min(room,sites.factory_minor-(orders.factory_major||0)-(orders.factory_minor||0));
    }
    if(purchaseGroups.Sea.includes(unit))room=Math.min(room,coastalCapacity-seaCount);
    limits[unit]=allowed?Math.max(0,Math.min(room,Math.floor(remaining/price))):0;
  }
  return {wallet,orders,cost,remaining,limits,allowed,repairs,upgrades,capacity,coastalCapacity,combatCount,seaCount,sites,roadOpen};
}
export function changePurchase(match,unit,delta,wallet=match.power){
  if(match.phase!=='purchase'||!Object.hasOwn(globalUnits,unit)||![-1,1].includes(delta))throw Error('This purchase cannot be changed.');
  const plan=purchasePlan(match,wallet),n=(plan.orders[unit]||0)+delta;
  if(n<0||delta>0&&!plan.limits[unit])throw Error('This order exceeds the available funds, eligible sites or production capacity.');
  const orders={...plan.orders,[unit]:n};
  if(!n)delete orders[unit];
  match[wallet===match.power?'draft':'pacificDraft']=orders;
}
function validatePlan(plan){
  const {orders,remaining,allowed,cost,wallet,capacity,combatCount,seaCount,coastalCapacity,sites,upgrades,repairs,roadOpen}=plan;
  if(!Number.isSafeInteger(remaining)||remaining<0||(!allowed&&cost))throw Error('The treasury cannot cover this order.');
  for(const [type,n] of Object.entries(orders)){
    if(!Number.isSafeInteger(n)||n<0||wallet==='Chinese'&&!(type==='infantry'||type==='artillery'&&roadOpen))throw Error('An ordered unit is unavailable.');
  }
  if(wallet!=='Chinese'&&(combatCount>capacity||seaCount>coastalCapacity))throw Error('Reduce the unit order before removing this factory repair.');
  if(Object.entries(sites).some(([unit,max])=>(orders[unit]||0)>max)||(orders.factory_minor||0)+(orders.factory_major||0)>sites.factory_minor)throw Error('There are too few eligible facility sites.');
  if(repairs.some(r=>!Number.isSafeInteger(r.quantity)||r.quantity<0||r.quantity>r.damage)||upgrades.some(u=>u.selected&&!u.ready))throw Error('Repair the complex fully before upgrading.');
}
export function changeFacilityOrder(match,wallet,name,unit,delta){
  if(match.phase!=='purchase'||![-1,1].includes(delta))throw Error('Repairs are closed.');
  const plan=purchasePlan(match,wallet),next={...match};
  if(unit==='upgrade'){
    const site=plan.upgrades.find(row=>row.name===name);
    if(!site||site.selected===(delta===1))throw Error('This complex cannot be upgraded.');
    next.upgradeDraft={...match.upgradeDraft};
    if(delta===1)next.upgradeDraft[name]=true;else delete next.upgradeDraft[name];
  }else{
    const site=plan.repairs.find(row=>row.name===name&&row.unit===unit);
    if(!site)throw Error('This facility has no repairable damage.');
    next.repairDraft={...match.repairDraft,[name]:{...match.repairDraft?.[name],[unit]:site.quantity+delta}};
  }
  validatePlan(purchasePlan(next,wallet));
  match.repairDraft=next.repairDraft;match.upgradeDraft=next.upgradeDraft;
}
export function eligibleShipRepairs(match){
  const eligible=[];
  for(const [name,sea] of Object.entries(match.board)){
    const damage=sea.shipDamage?.[match.power];
    if(!damage||!sea.coasts)continue;
    const wallet=match.power==='British'&&parseInt(name)<=63?'UK_Pacific':match.power;
    if(!purchaseCapitalAvailable(match,wallet))continue;
    const serviced=sea.coasts.some(coast=>{
      const area=match.board[coast],owner=area.owner==='UK_Pacific'?'British':area.owner;
      const friendly=owner===match.power||match.diplomacy.some(([a,b,rel])=>rel==='Allied'&&(a===owner&&b===match.power||b===owner&&a===match.power));
      return friendly&&hasFacility(area,'harbour')&&(area.facilityDamage?.harbour||0)-(match.repairDraft?.[coast]?.harbour||0)<3;
    });
    if(!serviced)continue;
    for(const type of ['battleship','carrier']){
      const count=sea.units.find(([owner,unit])=>owner===match.power&&unit===type)?.[2]||0;
      const eligibleCount=Math.min(count,damage[type]||0);
      if(eligibleCount>0)eligible.push({name,type,count:eligibleCount});
    }
  }
  return eligible;
}
export function purchaseCapitalAvailable(match,wallet){
  return wallet==='Chinese'||match.board[capitals[wallet]]?.owner===wallet;
}
export function confirmPurchase(match){
  if(match.phase!=='purchase')throw Error('This purchase was already recorded.');
  const plans=spendingEconomies(match).map(wallet=>purchasePlan(match,wallet));
  plans.forEach(validatePlan);
  const ships=eligibleShipRepairs(match);
  const receipt=[];
  for(const {wallet,orders,repairs,upgrades,cost} of plans){
    const items=[];
    match.treasury[wallet]-=cost;
    const pool=match.mobilization[wallet]??={};
    for(const [unit,n] of Object.entries(orders)){
      pool[unit]=(pool[unit]||0)+n;items.push(n+' × '+globalUnits[unit][0]);
    }
    for(const {name,unit,quantity} of repairs){
      if(!quantity)continue;
      match.board[name].facilityDamage[unit]-=quantity;
      items.push(name+' '+globalUnits[unit][0]+' repaired '+quantity);
    }
    for(const {name,selected} of upgrades){
      if(!selected)continue;
      (match.pendingUpgrades??={})[name]=wallet;items.push(name+' complex upgrade');
    }
    const economy=match.power==='British'?(wallet==='British'?'Europe · ':'Pacific · '):'';
    receipt.push(economy+cost+' IPCs spent'+(items.length?' · '+items.join(', '):''));
  }
  for(const {name,type,count} of ships){
    match.board[name].shipDamage[match.power][type]-=count;
    receipt.push(name+' · '+count+' × '+globalUnits[type][0]+' repaired free');
  }
  match.draft={};delete match.pacificDraft;delete match.repairDraft;delete match.upgradeDraft;
  match.phase='combatMove';
  return {title:'Purchase & Repair',detail:receipt.join('. ')+'.'};
}
export const globalKey='wartable.global1940.match.v1';
const regionAliases={'Holland Belgium':'hb','Western Germany':'wg','Normandy Bordeaux':'nb','France':'fr',
  'Northern Italy':'ni','Southern France':'sf','Baltic States':'bs','Eastern Poland':'ep','Bessarabia':'be','Poland':'pl','Romania':'ro'};
const typeKeys={infantry:'inf',armour:'tank'};
export const boardUnitType=type=>typeKeys[type]||type;
export function prepareGlobalBoard(setup,atlas,match){
  const {sectors,projection}=atlas;
  const forces={},shapes={},units={},owners={},pieces={};
  const ids=Object.fromEntries(Object.keys(setup.regions).map(name=>[name,regionAliases[name]||'world-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-')]));
  const attacker=globalPowers[match.power];
  const relations=match.diplomacy||setup.diplomacy;
  const enemies=new Set(relations.filter(([a,b,rel])=>rel==='War'&&(a===match.power||b===match.power)).map(([a,b])=>a===match.power?b:a));
  if(enemies.has('British'))enemies.add('UK_Pacific');
  const friendlyPowers={},friends={};
  const holdScrambles=match.holdScrambles??={};
  const hostileTo=(power,other)=>atWarWith(match,power==='UK_Pacific'?'British':power,other==='UK_Pacific'?'British':other);
  for(const p of [...Object.keys(globalPowers),'UK_Pacific']){
    const canonical=p==='UK_Pacific'?'British':p;
    const side=new Set([canonical,...relations.filter(([a,b,r])=>r==='Allied'&&(a===canonical||b===canonical)).map(([a,b])=>a===canonical?b:a)]);
    if(side.has('British'))side.add('UK_Pacific');
    friendlyPowers[p]=[...side];friends[p]=[...side].map(key=>ownerNames[key]||key);
  }
  const allies=new Set(friendlyPowers[match.power]);
  const gates={'64-89':['Central America'],'81-98':['Egypt','Trans-Jordan'],'99-100':['Turkey'],'91-92':['Gibraltar'],'112-113':['Denmark']};
  const shipDamage={};
  const neighbors={},neutralEntry={},unmovedLand={};
  function hostileLand(name){
    const region=setup.regions[name],owner=match.board[name].owner;
    return enemies.has(owner)||neutralOwners[owner]&&canEnterNeutral(match.power,enemies,region)&&hostileNeutral(match.power,owner);
  }
  const spaces={},openingDamage={},openingFacilityDamage={},embarked={},defensiveBases=[];
  function canalOpen(from,to,type){
    const gate=[parseInt(places[from].name),parseInt(places[to].name)].sort((a,b)=>a-b).join('-');
    return type==='submarine'&&gate==='91-92'||!gates[gate]?.some(coast=>!allies.has(match.board[coast].owner));
  }
  const power=match.power,war=p=>enemies.has(p);
  const sovietPacific=atWarWith(match,'Russians','Japanese');
  const sovietEurope=['Germans','Italians'].some(p=>atWarWith(match,'Russians',p));
  function politicallyOpen(name,r,owner){
    if(r.water)return power!=='Chinese';
    if(power==='Chinese')return r.original==='Chinese'||name==='Burma'||name==='Kwangtung';
    if(r.original==='Chinese'&&!war('Japanese')&&['Americans','British','ANZAC','French','Russians'].includes(power))return false;
    // The printed map boundary differs from the UK treasury boundary.
    const pacific=!['West India','Kazakhstan','Evenkiyskiy'].includes(name)&&(pacificOriginals.has(r.original)||otherPacificLand.has(name)||
      ['Western United States','Alaska','British Columbia','Aleutian Islands','Mexico'].includes(name));
    if(power==='Russians'&&owner!=='Russians'&&!enemies.has(owner))return pacific?sovietPacific:sovietEurope;
    if(owner==='Russians'&&power!=='Russians'&&allies.has(owner))return pacific?sovietPacific:sovietEurope;
    return true;
  }
  // Neutral naval patrol rules constrain the end of a move, including transports.
  const restrictedSea=new Set();
  if(power==='Japanese'&&!war('Americans')){
    for(const name of ['Alaska','Western United States'])for(const coast of setup.regions[name].links){
      if(!setup.regions[coast].water)continue;
      restrictedSea.add(ids[coast]);
      for(const near of setup.regions[coast].links)if(setup.regions[near].water)restrictedSea.add(ids[near]);
    }
  }
  function seaStop(id,type){
    if(restrictedSea.has(id))return false;
    if(power!=='Americans')return true;
    const name=places[id].name,coasts=match.board[name].coasts||[];
    if(!war('Japanese')&&coasts.some(n=>match.board[n].owner==='Japanese'))return false;
    return parseInt(name)<=64||war('Germans')||war('Italians')||coasts.some(n=>match.board[n].owner==='Americans')||
      parseInt(name)===102&&type!=='transport';
  }
  function refreshBases(board){
    defensiveBases.length=0;
    const base=(name,type)=>allies.has(board[name].owner)&&hasFacility(board[name],type)&&(board[name].facilityDamage?.[type]||0)<3;
    for(const [name,r] of Object.entries(setup.regions)){
      const space=spaces[ids[name]];
      if(board[name].facilityDamage)openingFacilityDamage[ids[name]]={...board[name].facilityDamage};
      if(r.water)openingDamage[ids[name]]=structuredClone(board[name].shipDamage||{});
      space.airBase=!r.water&&base(name,'airfield');
      if(!r.water&&hasFacility(board[name],'airfield')&&
        (board[name].facilityDamage?.airfield||0)<3&&r.links.some(link=>setup.regions[link].water))defensiveBases.push(ids[name]);
      space.navalBase=r.water&&r.links.some(link=>base(link,'harbour'));
    }
  }
  for(const [name,r] of Object.entries(setup.regions)){
    const id=ids[name],position=match.board[name],owner=r.blocked?'Impassable':r.water?'Sea zone':ownerNames[position.owner]||'Impassable';
    neighbors[id]=r.links.map(n=>ids[n]);
    neutralEntry[id]=!r.blocked&&canEnterNeutral(match.power,enemies,r);
    pieces[id]=position.units.map(([power,unit,n])=>[power,boardUnitType(unit),n]);
    if(position.embarked?.length)embarked[id]=structuredClone(position.embarked);
    if(position.shipDamage)shipDamage[id]=structuredClone(position.shipDamage);
    const enemyAtSea=position.units.filter(([p,t,n])=>n&&enemies.has(p)&&ships.includes(t));
    spaces[id]={water:r.water,friendly:allies.has(position.owner),enemy:enemies.has(position.owner),
      allowed:!r.blocked&&politicallyOpen(name,r,position.owner),
      attackLand:!r.water&&!r.blocked&&!!hostileLand(name),
      blitz:!r.water&&enemies.has(position.owner)&&!position.units.some(([, ,n])=>n>0),
      enemyFleet:enemyAtSea.length>0,blockingFleet:enemyAtSea.some(([,t])=>t!=='transport'&&t!=='submarine'),
      destroyer:enemyAtSea.some(([,t])=>t==='destroyer')};
    places[id]={name,owner:r.blocked?owner:ownerNames[r.owner]||owner,startOwner:owner,blocked:r.blocked,targets:[],unitTargets:{},water:r.water,city:r.city,ipc:r.ipc,links:r.links,original:r.original};
    shapes[id]={...sectors[name],garrison:pieces[id].filter(row=>row[2]>0).map(row=>[...row]),homePower:position.owner};
    owners[id]=owner;forces[id]=true;
    if(!r.water&&!r.blocked)unmovedLand[id]=openingLand(pieces[id],match.power);
    units[id]=strengthOf(pieces[id].filter(([power,type])=>stats[type]&&
      (r.water?enemies.has(power):owner!==attacker||samePower(power,match.power))));
  }
  refreshBases(match.board);
  const movement=combatMovement(spaces,neighbors,canalOpen,seaStop,()=>hasTech(match,match.power,'range'));
  for(const id of Object.keys(forces)){
    const place=places[id];
    for(const [power,type,n] of pieces[id]){
      if(n&&samePower(power,match.power)&&mobileTypes.includes(type)){
        const routes=movement.searchFor(id,type);
        place.unitTargets[type]=neighbors[id].filter(to=>routes.legal(to));
      }
    }
    place.targets=[...new Set(Object.values(place.unitTargets).flat())];
    // Arrival formations are keyed by the final edge, even if no stack started there.
    place.movementEdges=neighbors[id].filter(to=>spaces[to].allowed&&
      (spaces[to].attackLand||spaces[to].water||spaces[id].blitz&&spaces[to].friendly));
  }
  const cities=globalCities.map(([name,region,lon,lat,capitalOf])=>({name,territory:ids[region],lon,lat,point:sectors[region].city,capitalOf}));
  const home={Germans:'Germany',Russians:'Russia',Japanese:'Japan',Americans:'Eastern United States',Chinese:'Szechwan',
    British:'United Kingdom',Italians:'Southern Italy',ANZAC:'New South Wales',French:'France'}[match.power];
  const [x,y]=sectors[home].center;
  const camera={x,y,z:.7*projection.detailScale,surveyZoom:true};
  function captureWallet(name){
    const pacific=pacificOriginals.has(setup.regions[name].original)||otherPacificLand.has(name);
    return match.power==='British'&&pacific?'UK_Pacific':match.power;
  }
  const occupy=(game,id)=>occupyTerritory(game,id,places,ids,captureWallet,match.frenchLiberationAwarded);
  const exercise={technology:match.technology,occupy,name:'Global 1940',attacker,power:match.power,camera,forces,shapes,cities,world:true,friendlyPowers,friends,enemies:[...enemies],projection,neighbors,neutralEntry,unmovedLand,movement,defensiveBases,holdScrambles,hostileTo,refreshBases,canalOpen,seaStop,openingDamage,openingFacilityDamage};
  exercises.global=exercise;
  let openingView;
  if(match.phase==='briefing'&&match.power!=='Germans'){
    openingView={...camera,z:.72,projection:projection.id};
  }else if(match.phase==='briefing'){
    // Fit the opening theater in the map's 650 by 480 reference viewport.
    const landmarks=['United Kingdom','France','Novgorod','Russia'].map(name=>sectors[name].city);
    const xs=landmarks.map(point=>point[0]),ys=landmarks.map(point=>point[1]);
    const left=Math.min(...xs)-360,right=Math.max(...xs)+360;
    const top=Math.min(...ys)-320,bottom=Math.max(...ys)+320;
    openingView={x:(left+right)/2,y:(top+bottom)/2,z:projection.detailScale*Math.min(650/(right-left),480/(bottom-top)),
      surveyZoom:true,projection:projection.id};
  }
  return {exercise,openingView,game:{version:1,exercise:'global',phase:'plan',mongolianPactBroken:!!match.mongolianPactBroken,power:match.power,units,owners,pieces,shipDamage,embarked,orders:[],battles:[],active:null,record:[]}};
}
export function saveGlobalPosition(match,game){
  settleCapitalPayments(match,game);
  match.mongolianPactBroken=!!game.mongolianPactBroken;
  for(const [id,stacks] of Object.entries(game.pieces)){
    const area=match.board[places[id].name];
    const assigned=game.controlChanges?.[id];
    const legacyCapture=game.owners[id]===globalPowers[match.power]&&ownerNames[area.owner]!==game.owners[id];
    if(assigned)area.owner=assigned;
    else if(legacyCapture){
      const pacific=pacificOriginals.has(area.original)||otherPacificLand.has(places[id].name);
      area.owner=match.power==='British'&&pacific?'UK_Pacific':match.power;
    }else if(neutralKey(game.owners[id]))area.owner=neutralKey(game.owners[id]);
    else if(game.owners[id]==='Soviet Union'&&places[id].original==='Mongolians')area.owner='Russians';
    if(game.raidDamage?.[id])Object.assign(area.facilityDamage??={},game.raidDamage[id]);
    if((assigned||legacyCapture)&&area.facilityDamage){
      if(area.facilityDamage.factory_major&&stacks.some(([,t,n])=>t==='factory_minor'&&n)){
        area.facilityDamage.factory_minor=Math.min(6,area.facilityDamage.factory_major);
        delete area.facilityDamage.factory_major;
      }
      if(area.owner==='Chinese'&&area.original==='Chinese'){
        delete area.facilityDamage.factory_minor;delete area.facilityDamage.factory_major;
      }
    }
    if(game.embarked?.[id]?.length)area.embarked=structuredClone(game.embarked[id]);
    else if(game.embarked)delete area.embarked;
    if(game.shipDamage?.[id])area.shipDamage=structuredClone(game.shipDamage[id]);
    area.units=stacks.filter(row=>row[2]>0).map(([p,t,n])=>[p,t==='inf'?'infantry':t==='tank'?'armour':t,n]);
  }
}
export async function loadGlobalSetup(){
  return await (await fetch('./assets/global-setup.json')).json();
}
export async function loadGlobalBoard(provided){
  const setup=await loadGlobalSetup();
  const sectors=await (await fetch('./assets/world-sectors.json')).json();
  const saved=provided?null:localStorage.getItem(globalKey);
  const match=provided||(saved?JSON.parse(saved):startGlobalPlaytest(setup,Object.fromEntries(Object.keys(globalPowers).map(k=>[k,1]))));
  return restoreGlobalBoard(setup,sectors,match);
}
export function restoreGlobalBoard(setup,sectors,match){
  if(match.version!==1||!match.board?.Germany)throw Error('The saved global match could not be opened.');
  match.combatStart??=structuredClone(match.board);
  match.combatStartPactBroken??=!!match.mongolianPactBroken;
  // Older saves omit the Sahara and display the Himalayas with China's setup color.
  for(const [name,region] of Object.entries(setup.regions)){
    if(!region.blocked)continue;
    match.board[name]??={owner:region.owner,units:[]};
    match.combatStart[name]??={owner:region.owner,units:[]};
  }
  preparePurchaseSites(match,setup);
  match.holdScrambles??={};
  const board=prepareGlobalBoard(setup,sectors,{...match,board:match.combatStart,mongolianPactBroken:match.combatStartPactBroken});
  const savedGame=match.combat?.game;
  if(savedGame?.refreshPoliticalForces){
    savedGame.units=structuredClone(board.game.units);
    delete savedGame.refreshPoliticalForces;
  }
  if(savedGame)savedGame.shipDamage??=structuredClone(board.game.shipDamage);
  if(savedGame)for(const id of Object.keys(board.game.owners)){
    if(!places[id].blocked)continue;
    savedGame.owners[id]=board.game.owners[id];
    savedGame.units[id]??=board.game.units[id];
    savedGame.pieces[id]??=board.game.pieces[id];
  }
  return {...board,match};
}
