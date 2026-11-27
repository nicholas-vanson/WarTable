import {openIncome} from './income.js';
// Phase 5 uses the factories held at turn opening, after purchase-phase repairs.
// Keep the paid reserves and committed board intact while a player revises the draft.
import {places,samePower,exerciseOf,deckSpace,flightRecoveries} from './rules.js';
import {spendingEconomies,globalUnits,boardUnitType,purchaseGroups,isFacility,facilitySite,productionSlots,saveGlobalPosition} from './global-game.js';
import {completeNoncombat,noncombatPosition} from './noncombat.js';

export function beginMobilization(game){
  const finished=completeNoncombat(game);
  return {...finished,phase:'mobilize',placements:[...(game.carrierLaunches||[])]};
}

// A launch promised before aircraft move supplies landing berths only. The
// paid hull first appears on the board when the mobilization draft is committed.
export function launchPlan(match,s,launches=s.carrierLaunches||[]){
  if(!['plan','noncombat'].includes(s.phase))throw Error('Carrier launch reservations are closed.');
  if(launches.some(o=>o.unit!=='carrier'))throw Error('Only purchased carriers can reserve landing spaces.');
  return mobilizationPlan(match,{...s,phase:'mobilize',carrierLaunches:[],placements:launches});
}
export function reviseLaunches(match,s,launches){
  launchPlan(match,s,launches);
  const next={...s,carrierLaunches:launches};
  if(s.phase==='plan'&&!flightRecoveries(next,s.orders))throw Error('Revise the air order that needs this carrier first.');
  if(s.phase==='noncombat'){
    const g=noncombatPosition(next),friends=exerciseOf(g).friendlyPowers[g.power];
    if((s.carrierLaunches||[]).some(o=>deckSpace(g,o.to,friends)<0))
      throw Error('Reassign the aircraft using this carrier first.');
  }
  return launches;
}

