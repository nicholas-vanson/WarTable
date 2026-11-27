// Global 1940 Second Edition, Conduct Combat, "Strategic and Tactical Bombing Raids".
import {exerciseOf,places,stats,alterStack,die,returnAircraft,resumeCombat} from './rules.js';

export const damageLimit={factory_major:20,factory_minor:6,airfield:6,harbour:6};
export const raidFacilityNames={factory_major:'Major industrial complex',factory_minor:'Minor industrial complex',airfield:'Air base',harbour:'Naval base'};
export function raidTargets(s,to,type){
  const ex=exerciseOf(s);
  if(!ex.world||!ex.enemies.includes(ex.shapes[to]?.homePower))return [];
  if(type==='fighter')return s.orders.some(o=>o.to===to&&o.raid&&o.raid!=='escort')?['escort']:[];
  if(type!=='bomber'&&type!=='tactical_bomber')return [];
  return s.pieces[to].filter(([,t,n])=>n&&damageLimit[t]&&(type==='bomber'||t==='airfield'||t==='harbour')).map(([,t])=>t);
}
export function facilityHits(s,id,type){
  const ex=exerciseOf(s),damage=t=>s.raidDamage?.[id]?.[t]??ex.openingFacilityDamage?.[id]?.[t]??0;
  if(type==='factory_minor'&&s.controlChanges?.[id]&&ex.shapes[id].garrison.some(([,t,n])=>t==='factory_major'&&n))
    return Math.min(damageLimit.factory_minor,damage('factory_major'));
  return damage(type);
}
export function checkRaidOrders(s){
  for(const o of s.orders){
    if(!o.raid)continue;
    const members=Object.keys(o.units).filter(t=>o.units[t]>0);
    if(members.length!==1||!raidTargets(s,o.to,members[0]).includes(o.raid))
      throw Error(o.raid==='escort'?'Assign a bomber to this territory or cancel its escort.':'Choose an enemy facility this bomber can raid.');
  }
}
export function prepareRaids(s){
  const ex=exerciseOf(s),groups=new Map();
  for(const [index,o] of s.orders.entries()){
    if(!o.raid)continue;
    const type=Object.keys(o.units).find(t=>o.units[t]>0),n=o.units[type];
    if(!groups.has(o.to)){
      const interceptors=s.pieces[o.to].filter(([p,t,n])=>n&&t==='fighter'&&ex.enemies.includes(p)&&ex.friends[p]?.includes(s.owners[o.to]))
        .map(([power,,n])=>({power,n,assigned:n,remaining:0}));
      groups.set(o.to,{to:o.to,planes:[],interceptors,step:'targets'});
    }
    const r=groups.get(o.to);
    for(let i=0;i<n;i++)r.planes.push({order:index,type,target:o.raid});
    alterStack(s,o.from,s.power,type,-n);s.units[o.from][type]=Math.max(0,(s.units[o.from][type]||0)-n);
    s.record.push({raid:true,title:(o.raid==='escort'?'Escort':'Bombing raid')+' · '+places[o.to].name,
      detail:n+' × '+stats[type].name+' from '+places[o.from].name+(o.raid==='escort'?'.':' assigned to '+raidFacilityNames[o.raid].toLowerCase()+'.')});
  }
  if(groups.size){s.raids=[...groups.values()];s.raidDefensePending=s.raids.some(r=>r.interceptors.length);}
}
export const pendingRaids=s=>(s.raids||[]).filter(r=>r.step!=='done');
export function setInterceptorCount(s,to,power,n){
  const group=s.raids?.find(r=>r.to===to)?.interceptors.find(f=>f.power===power);
  if(!s.raidDefensePending||!group||!Number.isInteger(n)||n<0||n>group.n)throw Error('Choose an available number of defending fighters.');
  group.assigned=n;
}
export function confirmInterceptors(s){
  if(!s.raidDefensePending)throw Error('Interceptor assignments are closed.');
  for(const r of s.raids){
    for(const f of r.interceptors){
      if(!f.assigned)continue;
      // Preserve the two British economies and any allied guest squadrons.
      const row=s.pieces[r.to].find(([p,t,n])=>p===f.power&&t==='fighter'&&n>=f.assigned);
      row[2]-=f.assigned;s.units[r.to].fighter-=f.assigned;f.remaining=f.assigned;
      s.record.push({raid:true,scramblePower:f.power,title:'Raid interception · '+places[r.to].name,detail:f.assigned+' fighters assigned to air defense.'});
    }
    if(r.interceptors.some(f=>f.assigned))r.step='attack';
  }
  s.raidDefensePending=false;
}
export function chooseRaid(s,to){
  if(s.phase!=='combat'||s.active||s.activeRaid||s.raidDefensePending||!pendingRaids(s).some(r=>r.to===to))
    throw Error('Choose an unresolved raid after assigning interceptors.');
  s.activeRaid=to;
}
export const currentRaid=s=>s.raids?.find(r=>r.to===s.activeRaid);
export function setRaidTarget(s,index,facility){
  const r=currentRaid(s),p=r?.planes[index];
  if(r?.step!=='targets'||!p||p.lost||p.type==='fighter'||!raidTargets(s,r.to,p.type).includes(facility))
    throw Error('Choose an eligible facility for this surviving bomber.');
  p.target=facility;
}
const hitsOnOne=dice=>dice.filter(d=>d.face===1).length;
export function raidLossGroups(r){
  if(r.step==='airLoss')return [{target:null,hits:Math.min(r.planes.length,hitsOnOne(r.defenseDice))}];
  if(r.step==='aaLoss')return [...new Set(r.aaDice.map(d=>d.target))].map(target=>({target,hits:hitsOnOne(r.aaDice.filter(d=>d.target===target))}));
  return [];
}
function finishRaid(s,r){
  r.step='done';delete s.activeRaid;
  if(!pendingRaids(s).length)resumeCombat(s);
}
// Each roll and casualty decision is a separate saved transition.
export function advanceRaid(s,step,losses=[],random=die){
  const r=currentRaid(s);
  if(!r||r.step!==step||s.phase!=='combat')throw Error('This raid step has already been resolved.');
  const live=r.planes.filter(p=>!p.lost),bombers=live.filter(p=>p.type!=='fighter');
  const log=(title,detail)=>s.record.push({raid:true,raidSite:r.to,title:title+' · '+places[r.to].name,detail});
  const faces=dice=>dice.map(d=>d.face).join(', ');
  switch(step){
    case 'attack':
      r.attackDice=live.map(p=>({type:p.type,face:random()}));
      log('Raid attack roll','Rolls '+faces(r.attackDice)+'. Hits on 1.');r.step='defense';break;
    case 'defense':
      r.defenseDice=r.interceptors.flatMap(f=>Array.from({length:f.remaining},()=>({power:f.power,face:random()})));
      log('Interceptor roll','Rolls '+faces(r.defenseDice)+'. Hits on 1.');r.step='airLoss';break;
    case 'airLoss':
    case 'aaLoss': {
      const groups=raidLossGroups(r);
      if(!Array.isArray(losses)||new Set(losses).size!==losses.length||
        losses.some(i=>!Number.isSafeInteger(i)||!r.planes[i]||r.planes[i].lost||step==='aaLoss'&&r.planes[i].type==='fighter')||
        groups.some(g=>losses.filter(i=>!g.target||r.planes[i].target===g.target).length!==g.hits))
        throw Error('Assign exactly the eligible losses for each group.');
      for(const i of losses)r.planes[i].lost=step;
      let detail='Attacker lost '+(losses.map(i=>stats[r.planes[i].type].name.toLowerCase()).join(', ')||'no aircraft')+'.';
      if(step==='airLoss'){
        let hits=hitsOnOne(r.attackDice),lost=0;
        for(const f of r.interceptors){const n=Math.min(f.remaining,hits);f.remaining-=n;hits-=n;lost+=n;}
        detail+=' Defending fighters lost · '+lost+'.';
      }
      log(step==='airLoss'?'Interception losses':'Facility fire losses',detail);
      if(bombers.every(p=>p.lost)){log('Raid ended','No bombers survived to damage a facility.');finishRaid(s,r);}
      else r.step=step==='airLoss'?'targets':'damage';
      break;
    }
    case 'targets':
      r.aaDice=bombers.map(p=>({target:p.target,type:p.type,face:random()}));
      for(const t of new Set(bombers.map(p=>p.target))){
        const dice=r.aaDice.filter(d=>d.target===t);
        log(raidFacilityNames[t]+' fire','Rolls '+faces(dice)+'. Bomber hits · '+hitsOnOne(dice)+'.');
      }
      r.step=hitsOnOne(r.aaDice)?'aaLoss':'damage';break;
    case 'damage': {
      r.outcomes=[];
      r.damageDice=bombers.map(p=>({target:p.target,type:p.type,face:random()}));
      const ledger=(s.raidDamage??={})[r.to]??={};
      for(const t of new Set(bombers.map(p=>p.target))){
        const dice=r.damageDice.filter(d=>d.target===t);
        const before=facilityHits(s,r.to,t),rolled=dice.reduce((n,d)=>n+d.face+(d.type==='bomber'?2:0),0);
        ledger[t]=Math.min(damageLimit[t],before+rolled);
        r.outcomes.push({target:t,before,added:ledger[t]-before,total:ledger[t]});
        log(raidFacilityNames[t]+' bombed',dice.map(d=>d.face+(d.type==='bomber'?' + 2':'')).join(' and ')+
          ' rolled. Added '+(ledger[t]-before)+' damage. Total '+ledger[t]+' of '+damageLimit[t]+'.');
      }
      finishRaid(s,r);break;
    }
    default:throw Error('This raid is complete.');
  }
}
export function recoverRaidAttackers(s){
  for(const r of s.raids||[]){
    const flights=new Map();
    for(const p of r.planes)if(!p.lost)flights.set(p.order,(flights.get(p.order)||0)+1);
    for(const [index,n] of flights){
      const order=s.orders[index],type=Object.keys(order.units).find(t=>order.units[t]>0);
      returnAircraft(s,r,order,type,n);
    }
  }
}
