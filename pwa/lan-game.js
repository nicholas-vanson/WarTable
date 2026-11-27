// LAN commands run synchronously against a private copy before the host saves a revision.
import {globalPowers,startGlobalPlaytest,restoreGlobalBoard,saveGlobalPosition,changePurchase,changeFacilityOrder,confirmPurchase} from './global-game.js';
import {plan,commit,chooseBattle,currentBattle,openingFireKind,rollOpening,rollAttack,rollDefense,casualties,retreat,changeFrenchDraft,placeFrenchAward,places} from './rules.js';
import {queueLanding} from './assault.js';
import {chooseRaid,currentRaid,setInterceptorCount,confirmInterceptors,setRaidTarget,advanceRaid} from './raids.js';
import {queueRocket,queueDrop,fireRocket} from './research-moves.js';
import {canResearch,buyResearch,finishResearch,discover} from './research.js';
import {beginNoncombat,noncombatPosition} from './noncombat.js';
import {beginMobilization,finishMobilization,reviseLaunches,mobilizationPlan} from './mobilize.js';
import {collectIncome,rollConvoys,rollBonds,splitBonds,confirmPoliticalChoice} from './income.js';

export const lanSide=power=>['Germans','Italians','Japanese'].includes(power)?'Axis':'Allies';
export const oppositeSide=side=>side==='Axis'?'Allies':'Axis';
export function createLanMatch(setup,hostSide,research){
  const seats=Object.fromEntries(Object.keys(globalPowers).map(p=>[p,lanSide(p)===hostSide?1:2]));
  const m=startGlobalPlaytest(setup,seats);m.researchEnabled=research;return m;
}
export function lanDecision(m){
  const side=lanSide(m.power),other=oppositeSide(side),g=m.combat?.game;
  if(m.victory)return {side:null,label:'Game over',actions:[]};
  if(g?.frenchAward?.status==='pending')return {side:'Allies',label:'French reinforcements',actions:['french-unit','french-place']};
  if(g?.raidDefensePending)return {side:other,label:'Assign interceptors',actions:['interceptor','confirm-interceptors']};
  if(g?.activeRaid&&currentRaid(g)?.step==='defense')return {side:other,label:'Roll interception',actions:['raid-step']};
  if(g?.active&&currentBattle(g)?.step==='ready'&&openingFireKind(g,currentBattle(g))==='Antiaircraft fire')return {side:other,label:'Roll antiaircraft fire',actions:['opening-fire']};
  if(g?.active&&currentBattle(g)?.step==='defense')return {side:other,label:'Roll defense',actions:['defend']};
  return {side,label:globalPowers[m.power]+'’s turn'};
}
const commandPhases={
  briefing:['begin-turn','skip-research'],research:['research-buy','discover','research-finish'],
  purchase:['buy','facility-order','pay'],combatMove:['politics','plan','landing','drop','rocket','remove-order','remove-rocket','launches','commit'],
  conductCombat:['battle','opening-fire','roll','defend','loss','retreat','raid-battle','interceptor','confirm-interceptors','bomb-target','raid-step','fire-rocket'],
  combatReview:['begin-noncombat'],noncombatMove:['redeploy','launches','finish-noncombat'],
  mobilize:['placements','mobilize'],income:['politics','collect','roll-convoys','roll-bonds','split-bonds']
};
function removeAt(rows,index){
  if(!Number.isInteger(index)||index<0||index>=rows.length)throw Error('That order is unavailable.');
  return rows.filter((_,i)=>i!==index);
}
export function applyLanCommand(m,setup,sectors,side,action,a={}){
  const board=restoreGlobalBoard(setup,sectors,m);
  let g=m.combat?.game||board.game;
  m.combat={game:g};
  const decision=lanDecision(m);
  if(action==='air-orders'){
    if(!['briefing','research','purchase','combatMove'].includes(m.phase)||g.orders.length||g.rocketOrders?.length||decision.actions)throw Error('Set air defense orders before any combat moves.');
    for(const [power,hold] of Object.entries(a.holds)){
      if(!Object.hasOwn(globalPowers,power)||power==='Chinese'||lanSide(power)!==side||typeof hold!=='boolean')throw Error('Choose orders for your own powers.');
      if(hold)m.holdScrambles[power]=true;else delete m.holdScrambles[power];
    }
    return m;
  }
  if(side!==decision.side)throw Error('Waiting for '+(decision.side||'the final review')+'.');
  if(!(decision.actions||commandPhases[m.phase]||[]).includes(action))throw Error('This action is unavailable at this step.');
  switch(action){
    case 'begin-turn':case 'skip-research':m.phase=action==='begin-turn'&&canResearch(m)?'research':'purchase';break;
    case 'research-buy':buyResearch(m,a.dice,a.pacific);break;
    case 'discover':discover(m,a.chart);break;
    case 'research-finish':finishResearch(m,g);break;
    case 'buy':changePurchase(m,a.unit,a.delta,a.wallet);break;
    case 'facility-order':changeFacilityOrder(m,a.wallet,a.site,a.unit,a.delta);break;
    case 'pay':{
      g.record.push(confirmPurchase(m));m.combatStart=structuredClone(m.board);
      for(const [id,place] of Object.entries(places)){
        const damage=m.board[place.name]?.shipDamage;
        if(damage)(g.shipDamage??={})[id]=structuredClone(damage);
      }
      return m;
    }
    case 'politics':return confirmPoliticalChoice(m,a.targets);
    case 'plan':
      if(a.replace!=null)g.orders=removeAt(g.orders,a.replace);
      plan(g,a.from,a.to,a.units,a.path,a.raid);break;
    case 'landing':
      if(a.replace!=null)g.orders=removeAt(g.orders,a.replace);
      queueLanding(g,a.from,a.to,a.draft);break;
    case 'drop':queueDrop(g,a.from,a.to,a.n);break;
    case 'rocket':queueRocket(g,a.from,a.to,a.target);break;
    case 'remove-rocket':g.rocketOrders=(g.rocketOrders||[]).filter(o=>o.from!==a.from);break;
    case 'remove-order':g.orders=removeAt(g.orders,a.index);break;
    case 'launches':g.carrierLaunches=reviseLaunches(m,g,a.orders);break;
    case 'commit':commit(g);break;
    case 'battle':chooseBattle(g,a.to);break;
    case 'opening-fire':rollOpening(g);break;
    case 'roll':rollAttack(g);break;
    case 'defend':rollDefense(g);break;
    case 'loss':casualties(g,a.losses,a.choice);break;
    case 'retreat':retreat(g,a.to);break;
    case 'raid-battle':chooseRaid(g,a.to);break;
    case 'interceptor':setInterceptorCount(g,a.to,a.power,a.n);break;
    case 'confirm-interceptors':confirmInterceptors(g);break;
    case 'bomb-target':setRaidTarget(g,a.index,a.target);break;
    case 'raid-step':advanceRaid(g,a.step,a.losses);break;
    case 'fire-rocket':fireRocket(g,a.from);break;
    case 'french-unit':changeFrenchDraft(g,a.unit,a.delta);break;
    case 'french-place':placeFrenchAward(g);break;
    case 'begin-noncombat':beginNoncombat(g);break;
    case 'redeploy':noncombatPosition(g,a.orders);g.noncombatOrders=a.orders;break;
    case 'finish-noncombat':g=beginMobilization(g);m.combat.game=g;break;
    case 'placements':mobilizationPlan(m,g,a.orders);g.placements=a.orders;break;
    case 'mobilize':return finishMobilization(m,g);
    case 'roll-convoys':return rollConvoys(m);
    case 'roll-bonds':return rollBonds(m);
    case 'split-bonds':splitBonds(m,a.pacific);break;
    case 'collect':return collectIncome(m);
    default:throw Error('Unknown game action.');
  }
  if(!['briefing','research','purchase','income'].includes(m.phase)){
    saveGlobalPosition(m,g);
    m.phase={plan:'combatMove',combat:'conductCombat',review:'combatReview',noncombat:'noncombatMove',mobilize:'mobilize'}[g.phase];
  }
  return m;
}