function eligiblePlant(plan,id,wallet){
  const area=plan.match.board[places[id].name];
  return area.owner===wallet&&plan.match.combatStart[places[id].name].owner===wallet;
}
function chineseSite(plan,id){
  const area=plan.match.board[places[id].name];
  return area.owner==='Chinese'&&area.original==='Chinese';
}
function facilityRoom(plan,id,unit,wallet){
  const area=plan.match.board[places[id].name];
  return facilitySite({...area,units:plan.game.pieces[id]},unit,wallet);
}
function ownDeckRoom(plan,id){
  const g=plan.game,friends=exerciseOf(g).friendlyPowers[g.power];
  let own=0,allied=0,planes=0;
  for(const [p,t,n] of g.pieces[id]){
    if(!friends.includes(p))continue;
    if(t==='carrier'){
      const berths=2*Math.max(0,n-(g.shipDamage?.[id]?.[p]?.carrier||0));
      if(samePower(g.power,p))own+=berths;else allied+=berths;
    }else if(t==='fighter'||t==='tactical_bomber')planes+=n;
  }
  // Deck assignments are pooled within a sea zone. New aircraft need an own berth.
  return Math.max(0,Math.min(own-(plan.ownDeckUsed[id]||0),own+allied-planes));
}
export function placementOptions(plan,wallet,unit){
  const left=plan.remaining[wallet]?.[unit],options=[];
  if(!left||!spendingEconomies(plan.match).includes(wallet))return options;
  const ship=purchaseGroups.Sea.includes(unit),onDeck=unit==='fighter'||unit==='tactical_bomber';
  for(const id of plan.land){
    if(wallet==='Chinese'){
      if(['infantry','artillery'].includes(unit)&&chineseSite(plan,id))options.push({site:id,to:id,limit:left});
      continue;
    }
    if(!eligiblePlant(plan,id,wallet))continue;
    if(isFacility(unit)){
      if(facilityRoom(plan,id,unit,wallet))options.push({site:id,to:id,limit:1});
      continue;
    }
    const free=Math.min(left,plan.slots[id]||0);
    if(!free)continue;
    if(!ship)options.push({site:id,to:id,limit:free});
    if(ship||onDeck)for(const to of exerciseOf(plan.game).neighbors[id]){
      if(!places[to].water)continue;
      const limit=ship?free:Math.min(free,ownDeckRoom(plan,to));
      if(limit>0)options.push({site:id,to,limit});
    }
  }
  return options;
}
function placeFromReserve(plan,order){
  const {wallet,unit,site,to,quantity}=order;
  const option=placementOptions(plan,wallet,unit).find(o=>o.site===site&&o.to===to);
  if(!option||!Number.isSafeInteger(quantity)||quantity<1||quantity>option.limit)
    throw Error('Choose an eligible site with enough space for this placement.');
  plan.remaining[wallet][unit]-=quantity;
  if(wallet!=='Chinese'&&!isFacility(unit))plan.slots[site]-=quantity;
  if(places[to].water&&['fighter','tactical_bomber'].includes(unit))plan.ownDeckUsed[to]=(plan.ownDeckUsed[to]||0)+quantity;
  const type=boardUnitType(unit),rows=plan.game.pieces[to];
  let row=rows.find(([p,t])=>p===wallet&&t===type);
  if(!row){row=[wallet,type,0];rows.push(row);}
  row[2]+=quantity;
  const incoming=plan.game.placementMarks[to]??={};
  incoming[type]=(incoming[type]||0)+quantity;
  if(!isFacility(unit))plan.game.units[to][type]=(plan.game.units[to][type]||0)+quantity;
}
// Find the maximum number that can fit before any choices use scarce coastal
// slots or major-complex sites. Only genuine excess purchases can be refunded.
function mobilizableCount(plan,wallet){
  const pool=plan.remaining[wallet];
  if(wallet==='Chinese')return plan.land.some(id=>chineseSite(plan,id))?(pool.infantry||0)+(pool.artillery||0):0;
  let slots=0,coastal=0;
  const sites={factory_minor:0,factory_major:0,airfield:0,harbour:0};
  for(const id of plan.land){
    if(!eligiblePlant(plan,id,wallet))continue;
    slots+=plan.slots[id];if(plan.match.board[places[id].name].coastal)coastal+=plan.slots[id];
    for(const unit of purchaseGroups.Facilities)if(facilityRoom(plan,id,unit,wallet))sites[unit]++;
  }
  let sea=0,other=0;
  for(const [unit,n] of Object.entries(pool)){
    if(purchaseGroups.Sea.includes(unit))sea+=n;else if(!isFacility(unit))other+=n;
  }
  return Math.min(slots,other+Math.min(coastal,sea))+
    Math.min(sites.factory_minor,(pool.factory_minor||0)+Math.min(sites.factory_major,pool.factory_major||0))+
    Math.min(sites.airfield,pool.airfield||0)+Math.min(sites.harbour,pool.harbour||0);
}
export function mobilizationPlan(match,s,placements=s.placements){
  if(s.phase!=='mobilize')throw Error('Mobilization is closed.');
  const game={...s,pieces:structuredClone(s.pieces),units:structuredClone(s.units),placementMarks:{},placements};
  const plan={match,game,land:Object.keys(s.pieces).filter(id=>!places[id].water&&!places[id].blocked),
    slots:{},remaining:{},required:0,assigned:0,upgrades:[],ownDeckUsed:{}};
  for(const id of plan.land){
    const name=places[id].name,area=match.board[name],opening=match.combatStart[name];
    plan.slots[id]=Math.min(productionSlots(area),productionSlots(opening));
  }
  for(const wallet of spendingEconomies(match)){
    plan.remaining[wallet]={...match.mobilization?.[wallet]};
    plan.required+=mobilizableCount(plan,wallet);
  }
  for(const [name,wallet] of Object.entries(match.pendingUpgrades||{})){
    if(!Object.hasOwn(plan.remaining,wallet))continue;
    const id=plan.land.find(id=>places[id].name===name);
    const row=id&&game.pieces[id].find(([,t,n])=>t==='factory_minor'&&n);
    const eligible=row&&eligiblePlant(plan,id,wallet)&&match.board[name].original===wallet&&match.board[name].ipc>=3;
    if(eligible){
      row[1]='factory_major';(game.placementMarks[id]??={}).factory_major=1;
    }
    plan.upgrades.push({name,wallet,applied:!!eligible});
  }
  for(const order of placements){placeFromReserve(plan,order);plan.assigned+=order.quantity;}
  const side=exerciseOf(game).friendlyPowers[game.power];
  if((s.carrierLaunches||[]).some(o=>deckSpace(game,o.to,side)<0))
    throw Error('Aircraft in this sea zone need their reserved carrier.');
  return plan;
}
export function finishMobilization(match,s){
  if(match.phase!=='mobilize'||match.power!==s.power||match.combat?.game.phase!=='mobilize')throw Error('This power is no longer mobilizing.');
  const plan=mobilizationPlan(match,s);
  if(plan.assigned<plan.required)throw Error('Assign the remaining units. You can undo a placement to free a production slot.');
  const next=structuredClone(match),record=[...s.record];
  for(const {unit,quantity,to,site} of s.placements){
    record.push({title:places[to].name,detail:'Mobilized '+quantity+' × '+globalUnits[unit][0]+
      (site===to?'':' from '+places[site].name)+'.'});
  }
  for(const {name,wallet,applied} of plan.upgrades){
    delete next.pendingUpgrades[name];
    if(!applied)next.treasury[wallet]+=20;
    record.push({title:name,detail:applied?'Upgraded to a major industrial complex.':'Complex upgrade refunded · 20 IPCs.'});
  }
  for(const [wallet,pool] of Object.entries(plan.remaining)){
    for(const [unit,n] of Object.entries(pool))if(n){
      const refund=n*globalUnits[unit][1];
      next.treasury[wallet]+=refund;
      record.push({title:globalUnits[unit][0],detail:n+' unplaced · '+refund+' IPCs reimbursed.'});
    }
    delete next.mobilization[wallet];
  }
  if(record.length===s.record.length)record.push({title:'Mobilize new units',detail:'No reserves to place.'});
  saveGlobalPosition(next,plan.game);
  next.combat.game={...s,pieces:plan.game.pieces,units:plan.game.units,record};
  return openIncome(next);
}
