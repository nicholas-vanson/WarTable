import {lanRequest,lanSeats,lanToken} from './lan.js';
import {lanDecision,lanSide} from './lan-game.js';
import {breakthroughs,hasTech,canResearch,researchWallets,buyResearch,discover,finishResearch} from './research.js';
import {researchRoutes,dropRoom,queueDrop,queueRocket,rocketsPending,fireRocket} from './research-moves.js';
import {esc,objectivesReference,politicsReference} from './field-guide.js';
import {globalWarStatus,exerciseWarStatus,warStatusChart} from './war-status.js';
import {victoryStatus} from './victory.js';
import {raidTargets,facilityHits,damageLimit,raidFacilityNames,pendingRaids,currentRaid,chooseRaid,setInterceptorCount,confirmInterceptors,setRaidTarget,raidLossGroups,advanceRaid} from './raids.js';
import {scramblePlan,scrambleRows} from './scramble.js';
import {aboard,cargoSources,landingRoutes,escortOptions,queueLanding,landingSeaBattle,landingWait} from './assault.js';
import {reverseCapitalPayments} from './occupation.js';
import {countryInSentence,usIncomeChoice,declarationTargets,declarationDetails} from './politics.js';
import {rollBonds,bondsPending,splitBonds,incomeAmount,rollConvoys,collectIncome,confirmPoliticalChoice,restoreChineseStatement} from './income.js';
import {beginMobilization,mobilizationPlan,placementOptions,finishMobilization,launchPlan,reviseLaunches} from './mobilize.js';
import {beginNoncombat,noncombatPosition,noncombatRoutes} from './noncombat.js';
import {asPassages,orderPassages,samePassages} from './movement.js';
import {ordersPanelKey,reducedMotion} from './preferences.js';
import {neutralKey,strictKey,allianceOf,hostileNeutral} from './neutral-rules.js';
import {unitPrice,globalKey,loadGlobalBoard,saveGlobalPosition,purchaseGroups,spendingEconomies,purchasePlan,eligibleShipRepairs,changePurchase,changeFacilityOrder,confirmPurchase,openingAddress,seasonForRound,nextPower,globalUnits,boardUnitType,isFacility,globalPowers,ownerNames,nationalArmies} from './global-game.js';
import {combatTech,frenchReinforcements,frenchReinforcementCost,changeFrenchDraft,placeFrenchAward,places,stats,types,exercises,adjectives,newGame,count,describe,available,plan,commit,chooseBattle,currentBattle,mobileTypes,aircraft,targetsFor,movementFor,flightRecoveries,defendingRows,openingFireKind,rollOpening,casualtyLimits,retreatSites,rollAttack,rollDefense,casualties,retreat,theaterVictoryCities} from './rules.js';
import {drawFormationNames} from './formation-names.js';
import {atlas,styleFor} from './map.js';
const $=id=>document.getElementById(id);
const roomCode=location.hash.match(/^#room\/([A-F0-9]{10})$/)?.[1];
const roomSeat=roomCode&&lanSeats()[roomCode];
if(roomCode&&!roomSeat){location.replace('#join/'+roomCode);throw Error('Join this room to open the board.');}
let roomState=roomCode?await lanRequest('rooms/'+roomCode,roomSeat.token):null;
if(roomCode&&!roomState.match){location.replace('#lobby/'+roomCode);throw Error('Waiting for both players.');}
let roomBusy=false,roomPolling=false,roomOnline=true;
const isGlobal=!!roomCode||location.hash==='#global';
const exerciseId=isGlobal?'global':location.hash.slice('#exercise/'.length);
const globalBoard=isGlobal?await loadGlobalBoard(roomState?.match):null;
if(globalBoard)restoreChineseStatement(globalBoard.match);
let lastGlobalSave=isGlobal&&!roomCode?localStorage.getItem(globalKey):null;
const key=isGlobal?globalKey:exerciseId==='west'?'wartable.western-front.v1':'wartable.exercise.'+exerciseId+'.v1';
const exercise=exercises[exerciseId],{attacker,defender}=exercise;
const exercisePlaces=Object.fromEntries(Object.keys(exercise.forces).map(id=>[id,places[id]]));
const newLayoutSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
let layoutSeed=newLayoutSeed();
const freshUI=()=>({from:null,to:null,stack:null,quantity:1,units:{inf:0,tank:0},losses:{inf:0,tank:0}});
let s=isGlobal?structuredClone(globalBoard.game):newGame(exerciseId),ui=freshUI(),view=null,draw=()=>{},message='';
try{
  const saved=isGlobal?globalBoard.match.combat:JSON.parse(localStorage.getItem(key)||'null');
  if(saved?.game?.version===1&&(saved.game.exercise||'west')===exerciseId){s=saved.game;ui={...freshUI(),...saved.ui};view=saved.view;layoutSeed=saved.layoutSeed??0;}
}catch{message='The saved exercise could not be read. A new exercise is open.';}
const inResearch=()=>globalBoard?.match.phase==='research';
const finished=()=>globalBoard?.match.phase==='victory';
const inPurchase=()=>globalBoard?.match.phase==='purchase';
const inBriefing=()=>globalBoard?.match.phase==='briefing';
const roomSettingsKey=roomCode?'wartable.lan.settings.'+roomCode:'';
const roomReportKey=roomCode?'wartable.lan.war-status.'+roomCode:'';
const roomViewKey=roomCode?'wartable.lan.view.'+roomCode+'.'+globalBoard.match.round+'.'+s.power:'';
if(roomCode)try{view=JSON.parse(sessionStorage.getItem(roomViewKey))||null;}catch{}
view??=globalBoard?.openingView??null;
function nameFormations(){
  if(s.formationNames)return;
  const areas={...exercisePlaces};
  if(isGlobal){
    // Guest formations retain their own nation's designations in allied territory.
    for(const [id,stacks] of Object.entries(s.pieces)){
      for(const [p,t,n] of stacks){
        const nation=ownerNames[p]||p;
        if(n&&types.includes(t)&&nation!==places[id].owner)areas[id+'/'+nation]={name:places[id].name,owner:nation};
      }
    }
  }
  s.formationNames=drawFormationNames(areas);
}
nameFormations();
function save(){
  try{
    if(roomCode){if(view)sessionStorage.setItem(roomViewKey,JSON.stringify(view));return;}
    const snapshot={game:s,ui,view,layoutSeed};
    if(isGlobal){
      if(localStorage.getItem(key)!==lastGlobalSave){location.reload();return;}
      const match=globalBoard.match;
      if(!finished()&&!inResearch()&&!inBriefing()&&!inPurchase()&&s.phase!=='income'){
        saveGlobalPosition(match,s);
        match.phase=s.phase==='plan'?'combatMove':s.phase==='combat'?'conductCombat':s.phase==='noncombat'?'noncombatMove':s.phase==='mobilize'?'mobilize':'combatReview';
      }
      match.combat=snapshot;
      const serialized=JSON.stringify(match);
      localStorage.setItem(key,serialized);lastGlobalSave=serialized;
    }else localStorage.setItem(key,JSON.stringify(snapshot));
  }
  catch{$('storage').textContent='Saving unavailable';}
}
function selectOrigin(id){delete ui.raidMode;delete ui.raidTo;delete ui.raidIndex;delete ui.editLanding;delete ui.assault;delete ui.landingIndex;delete ui.via;delete ui.passageSteps;delete ui.routeTo;delete ui.twoSpace;ui.from=id;ui.to=null;ui.stack=null;delete ui.inspect;delete ui.inspectedType;delete ui.inspectedNation;delete ui.inspectedOrigin;message='';}
function selectStack(id,type){
  if(ui.from===id && ui.stack===type){
    ui=freshUI();
    return;
  }
  const remaining=available(s,id)[type];
  if(!remaining)throw new Error('This stack is already allocated.');
  selectOrigin(id);
  ui.stack=type;ui.quantity=remaining;
}
let currentSearch=null;
function stackSearch(){
  if(!isGlobal||!ui.stack)return null;
  const key=[ui.from,ui.stack,ui.quantity].join('/');
  if(currentSearch?.key!==key||currentSearch.orders!==s.orders){
    const search=movementFor(s,ui.from,ui.stack,ui.quantity);
    currentSearch={key,orders:s.orders,search,all:search.destinations(),multi:search.destinations(true)};
  }
  return currentSearch;
}
function moveChoices(){
  if(!ui.stack)return [];
  if(ui.assault)return ui.assault.to?[]:[...landingChoices().keys()];
  const result=stackSearch();
  if(!result)return targetsFor(s,ui.from,ui.stack);
  if(ui.routeTo){
    const prefix=ui.passageSteps||[];
    const choices=result.search.passagesTo(ui.routeTo,prefix);
    if(prefix.length&&result.search.legal(ui.routeTo,prefix))choices.unshift(ui.routeTo);
    return choices;
  }
  const choices=ui.twoSpace?result.multi:result.all.filter(id=>id!==ui.from);
  return ui.raidMode?choices.filter(id=>raidTargets(s,id,ui.stack).length):choices;
}
function addStackOrder(to,path=[]){
  if(ui.raidMode){
    ui.raidTo=to;ui.via=path;delete ui.routeTo;
    if(ui.stack==='fighter')queueRaidSortie('escort');
    return;
  }
  const prior=s.orders.find(o=>!o.drop&&!o.raid&&!o.landing&&o.from===ui.from&&o.to===to&&samePassages(o,path));
  const units={...prior?.units};
  units[ui.stack]=(units[ui.stack]||0)+ui.quantity;
  if(ui.stack==='mech_infantry'&&!combatTech(s,'mechanized')&&path.length&&exercise.movement.spaces[path[0]].blitz)
    units.tank=Math.max(units.tank||0,units.mech_infantry);
  if(roomSend('plan',{from:ui.from,to,units,path}))return;
  plan(s,ui.from,to,units,path);
  ui=freshUI();
}
function queueRaidSortie(target){
  const draft={...s,orders:s.orders.filter((_,i)=>i!==ui.raidIndex)};
  const prior=draft.orders.find(o=>o.raid===target&&o.units[ui.stack]&&o.from===ui.from&&o.to===ui.raidTo&&samePassages(o,ui.via));
  const n=ui.quantity+(prior?.units[ui.stack]||0);
  if(roomSend('plan',{from:ui.from,to:ui.raidTo,units:{[ui.stack]:n},path:ui.via,raid:target,replace:ui.raidIndex}))return;
  plan(draft,ui.from,ui.raidTo,{[ui.stack]:n},ui.via,target);
  s.orders=draft.orders;ui=freshUI();
}
function selectTarget(id){
  if(ui.assault){pickLandingCoast(id);return;}
  if(!moveChoices().includes(id)){
    if(isGlobal){
      const match=globalBoard.match,owner=match.board[places[id].name]?.owner;
      const target=owner==='UK_Pacific'||match.power==='Japanese'&&['ANZAC','Dutch'].includes(owner)?'British':owner;
      if(declarationTargets(match).includes(target))throw Error('At peace with '+countryInSentence(target)+'. Choose Declare war to review this decision first.');
    }
    throw new Error('Choose a highlighted space for this move.');
  }
  const search=stackSearch()?.search;
  if(ui.routeTo){
    const prefix=ui.passageSteps||[];
    if(id===ui.routeTo){addStackOrder(id,prefix);return;}
    const path=[...prefix,id];
    if(search.legal(ui.routeTo,path)&&!search.passagesTo(ui.routeTo,path).length)addStackOrder(ui.routeTo,path);
    else ui.passageSteps=path;
    return;
  }
  if(search&&(ui.twoSpace||!search.legal(id))){
    ui.routeTo=id;ui.passageSteps=[];return;
  }
  addStackOrder(id);
}
function pick(id,type,origin,nation){
  if(inResearch()||!roomCanAct())return;
  if(s.frenchAward?.status==='pending'||ui.assault?.to||ui.raidTo||ui.raidResult)return;
  if(!id){run(()=>{ui=freshUI();});return;}
  if(finished()||inBriefing()||inPurchase()||s.phase==='income'){
    run(()=>{
      const deselect=ui.inspect===id&&type===ui.inspectedType&&nation===ui.inspectedNation;
      ui={...freshUI(),wallet:ui.wallet,buyGroup:ui.buyGroup};
      if(!deselect)Object.assign(ui,{inspect:id,inspectedType:type,inspectedNation:nation,inspectedOrigin:origin});
    });
    return;
  }
  if(s.phase==='mobilize'){
    run(()=>{
      if(ui.reserve){choosePlacementSite(id);return;}
      ui.inspect=ui.inspect===id?null:id;
    });
    return;
  }
  if(s.phase==='noncombat'){
    run(()=>{
      if(ui.stack&&noncombatRoutes(redeployment(),selectedNoncombatOrder()).has(id)){queueRedeployment(id);return;}
      if(type&&nation===attacker&&redeployment().unused[id]?.[type]>0){selectRedeployment(id,type);return;}
      ui={...freshUI(),inspect:ui.inspect===id?null:id};
    });
    return;
  }
  if(s.phase==='plan'){run(()=>{
    if(ui.stack&&moveChoices().includes(id)){selectTarget(id);return;}
    if(!type&&(ui.to||ui.inspect||ui.from)===id){ui=freshUI();return;}
    if(isGlobal&&ui.inspect===id&&type&&type===ui.inspectedType&&nation===ui.inspectedNation){ui=freshUI();return;}
    if(type&&!origin&&mobileTypes.includes(type)&&(isGlobal?nation===attacker:s.owners[id]===attacker))selectStack(id,type);
    else if(ui.stack&&id!==ui.from)selectTarget(id);
    else if(isGlobal&&type){
      ui=freshUI();ui.inspect=id;ui.inspectedType=type;ui.inspectedNation=nation;ui.inspectedOrigin=origin;
    }
    else if(s.owners[id]===attacker){selectOrigin(id);if(isGlobal)ui.inspect=id;}
    else if(ui.stack)selectTarget(id);
    else if(isGlobal){ui=freshUI();ui.inspect=id;ui.inspectedType=type;ui.inspectedNation=nation;ui.inspectedOrigin=origin;}
    else{
      ui.inspect=id;
      if(type)message=s.formationNames[origin||id][type]+' · '+stats[type].name+' · '+s.owners[origin||id];
    }
  });}
  else if(s.phase==='review')run(()=>{
    ui.inspect=ui.inspect===id?null:id;

  });
  else if(s.phase==='combat'&&pendingRaids(s).length){
    if(!s.raidDefensePending&&!s.activeRaid&&pendingRaids(s).some(r=>r.to===id))run(()=>roomSend('raid-battle',{to:id})||chooseRaid(s,id));
  }
  else if(s.phase==='combat'&&!s.active&&s.battles.some(b=>b.to===id&&!b.resolved))run(()=>roomSend('battle',{to:id})||chooseBattle(s,id));
}
function run(fn){
  message='';
  try{fn();save();}catch(e){message=e.message;}
  render();
}
function btn(text,act,cls='secondary',extra=''){return '<button class="'+cls+'" data-act="'+act+'" '+extra+'>'+text+'</button>';}
function opt(id,label,sub,code,act,selected=false){
  return '<button class="option '+(selected?'active':'')+'" data-act="'+act+'" data-id="'+id+'"><span class="unitcode" aria-hidden="true">'+code+'</span><span><strong>'+label+'</strong><small>'+sub+'</small></span><span class="end" aria-hidden="true">›</span></button>';
}
function title(t,sub){return '<h2>'+t+'</h2><p class="hint">'+sub+'</p>';}
function block(t){return '<div class="block-title">'+t+'</div>';}
function combatColors(nation){
  const palette=styleFor(nation);
  return 'style="--combat-ink:'+palette.counter+';--combat-paper:'+palette.paper+'"';
}
function unitCounter(type,amount,nation,description){
  const name=stats[type]?.name||globalUnits[type]?.[0]||type;
  if(isFacility(type)){
    return '<span class="counter-face facility" role="img" aria-label="'+esc(name)+'" title="'+esc(name)+'"><svg viewBox="0 0 24 14" aria-hidden="true"><use href="#unit-'+esc(type)+'" width="24" height="14"/></svg></span>';
  }
  const label=description||(amount===undefined?name:amount+' '+(type==='tank'&&amount!==1?'tanks':name.toLowerCase()));
  return '<span class="counter-face" data-nation="'+esc(nation||'')+'" '+combatColors(nation)+' role="img" aria-label="'+esc(label)+'" title="'+esc(label)+'"><svg class="symbol" viewBox="0 0 16 12" aria-hidden="true"><use href="#unit-'+esc(type)+'" width="16" height="12"/></svg>'+
    (amount===undefined?'':'<b>'+amount+'</b>')+'</span>';
}
function defenseCounters(type,strengths){
  return Object.entries(strengths).filter(([,n])=>n>0).map(([nation,n])=>
    unitCounter(type,n,nation,stats[type].name+' · '+nation+' × '+n)).join(' ');
}
function unitLine(units,nation){
  return Object.keys(units).filter(k=>units[k]>0).map(k=>unitCounter(k,units[k],nation)).join(' ')||'no units';
}
// The local journal stores sentences. Render counts in existing saved reviews as counters too.
function reviewDetail(detail,attacking=attacker,heldBy){
  if(detail.includes(' held with ')){
    if(!heldBy)return esc(detail);
    return esc(detail.split(' held with ')[0])+' held with '+Object.entries(nationalArmies(heldBy)).map(([nation,units])=>
      esc(nation)+' '+unitLine(units,nation)).join(' · ');
  }
  return detail.split('; ').map(clause=>{
    // Historic records identify losses by country within each clause.
    const nation=/^(?:Losses — )?([^:]+): /.exec(clause)?.[1]||attacking;
    return esc(clause).replace(/\b(\d+) (infantry|tanks?)\b/g,(_,n,name)=>unitCounter(name==='infantry'?'inf':'tank',Number(n),nation));
  }).join('; ');
}
const diePips=[[],[5],[1,9],[1,5,9],[1,3,7,9],[1,3,5,7,9],[1,3,4,6,7,9]];
function dieFace(d,face,stage,nation){
  const label=nation+' '+stats[d.type].name+(d.rolls&&stage==='marked'?' ('+d.rolls.join(' and ')+', kept '+face+')':'')+(stage==='rolling'?' rolling':' rolled '+face+(stage==='marked'?', '+(d.hit?'hit':'miss'):''));
  const pips=diePips[face].map(pos=>'<i style="grid-area:'+Math.ceil(pos/3)+' / '+((pos-1)%3+1)+'"></i>').join('');
  return '<span role="img" aria-label="'+esc(label)+'" title="'+esc(label)+'" '+combatColors(nation)+' class="die '+(stage==='marked'&&d.hit?'hit':'miss')+'">'+pips+'</span>';
}
function stepper(kind,values,limits,keys=types,min=0){
  return keys.map(k=>'<div class="stepper"><span>'+unitCounter(k,undefined,attacker)+'</span><button aria-label="Remove one '+stats[k].name+'" data-act="'+kind+'" data-k="'+k+'" data-n="-1" '+((values[k]||0)<=min?'disabled':'')+'>−</button><output>'+ (values[k]||0) +'</output><button aria-label="Add one '+stats[k].name+'" data-act="'+kind+'" data-k="'+k+'" data-n="1" '+((values[k]||0)>=(limits[k]||0)?'disabled':'')+'>+</button></div>').join('');
}
function armiesAt(id,combatOnly=false){
  const stacks=(s.phase==='noncombat'?redeployment():s.phase==='mobilize'?reserves().game:s).pieces?.[id]||[];
  if(combatOnly)return nationalArmies(defendingRows(s,id));
  return nationalArmies(s.scrambles&&places[id].water?stacks.concat(scrambleRows(s,id)):stacks);
}
function targetUnits(id){
  if(!s.pieces)return unitLine(s.units[id],s.owners[id]);
  return Object.entries(armiesAt(id,true)).map(([nation,units])=>esc(nation)+' '+unitLine(units,nation)).join(' · ')||'no units';
}
function boardGarrison(id){
  const forces=[],facilities=new Set();
  for(const [nation,army] of Object.entries(armiesAt(id))){
    const units={};
    for(const [type,n] of Object.entries(army)){
      if(isFacility(type))facilities.add(type);
      else units[type]=n;
    }
    if(Object.keys(units).length)forces.push(block(esc(nation))+unitLine(units,nation));
  }
  if(facilities.size)forces.push(block('Facilities')+[...facilities].map(type=>unitCounter(type)+' '+esc(raidFacilityNames[type]||type)+
    (facilityHits(s,id,type)?' · '+facilityHits(s,id,type)+' damage':'')).join('<br>'));
  return forces.join('')||'<p class="hint">No units present.</p>';
}
function scrambleNotice(flights,forecast=false){
  const zones=new Map();
  for(const f of flights){
    if(!f.remaining||f.returning)continue;
    if(!zones.has(f.zone))zones.set(f.zone,[]);
    zones.get(f.zone).push(esc(ownerNames[f.power]||f.power)+' · '+unitCounter(f.type,f.remaining,ownerNames[f.power])+' '+esc(stats[f.type].name.toLowerCase())+' from '+esc(places[f.from].name));
  }
  return [...zones].map(([zone,lines])=>'<div class="review-item"><strong>'+(forecast?'Expected scramble':'Scrambled defenders')+
    ' · '+esc(places[zone].name)+'</strong><p>'+lines.join('<br>')+'</p></div>').join('');
}
function plannedAttacks(){
  const destinations=new Map();
  const landings=isGlobal?flightRecoveries(s,s.orders):null;
  s.orders.forEach((order,index)=>{
    if(!destinations.has(order.to))destinations.set(order.to,[]);
    const mission=order.drop?'Paratroopers · ':order.raid?(order.raid==='escort'?'Escort':'Raid · '+raidFacilityNames[order.raid])+' · ':'';
    const origin=order.landing?'Amphibious assault · '+places[order.landing.path.at(-1)].name:mission+[order.from,...orderPassages(order)].map(id=>places[id].name).join(' → ');
    const spent=orderPassages(order).length+1;
    const flights=aircraft.filter(t=>order.units[t]>0).map(type=>{
      const range=exercise.movement.allowance(order.from,type);
      const sites=[...new Set(landings?.get(order)?.[type])].map(id=>places[id].name);
      const recovery=sites.length?'Land in '+sites.join(' / '):'No legal landing available';
      return stats[type].name+' · '+spent+' of '+range+' to combat · '+recovery;
    });
    const label='Edit move from '+origin+' into '+places[order.to].name+', '+describe(order.units);
    destinations.get(order.to).push('<button class="origin-order" data-act="edit" data-id="'+index+'" aria-label="'+esc([label,...flights].join('. '))+'">'+
      '<span>'+esc(origin)+flights.map(line=>'<small class="flight-budget">'+esc(line)+'</small>').join('')+'</span><span>'+unitLine(order.units,attacker)+'</span>'+
      '<span class="end" aria-hidden="true">›</span></button>');
  });
  let html=block('Planned attacks · '+destinations.size);
  for(const [to,rows] of destinations){
    html+='<section class="planned-target"><strong>'+places[to].name+'</strong>'+rows.join('')+'</section>';
  }
  return html+(isGlobal?scrambleNotice(scramblePlan(s),true):'');
}
function inspectionPanel(backLabel){
  const id=ui.inspect,place=places[id];
  const origin=ui.inspectedOrigin||id,nation=ui.inspectedNation||s.owners[id];
  const name=(ui.inspectedType&&s.formationNames[nation===places[origin].owner?origin:origin+'/'+nation]?.[ui.inspectedType])||
    (ui.inspectedType?(stats[ui.inspectedType]?.name||globalUnits[ui.inspectedType]?.[0]):place.name);
  const status=neutralKey(s.owners[id]);
  let note='';
  if(place.blocked)note='Units cannot enter, cross, or occupy this terrain.';
  else if(strictKey(status))note='An invasion brings the remaining eligible strict neutrals into the opposing camp.';
  else if(status?.startsWith('Joined_'))note='Uncontrolled. The surviving garrison stays here until a friendly power takes control.';
  else if(status)note=hostileNeutral(s.power,status)?'The standing army defends this territory against an invasion.':'An eligible friendly land unit can enter during noncombat movement to take control and mobilize the standing army.';
  return title(esc(name||place.name),place.blocked?'Impassable terrain':esc((ui.inspectedNation||s.owners[id])+' · '+place.name))+
    (note?'<p class="hint">'+note+'</p>':'')+(place.blocked?'':boardGarrison(id))+btn(backLabel,'clear');
}
function warEntry(match){
  const declarations=(match.combat?.game.record||[]).filter(e=>e.declaration);
  const receipt=declarations.map(e=>'<p class="war-receipt">'+esc(e.title)+'</p>').join('');
  if(!declarationTargets(match).length)return receipt;
  return receipt+btn('Declare war…','war-open','secondary war-open');
}
function chooseWarTargets(){
  const match=globalBoard.match,targets=declarationTargets(match);
  if(!targets.length)return;
  showDialog('Declare war', '<fieldset class="war-targets"><legend>Who will '+esc(countryInSentence(match.power))+' declare war on?</legend>'+
    targets.map(t=>'<label><input type="checkbox" value="'+t+'"> '+esc(match.power==='Japanese'&&t==='British'?'United Kingdom and ANZAC':globalPowers[t])+'</label>').join('')+
    '</fieldset><div class="war-actions">'+btn('Cancel','war-cancel')+btn('Review declaration','war-review','primary','disabled')+'</div>');
}
function reviewWarTargets(){
  const targets=[...$('dialogBody').querySelectorAll('.war-targets input:checked')].map(el=>el.value);
  const {names,title:declaration,effects}=declarationDetails(globalBoard.match,targets);
  showDialog('Confirm declaration of war','<div class="war-warning"><h3>'+esc(declaration)+'</h3>'+
    '<p>This declaration takes effect immediately and is permanent for this match.</p>'+
    (effects.length?'<ul>'+effects.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>':'')+'</div>'+
    '<div class="war-actions">'+btn('Cancel','war-cancel')+'<button id="issueWar" class="primary hold-to-confirm">Hold to declare war on '+esc(names)+'</button></div>');
  $('dialogBody').querySelector('[data-act="war-cancel"]').focus();
  bindHold($('issueWar'),()=>advanceEconomy('politics',targets));
}
let landingCache;
function landingPosition(){
  return ui.editLanding==null?s:{...s,orders:s.orders.filter((_,i)=>i!==ui.editLanding)};
}
function landingChoices(){
  if(!landingCache||landingCache.from!==ui.from||landingCache.orders!==s.orders||landingCache.edit!==ui.editLanding)
    landingCache={from:ui.from,orders:s.orders,edit:ui.editLanding,routes:landingRoutes(landingPosition(),ui.from)};
  return landingCache.routes;
}
function pickLandingCoast(to){
  const paths=landingChoices().get(to);
  if(!paths)throw Error('Choose a highlighted coast.');
  ui.assault.to=to;setLandingPath(0);
}
function freeManifests(){
  const g=landingPosition();return aboard(g,ui.from).filter(h=>!g.orders.some(o=>o.landing?.load===h.id));
}
function setLandingPath(index){
  const draft=ui.assault;
  draft.path=landingChoices().get(draft.to)[index];draft.cargo=[];draft.escorts=[];draft.engage=false;
  const loads=freeManifests();
  draft.load=available(landingPosition(),ui.from).transport>loads.length?null:loads[0]?.id;
}
function landingUnits(){
  const units={...freeManifests().find(h=>h.id===ui.assault.load)?.units};
  for(const {type,n} of ui.assault.cargo)units[type]=(units[type]||0)+n;
  return units;
}
function landingPanel(){
  const d=ui.assault,routes=landingChoices();
  if(!d.to)return title('Amphibious assault','Transport in '+places[ui.from].name+'. Choose a highlighted coast.')+
    [...routes].map(([id])=>opt(id,places[id].name,targetUnits(id),'↗','land-coast')).join('')+btn('Back to transport','land-back');
  const zone=d.path.at(-1),options=routes.get(d.to),units=landingUnits(),used=count(units);
  const position=landingPosition();
  const expected=scramblePlan(position,[...position.orders,{to:d.to,landing:{path:d.path}}]).filter(f=>f.zone===zone);
  const fight=d.engage||landingSeaBattle(position,zone);
  const ignoredSub=s.pieces[zone].some(([p,t,n])=>exercise.enemies.includes(p)&&t==='submarine'&&n);
  let html=title('Land in '+places[d.to].name,'Transport from '+places[ui.from].name+' · Offload in '+places[zone].name)+
    '<p class="hint">'+(fight?'Resolve the sea battle before unloading.':expected.length?'Defending aircraft are expected offshore. Resolve that battle before unloading. Ships that fight there cannot bombard.':'Cruisers and battleships can bombard once, up to one ship per landing unit.')+
    (ignoredSub&&!fight?' An enemy submarine is here. A friendly warship must escort this transport.':'')+'</p>'+scrambleNotice(expected,true);
  if(exercise.movement.spaces[zone].enemyFleet&&!landingSeaBattle(landingPosition(),zone))
    html+=btn(d.engage?'Ignore enemy submarines and transports':'Engage enemy submarines and transports','land-engage');
  if(options.length>1)html+='<label>Sea route <select data-landing-route>'+options.map((path,i)=>
    '<option value="'+i+'" '+(path.join('/')===d.path.join('/')?'selected':'')+'>'+path.map(id=>parseInt(places[id].name)).join(' → ')+'</option>').join('')+'</select></label>';
  const loads=freeManifests();
  if(loads.length)html+='<label>Transport <select data-landing-load>'+
    (available(landingPosition(),ui.from).transport>loads.length?'<option value="">Empty transport</option>':'')+
    loads.map(h=>'<option value="'+esc(h.id)+'" '+(d.load===h.id?'selected':'')+'>'+esc(describe(h.units))+' aboard</option>').join('')+'</select></label>';
  html+=block('Cargo · '+used+' of 2 spaces')+'<p class="hint">One land unit plus one additional infantry.</p>';
  const onboard=loads.find(h=>h.id===d.load);
  if(onboard)html+='<p>Already aboard · '+esc(describe(onboard.units))+'</p>';
  for(const {from,type,n} of cargoSources(landingPosition(),d.path)){
    const qty=d.cargo.find(row=>row.type===type&&row.from===from)?.n||0;
    html+=orderRow({unit:type,name:stats[type].name,caption:places[from].name,quantity:qty,
      plus:qty<n&&used<2&&(type==='inf'||used===(units.inf||0)),facility:from,operation:'land-cargo'});
  }
  const support=escortOptions(landingPosition(),zone);
  if(support.length){
    html+='<details '+(d.showEscort?'open':'')+' id="landingEscorts"><summary>Escorts and bombardment'+(d.escorts.length?' · '+d.escorts.reduce((n,r)=>n+r.n,0):'')+'</summary>';
    for(const {from,type,n} of support){
      const qty=d.escorts.find(r=>r.from===from&&r.type===type)?.n||0;
      html+=orderRow({unit:type,name:stats[type].name,caption:places[from].name,quantity:qty,plus:qty<n,facility:from,operation:'land-escort'});
    }
    html+='</details>';
  }
  $('action').innerHTML=btn((ui.editLanding==null?'Queue landing in ':'Update landing in ')+places[d.to].name,'land-queue','primary',used?'':'disabled');
  return html+btn('Choose another coast','land-another')+btn('Cancel','clear');
}

function raidDraftPanel(){
  const editing=ui.raidIndex!=null,escort=ui.stack==='fighter',to=ui.raidTo;
  const position=editing?{...s,orders:s.orders.filter((_,i)=>i!==ui.raidIndex)}:s;
  let html=title((escort?'Escort raid in ':'Raid facilities in ')+places[to].name,
    stats[ui.stack].name+' · '+[ui.from,...asPassages(ui.via),to].map(id=>places[id].name).join(' → '))+
    stepper('raid-quantity',{[ui.stack]:ui.quantity},available(position,ui.from),[ui.stack],1);
  if(!escort)html+=block(editing?'Choose facility to save sortie':'Choose facility to queue sortie');
  for(const target of raidTargets(position,to,ui.stack)){
    if(target==='escort'){html+=btn('Save escort','raid-assign','primary','data-id="escort"');continue;}
    html+=opt(target,raidFacilityNames[target],facilityHits(s,to,target)+' of '+damageLimit[target]+' damage'+
      (s.orders[ui.raidIndex]?.raid===target?' · Current target':''),'↗','raid-assign');
  }
  if(editing)html+=btn('Cancel sortie','raid-remove','danger');
  return html+btn('Back to orders','clear');
}
function planPanel(){
  if(ui.dropIndex!=null){
    const o=s.orders[ui.dropIndex];
    return title('Paratroopers',places[o.from].name+' → '+places[o.to].name)+unitLine(o.units,attacker)+btn('Cancel drop','remove-drop','danger')+btn('Back to orders','clear');
  }
  if(ui.raidTo)return raidDraftPanel();
  if(ui.assault)return landingPanel();
  if(ui.landingIndex!=null){
    const o=s.orders[ui.landingIndex];
    const escorts=o.landing.escorts.map(r=>r.n+' × '+stats[r.type].name+' from '+places[r.from].name);
    return title('Amphibious assault',places[o.from].name+' → '+places[o.to].name)+unitLine(o.units,attacker)+'<p>Offload in '+places[o.landing.path.at(-1)].name+'</p>'+
      (escorts.length?'<p>Escorts · '+esc(escorts.join(', '))+'</p>':'')+btn('Revise landing','land-edit')+btn('Cancel landing','land-remove','danger')+btn('Back to orders','clear');
  }
  let html=title('Combat move',isGlobal?'Tap a unit stack to plan an attack. Select a transport for an amphibious assault.':'Tap a unit stack on the map to plan an attack.');
  if(ui.to){
    const existing=s.orders.some(o=>!o.drop&&!o.raid&&!o.landing&&o.from===ui.from&&o.to===ui.to&&samePassages(o,ui.via));
    const limit=available(s,ui.from,ui.to,ui.via);
    const path=asPassages(ui.via);
    const editing={...s,orders:s.orders.filter(o=>o.drop||o.raid||o.landing||o.from!==ui.from||o.to!==ui.to||!samePassages(o,path))};
    const editable=mobileTypes.filter(t=>limit[t]>0&&(isGlobal?movementFor(editing,ui.from,t).legal(ui.to,path):targetsFor(s,ui.from,t).includes(ui.to)));
    html=title(path.length?'Edit route':'Plan attack',[ui.from,...path,ui.to].map(id=>places[id].name).join(' → '))+block('Assign units')+stepper('assign',ui.units,limit,editable)+
    '<div class="actions">'+btn('Back','back')+btn(existing?'Update order':'Add order','add','primary',count(ui.units)?'':'disabled')+'</div>';
    if(existing)html+=btn('Cancel this order','remove','danger','style="margin-top:8px"');
  }else if(ui.routeTo){
    const path=ui.passageSteps||[];
    html=title('Choose passage to '+places[ui.routeTo].name,[ui.from,...path].map(id=>places[id].name).join(' → '))+
      moveChoices().map(id=>{
        if(id===ui.routeTo)return opt(id,'Finish at '+places[id].name,'Complete this route','↗','target');
        const paired=ui.stack==='mech_infantry'&&!combatTech(s,'mechanized')&&exercise.movement.spaces[id].blitz;
        const note=paired?'Blitz with one tank per mechanized infantry':'Passage '+(path.length+1);
        return opt(id,'Via '+places[id].name,note,'↗','target');
      }).join('')+btn(path.length?'Back one passage':'Back to destinations','route-back');
  }else if(ui.stack){
    const range=stackSearch()?.search.range;
    const reach=range?' · '+range+(aircraft.includes(ui.stack)?' total spaces for combat and landing':range===1?' space':' spaces'):'';
    html=title(unitCounter(ui.stack,undefined,attacker)+' '+esc(s.formationNames[ui.from+'/'+attacker]?.[ui.stack]||s.formationNames[ui.from]?.[ui.stack]||stats[ui.stack].name),stats[ui.stack].name+' · '+places[ui.from].name+reach)+block('Units to move')+
      (isGlobal&&ui.stack==='transport'?btn('Amphibious assault','land-start','primary',landingChoices().size?'':'disabled'):'')+
      (isGlobal&&aircraft.includes(ui.stack)?btn(ui.raidMode?'Return to ordinary attack':ui.stack==='fighter'?'Escort a raid':'Facility raid','raid-mode',ui.raidMode?'secondary':'primary',
        ui.raidMode||stackSearch().all.some(id=>raidTargets(s,id,ui.stack).length)?'':'disabled'):'')+
      stepper('quantity',{[ui.stack]:ui.quantity},available(s,ui.from),[ui.stack],1)+
      (stackSearch()?.multi.length?btn(ui.twoSpace?'Show all moves':'Choose a multi-space route','two-space'):'')+
      block(ui.raidMode?(ui.stack==='fighter'?'Choose a raid to escort':'Choose a territory to raid'):moveChoices().length?'Tap destination to plan move':'No eligible enemy spaces')+
      moveChoices().map(id=>{
        const routed=ui.twoSpace||isGlobal&&!stackSearch().search.legal(id);
        return opt(id,places[id].name,(routed?'Choose passage · ':'')+(ui.raidMode?raidTargets(s,id,ui.stack).map(t=>raidFacilityNames[t]||'Escort bombers').join(' · '):targetUnits(id)),'↗','target');
      }).join('')+
      '<div class="actions">'+btn('Deselect stack','clear')+'</div>';
  }
  if(isGlobal&&ui.inspect&&!ui.stack&&!ui.to){
    html=inspectionPanel('Back to orders');
  }
  if(!ui.to&&s.orders.length){
    html+=plannedAttacks();
    if(isGlobal&&s.orders.some(o=>strictKey(neutralKey(s.owners[o.to])))){
      html+='<p class="hint">Committing this invasion shifts eligible strict neutrals to the '+(allianceOf(s.power)==='Axis'?'Allied':'Axis')+' side.</p>';
    }
  }
  if(isGlobal&&!ui.to&&!ui.routeTo)html+=warEntry(globalBoard.match);
  if(isGlobal&&!ui.to&&!ui.stack&&!ui.inspect)html+=supportPanel()+carrierLaunchPanel();
  if(!ui.to&&!ui.stack)$('action').innerHTML='<button class="primary hold-to-confirm" id="hold" '+(s.orders.length||isGlobal?'':'disabled')+'>'+(isGlobal&&!s.orders.length&&!s.rocketOrders?.length?'Hold to finish combat moves':'Hold to commit attacks')+'</button>';
  return html;
}
// Older rounds carry powers on individual dice. Exercises use the territorial defender.
function defendingNations(dice,fallback){
  const powers=dice?.defendingPowers||dice?.defense?.map(d=>d.power).filter(Boolean)||[];
  const nations=[...new Set(powers.map(p=>ownerNames[p]||p))];
  return nations.length?nations:fallback;
}
function liveDefenders(b){
  return s.pieces?Object.keys(armiesAt(b.to,true)):[s.owners[b.to]];
}
function groupRolls(rolls,side){
  const groups=new Map();
  for(const die of rolls){
    // Older saved rounds only recorded the unit type and side.
    const threshold=die.threshold??stats[die.type][side];
    if(!groups.has(threshold))groups.set(threshold,[]);
    groups.get(threshold).push(die);
  }
  return [...groups].sort(([a],[b])=>a-b);
}
const hitRange=threshold=>threshold===1?'1':'1–'+threshold;
function rollStacks(group,nations){
  const stacks=new Map();
  for(const die of group){
    const nation=ownerNames[die.power]||die.power||nations[0]||'Defenders';
    const key=die.type+'/'+nation;
    if(!stacks.has(key))stacks.set(key,{type:die.type,nation,rolls:[]});
    stacks.get(key).rolls.push(die);
  }
  return [...stacks.values()].sort((a,b)=>
    stats[a.type].name.localeCompare(stats[b.type].name,'en')||a.nation.localeCompare(b.nation,'en'));
}
function rollDice(ordered,stage,frame){
  return ordered.flatMap(({nation,rolls})=>rolls.map((d,i)=>{
    if(stage==='waiting')return '<span class="die pending" aria-hidden="true"></span>';
    return dieFace(d,stage==='rolling'?1+(frame+i*2)%6:d.face,stage,nation);
  })).join('');
}
function rollTotal(hits,play){
  if(play&&play.index===0&&play.stage!=='marked')return 'Rolling…';
  return hits+' '+(hits===1?'hit':'hits');
}
function rollCard(rolls,side,play,nations){
  const label=side==='defense'?'Defense Rolls':(adjectives[nations[0]]||nations[0])+' attack';
  let hits=0;
  const groups=(play?.groups||groupRolls(rolls,side)).map(([threshold,group],index)=>{
    let stage='marked';
    if(play&&index>=play.index)stage=index===play.index?play.stage:'waiting';
    if(stage==='marked')hits+=group.filter(d=>d.hit).length;
    const ordered=rollStacks(group,nations);
    const counters=ordered.map(({type,nation,rolls})=>
      unitCounter(type,rolls.length,nation,stats[type].name+' · '+nation+' × '+rolls.length)).join('');
    const dice=rollDice(ordered,stage,play?.frame);
    return '<div class="roll-unit" data-threshold="'+threshold+'" data-stage="'+stage+'"><strong>Hits on '+hitRange(threshold)+
      '</strong><div class="roll-counters">'+counters+'</div><div class="dice-row">'+dice+'</div></div>';
  }).join('');
  const total=rollTotal(hits,play);
  return '<section class="roll-card" data-side="'+side+'" '+combatColors(nations.length===1?nations[0]:null)+'><h4>'+label+'<span>'+total+'</span></h4>'+groups+'</section>';
}
function rollsBox(dice,play,attacking,defending){
  if(!dice)return '';
  return ['attack','defense'].filter(side=>dice[side]).map(side=>rollCard(dice[side],side,play?.side===side?play:null,side==='attack'?[attacking]:defending)).join('');
}
// The game has already rolled and saved. Only the presentation is timed.
let playback=null,rollTimer;
function beginRoll(side){
  if(reducedMotion())return;
  const rolls=currentBattle(s).dice[side],groups=groupRolls(rolls,side);
  if(!groups.length)return;
  playback={side,groups,index:0,stage:'rolling',frame:0};
  rollTimer=setTimeout(advanceRoll,100);
}
function endPlayback(){
  clearTimeout(rollTimer);
  playback=null;
}
function advanceRoll(){
  const play=playback;
  if(!play)return;
  let delay=110;
  if(play.stage==='rolling'){
    play.frame++;
    if(play.frame===6){play.stage='settled';delay=300;}
  }else if(play.stage==='settled'){
    play.stage='marked';delay=1000;
  }else{
    if(++play.index===play.groups.length){endPlayback();render();return;}
    play.stage='rolling';play.frame=0;
  }
  const card=$('panel').querySelector('.roll-card[data-side="'+play.side+'"]');
  const battle=currentBattle(s);
  const nations=play.side==='attack'?[attacker]:defendingNations(battle.dice,liveDefenders(battle));
  const [threshold,rolls]=play.groups[play.index];
  const activeGroup=card.querySelector('[data-threshold="'+threshold+'"]');
  activeGroup.dataset.stage=play.stage;
  activeGroup.querySelector('.dice-row').innerHTML=rollDice(rollStacks(rolls,nations),play.stage,play.frame);
  const revealed=play.groups.slice(0,play.index+Number(play.stage==='marked'));
  const totalHits=revealed.reduce((sum,[,group])=>sum+group.filter(d=>d.hit).length,0);
  card.querySelector('h4 span').textContent=rollTotal(totalHits,play);
  if((play.frame===0||play.index===0&&play.frame===1)&&play.stage==='rolling'){
    activeGroup.scrollIntoView({block:'nearest'});
  }
  const hits=rolls.filter(d=>d.hit).length;
  const note=play.stage==='marked'?'Hits on '+hitRange(threshold)+' · '+hits+(hits===1?' hit':' hits'):'Rolling for '+hitRange(threshold)+'…';
  if($('rollStatus').textContent!==note)$('rollStatus').textContent=note;
  rollTimer=setTimeout(advanceRoll,delay);
}
function forceColumns(attack,defense,defendingNation,metric='total',armies=null,attacking=attacker){
  function column(heading,icons,total){
    return '<span class="battle-column"><span class="force-heading">'+heading+'</span>'+
      '<span class="force-strength">'+icons+'<span class="force-total">'+total+' '+metric+'</span></span></span>';
  }
  const defenders=armies&&Object.keys(armies).length?armies:{[defendingNation]:defense};
  const defenseIcons=Object.keys(stats).map(type=>defenseCounters(type,
    Object.fromEntries(Object.entries(defenders).map(([nation,units])=>[nation,units[type]])))).join(' ');
  const attackIcons=Object.keys(attack).filter(k=>attack[k]>0).map(k=>unitCounter(k,attack[k],attacking)).join(' ');
  return column('<small>Attacking</small> <strong>'+esc(attacking)+'</strong>',attackIcons,count(attack))+
    column('<strong>'+(metric==='lost'?'Defense Losses':'Defense Units')+'</strong>',defenseIcons,count(defense));
}
function updateBattleForces(){
  const b=currentBattle(s),header=$('battleForces');
  if(!b){header.replaceChildren();return;}
  header.innerHTML=forceColumns(b.attack,s.units[b.to],s.owners[b.to],'total',isGlobal?armiesAt(b.to,true):null);
}
function cityObjective(territory){
  const city=(exercise.cities||theaterVictoryCities).find(c=>c.territory===(territory==='af'?'fr':territory));
  if(!city)return isGlobal&&places[territory].city?'<span class="objective">◆ Victory city</span>':'';
  return '<span class="objective"><span aria-hidden="true">'+(city.capitalOf?'★':'◆')+'</span> '+city.name+
    ' · Victory city'+(city.capitalOf?' · '+city.capitalOf+'’s capital':'')+'</span>';
}
function battleChoice(b){
  if(b.resolved)return '<div class="review-item"><strong>'+places[b.to].name+'</strong><p>'+reviewDetail(b.result,attacker,b.heldBy)+'</p></div>';
  const waiting=landingWait(s,b);
  if(waiting.length)return '<div class="review-item"><strong>'+esc(places[b.to].name)+'</strong><p>Landing waits for '+waiting.map(id=>esc(places[id].name)).join(', ')+'.</p></div>';
  return '<button class="battle-choice" data-act="battle" data-id="'+b.to+'">'+
    '<span class="battle-choice-title"><strong>'+places[b.to].name+'</strong><span class="end" aria-hidden="true">›</span></span>'+
    cityObjective(b.to)+scrambleNotice((s.scrambles||[]).filter(f=>f.zone===b.to))+'<span class="force-columns">'+forceColumns(b.attack,s.units[b.to],s.owners[b.to],'total',isGlobal?armiesAt(b.to,true):null)+'</span></button>';
}
function raidResultPanel(){
  const r=s.raids.find(raid=>raid.to===ui.raidResult);
  let html=title('Raid result · '+places[r.to].name,r.outcomes?.length?'Facility damage is recorded. Check repair costs in Purchase & Repair.':'All bombers were lost before they could damage a facility.');
  for(const o of r.outcomes||[]){
    const rolls=r.damageDice.filter(d=>d.target===o.target);
    html+='<section class="review-item"><strong>'+unitCounter(o.target)+' '+raidFacilityNames[o.target]+'</strong><p>'+
      rolls.map(d=>stats[d.type].name+' rolled '+(d.rolls?d.rolls.join(' and ')+' · kept ':'')+d.face+(d.type==='bomber'?' + 2':'')).join('<br>')+
      '</p><p>Added '+o.added+' damage · '+o.before+' → <b>'+o.total+' of '+damageLimit[o.target]+'</b></p></section>';
  }
  const lost=r.planes.filter(p=>p.lost).length,defendersLost=r.interceptors.reduce((n,f)=>n+f.assigned-f.remaining,0);
  html+='<p class="hint">Aircraft lost · '+attacker+' '+lost+' · Defenders '+defendersLost+'</p>';
  html+='<details class="review-item"><summary>Raid rolls and losses</summary>'+timeline(s.record.filter(e=>e.raidSite===r.to))+'</details>';
  $('action').innerHTML=btn(s.phase==='review'?'Continue to combat review':'Continue combat','raid-result-close','primary');
  return html;
}
function raidPanel(){
  const raids=pendingRaids(s),r=currentRaid(s);
  if(s.raidDefensePending){
    let html=title('Assign interceptors','Choose how many local fighters will intercept. Fighters already scrambled offshore are unavailable. Interceptors defend only against the raid this turn.');
    for(const raid of raids){
      if(!raid.interceptors.length)continue;
      html+=block(places[raid.to].name)+unitLine(raid.planes.reduce((a,p)=>{a[p.type]=(a[p.type]||0)+1;return a;},{}),attacker);
      for(const f of raid.interceptors)html+='<label class="power-seat">'+esc(ownerNames[f.power]||f.power)+' fighters<select data-interceptor="'+f.power+'" data-place="'+raid.to+'">'+
        Array.from({length:f.n+1},(_,i)=>'<option value="'+i+'" '+(i===f.assigned?'selected':'')+'>'+i+' of '+f.n+'</option>').join('')+'</select></label>';
    }
    $('action').innerHTML=btn('Commit interceptor assignments','confirm-interceptors','primary');return html;
  }
  if(!r)return title('Bombing raids','Resolve each territory’s raid before the other battles.')+
    raids.map(raid=>opt(raid.to,places[raid.to].name,raid.planes.filter(p=>p.type!=='fighter').length+' bombers · '+
      raid.interceptors.reduce((n,f)=>n+f.remaining,0)+' interceptors','↗','raid-battle')).join('');
  const number=r.interceptors.reduce((n,f)=>n+f.remaining,0);
  const name=p=>stats[p.type].name+' from '+places[s.orders[p.order].from].name;
  let html=title('Bombing raid · '+places[r.to].name,r.step==='attack'||r.step==='defense'?'One air battle. Aircraft hit on a 1. Jet fighters hit on 1–2.':
    r.step==='targets'?'Assign each surviving bomber to a facility. Each facility rolls once per bomber targeting it and hits on a 1, or 1–2 with Radar.':
    r.step==='damage'?'Strategic bombers add 2 to their die. Heavy Bombers keep their higher die. Tactical bombers roll one die.':'Choose the attacking aircraft lost.');
  const labels={attack:'Roll raid attack',defense:'Roll interception',targets:'Roll facility fire',damage:'Roll facility damage',airLoss:'Confirm interception losses',aaLoss:'Confirm facility fire losses'};
  let ready=true;
  if(['attack','defense'].includes(r.step)){
    html+=block('Attacking aircraft')+r.planes.map(p=>'<p>'+unitCounter(p.type,1,attacker)+' '+esc(name(p))+'</p>').join('')+block('Defending fighters · '+number);
    html+=r.interceptors.filter(f=>f.remaining).map(f=>unitCounter('fighter',f.remaining,ownerNames[f.power])+' '+esc(ownerNames[f.power])).join(' · ');
  }
  const dieList=dice=>dice.map(d=>dieFace({...d,type:d.type||'fighter',hit:d.face<=(d.threshold||1)},d.face,'marked',d.power?ownerNames[d.power]:attacker)).join(' ');
  if(r.attackDice&&['defense','airLoss'].includes(r.step))html+=block('Attacking rolls')+dieList(r.attackDice);
  if(r.step==='airLoss')html+=block('Interceptor rolls')+dieList(r.defenseDice);
  if(r.step==='targets'){
    for(const [i,p] of r.planes.entries()){
      if(p.lost||p.type==='fighter')continue;
      html+='<label class="power-seat">'+esc(name(p))+'<select data-bomb-target="'+i+'">'+raidTargets(s,r.to,p.type).map(t=>
        '<option '+(t===p.target?'selected':'')+' value="'+t+'">'+raidFacilityNames[t]+' · '+facilityHits(s,r.to,t)+'/'+damageLimit[t]+'</option>').join('')+'</select></label>';
    }
  }
  if(r.aaDice&&['aaLoss','damage'].includes(r.step)){
    for(const target of new Set(r.aaDice.map(d=>d.target)))html+=block(raidFacilityNames[target]+' fire')+
      r.aaDice.filter(d=>d.target===target).map(d=>dieFace({type:'aaGun',hit:d.face<=(d.threshold||1)},d.face,'marked',s.owners[r.to])).join(' ');
  }
  for(const group of raidLossGroups(r)){
    const selected=ui.raidLosses||[],inGroup=i=>!r.planes[i].lost&&(!group.target||r.planes[i].target===group.target);
    const chosen=selected.filter(inGroup).length;
    if(chosen!==group.hits)ready=false;
    html+=block((raidFacilityNames[group.target]||'Air battle')+' · '+chosen+' of '+group.hits+' losses');
    if(group.hits)for(const [i,p] of r.planes.entries())if(inGroup(i))
      html+='<label class="power-seat">'+esc(name(p))+'<input type="checkbox" data-raid-loss="'+i+'" '+(selected.includes(i)?'checked':chosen>=group.hits?'disabled':'')+'></label>';
  }
  if(r.step==='damage')html+=block('Bombers over target')+r.planes.filter(p=>!p.lost&&p.type!=='fighter').map(p=>
    '<p>'+unitCounter(p.type,1,attacker)+' '+esc(raidFacilityNames[p.target])+'</p>').join('');
  $('action').innerHTML=btn(labels[r.step],'raid-step','primary','data-id="'+r.step+'" '+(ready?'':'disabled'));
  return html;
}
function battlePanel(){
  if(rocketsPending(s)&&!s.raidDefensePending&&!s.activeRaid)return title('Rocket attacks','Choose an air base to roll facility damage.')+
    s.rocketOrders.filter(o=>o.face==null).map(o=>opt(o.from,places[o.from].name+' → '+places[o.to].name,raidFacilityNames[o.target],'↗','fire-rocket')).join('');
  if(pendingRaids(s).length)return raidPanel();
  const b=currentBattle(s);
  if(!b){
    return title('Conduct combat','Choose the next battle to resolve.')+block('Battle order')+s.battles.map(battleChoice).join('');
  }
  const dice=b.step==='openingLosses'?b.openingDice:b.step==='regular'?null:b.dice;
  const nations=defendingNations(dice,liveDefenders(b));
  const beach=b.amphibious?'<p class="hint">Amphibious assault · Seaborne troops cannot retreat.'+
    (b.bombard&&b.round<=1?' Offshore bombardment supports the first round.':'')+'</p>':'';
  const info='<h2>'+places[b.to].name+'</h2>'+beach+scrambleNotice((s.scrambles||[]).filter(f=>f.zone===b.to))+block(b.step==='openingLosses'?'Opening fire · round '+b.round:b.round?'Battle round '+b.round:places[b.to].water?'Naval battle':'Land battle')+
    (b.round?'':cityObjective(b.to))+rollsBox(dice,playback,attacker,nations);
  if(playback){
    $('action').innerHTML='<div class="roll-progress" id="rollStatus" role="status">Rolling for '+hitRange(playback.groups[playback.index][0])+'…</div>';
    return info;
  }
  if(b.step==='defense'){
    $('action').innerHTML=btn('Roll defense','defend','primary',combatColors(nations.length===1?nations[0]:null));
    return info+'<p class="hint">All defenders return fire this round, including marked casualties.</p>';
  }
  const assigning=['losses','openingLosses'].includes(b.step);
  if(assigning && !b.hits){
    $('action').innerHTML=btn(b.step==='openingLosses'?'Resolve opening fire':'Resolve round','loss','primary');
    return info+'<p class="hint">'+attacker+' takes no casualties this round.</p>';
  }
  if(assigning){
    const limits=casualtyLimits(s,b),keys=Object.keys(limits);
    const shipNote=keys.some(k=>['carrier','battleship'].includes(k))?' An undamaged carrier or battleship takes two hits to sink.':'';
    for(const k of keys)limits[k]=Math.min(limits[k],(ui.losses[k]||0)+b.hits-count(ui.losses));
    $('action').innerHTML=btn('Confirm casualties','loss','primary',count(ui.losses)===b.hits?'':'disabled');
    let attribution='';
    for(const [type,beach] of Object.entries(b.beachForce||{})){
      const hits=ui.losses[type]||0,min=Math.max(0,hits-(b.attack[type]-beach)),max=Math.min(beach,hits);
      if(max<=min||b.step==='openingLosses'&&type==='inf'&&b.openingDice.defense.some(d=>d.type==='aaGun'))continue;
      const current=ui.beachLoss?.[type]??min;
      attribution+='<label>Seaborne '+esc(stats[type].name.toLowerCase())+' losses <select data-beach-loss="'+type+'">'+
        Array.from({length:max-min+1},(_,i)=>'<option '+(min+i===current?'selected':'')+'>'+String(min+i)+'</option>').join('')+'</select></label>';
    }
    if(ui.losses.transport&&b.boats?.length&&b.attack.transport>1){
      attribution+=block('Transport cargo')+'<p class="hint">Empty transports are taken first by default. Select cargo to take on a lost transport.</p>'+
        b.boats.map(h=>btn((ui.lostBoats?.includes(h.id)?'✓ ':'')+esc(describe(h.units))+(h.coast?' → '+esc(places[h.coast].name):''),'lost-boat','secondary',
          'data-id="'+esc(h.id)+'" '+(!ui.lostBoats?.includes(h.id)&&ui.lostBoats?.length>=ui.losses.transport?'disabled':''))).join('');
    }
    return info+'<h3>Assign hits</h3><p class="hint">Assign '+b.hits+' '+(b.hits===1?'hit':'hits')+' to your force.'+shipNote+'</p>'+stepper('casualty',ui.losses,limits,keys)+attribution;
  }
  const opening=b.step==='regular'?'':openingFireKind(s,b);
  $('action').innerHTML=opening?btn('Roll '+opening.toLowerCase(),'opening-fire','primary'):btn((b.step==='decision'?'Continue · roll ':'Roll ')+adjectives[attacker]+' attack','roll','primary');
  if(b.step==='decision'){
    if(b.beachForce&&count(b.beachForce)&&retreatSites(s,b).length)return info+'<p class="hint">Withdraw the surviving overland troops and aircraft together. The seaborne troops continue fighting.</p>'+retreatSites(s,b).map(id=>btn('Withdraw via '+places[id].name,'retreat','secondary','data-id="'+id+'"')).join('');
    if(!retreatSites(s,b).length)return info+'<p class="hint">'+(b.amphibious?'The landing force must continue fighting.':'No retreat route is available.')+'</p>';
    return info+'<h3>Continue or retreat?</h3><p class="hint">Choose one territory or sea zone from which your force entered this battle.</p>'+retreatSites(s,b).map(id=>btn('Retreat to '+places[id].name,'retreat','secondary','data-id="'+id+'"')).join('');
  }
  return info;
}
// Earlier saved rounds recorded losses as a sentence, without separate unit counts.
function savedRoundLosses(entry){
  if(entry.losses)return entry.losses;
  const sides=/^Losses — [^:]+: (.+); [^:]+: (.+)\.$/.exec(entry.detail);
  if(!sides)return null;
  function readUnits(text){
    const units={inf:0,tank:0};
    for(const [,n,name] of text.matchAll(/(\d+) (infantry|tanks?)\b/g))units[name==='infantry'?'inf':'tank']=Number(n);
    return units;
  }
  return {attack:readUnits(sides[1]),defense:readUnits(sides[2])};
}
function timeline(record=s.record,attacking=attacker){
  return record.map(e=>{
    const heading=esc(e.scramblePower?(ownerNames[e.scramblePower]||e.scramblePower)+' · '+e.title:e.title);
    if(e.frenchUnits)return '<div class="review-item"><strong>'+heading+'</strong><p>'+esc(e.detail)+'</p>'+
      (Object.keys(e.frenchUnits).length?unitLine(e.frenchUnits,'France'):'')+'</div>';
    if(e.income)return '<div class="review-item"><strong>Income collected</strong>'+e.income.accounts.map(a=>
      '<h4>'+esc(treasuryName(a.wallet))+'</h4>'+incomeLedger(a,true)).join('')+'</div>';
    if(!e.dice)return '<div class="review-item"><strong>'+heading+'</strong><p>'+reviewDetail(e.detail,attacking,e.heldBy)+'</p></div>';
    const losses=savedRoundLosses(e);
    const owner=e.defender||/^Losses — [^:]+: .+; ([^:]+): /.exec(e.detail)?.[1]||exercise.defender;
    const nations=defendingNations(e.dice,owner?[owner]:[]);
    const casualtiesByNation=nationalArmies(Object.entries(e.nationalLosses||{}).flatMap(([p,army])=>
      Object.entries(army).map(([type,n])=>[p,type,n])));
    if(isGlobal&&e.nationalLosses)for(const nation of nations)casualtiesByNation[nation]??={};
    const breakdown=losses?'<div class="force-columns">'+forceColumns(losses.attack,losses.defense,owner||'Defenders','lost',casualtiesByNation,attacking)+'</div>':
      '<p>'+reviewDetail(e.detail,attacking)+'</p>';
    return '<details class="review-item review-round"><summary>'+heading+'</summary>'+breakdown+rollsBox(e.dice,null,attacking,nations)+'</details>';
  }).join('');
}
let stopHold=()=>{};
function bindHold(button,confirm){
  if(!button||button.disabled)return;
  let timer=null;
  const cancel=()=>{clearTimeout(timer);timer=null;button.classList.remove('holding');};
  stopHold=cancel;
  const start=()=>{if(timer)return;button.classList.add('holding');timer=setTimeout(()=>{cancel();confirm();},850);};
  button.onpointerdown=e=>{if(e.button!==0||!e.isPrimary)return;e.preventDefault();button.setPointerCapture(e.pointerId);start();};
  button.onpointermove=e=>{const b=button.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)cancel();};
  button.onpointerup=button.onpointercancel=button.onlostpointercapture=button.onblur=cancel;
  button.oncontextmenu=e=>e.preventDefault();
  button.onkeydown=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)start();}};
  button.onkeyup=e=>{if([' ','Enter'].includes(e.key))cancel();};
}
window.addEventListener('blur',()=>stopHold());
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){stopHold();if(playback){endPlayback();render();}}
});
let displayedDraft,noncombatPreview;
function redeployment(){
  if(displayedDraft!==s.noncombatOrders||!noncombatPreview){
    noncombatPreview=noncombatPosition(s);displayedDraft=s.noncombatOrders;
  }
  return noncombatPreview;
}
function selectedNoncombatOrder(){
  return {from:ui.from,type:ui.stack,quantity:ui.quantity,flight:ui.flight,load:ui.load,transport:!!ui.cross,extraInf:!!ui.extraInf};
}
function selectRedeployment(id,type,flight){
  const g=redeployment(),limit=flight==null?g.unused[id]?.[type]:g.flights[flight]?.available;
  if(!limit)throw Error('This stack has no units left to move.');
  ui={...freshUI(),from:id,stack:type,quantity:limit,flight};
}
function queueRedeployment(to){
  const order={...selectedNoncombatOrder(),to},draft=[...s.noncombatOrders,order];
  if(roomSend('redeploy',{orders:draft}))return;
  const preview=noncombatPosition(s,draft);
  s.noncombatOrders=draft;noncombatPreview=preview;displayedDraft=draft;
  ui=freshUI();
}
function noncombatPanel(){
  const g=redeployment();
  if(ui.stack){
    const selection=selectedNoncombatOrder(),flight=g.flights[ui.flight];
    const maximum=flight?flight.available:g.unused[ui.from][ui.stack];
    const limit=ui.load?1:ui.cross?Math.min(maximum,ui.stack==='inf'?2:1):maximum;
    const routes=noncombatRoutes(g,selection);
    const range=flight?flight.range:exercise.movement.allowance(ui.from,ui.stack);
    let html=title((flight?'Land ':'Move ')+stats[ui.stack].name.toLowerCase(),
      places[ui.from].name+' · '+(ui.cross?'Sea crossing':range+' movement point'+(range===1?'':'s')+(flight?' remaining':'')))+
      stepper('nc-quantity',{[ui.stack]:ui.quantity},{[ui.stack]:limit},[ui.stack],1);
    if(!flight&&ui.stack==='transport'){
      for(const boat of aboard(g,ui.from).filter(h=>!g.spentCargo.includes(h.id)))
        html+=btn(ui.load===boat.id?'Carry cargo onward':'Unload '+describe(boat.units),'nc-unload','secondary','data-id="'+esc(boat.id)+'"');
      if(ui.load)html+='<p class="hint">Choose a friendly coast for the cargo.</p>';
    }
    if(!flight&&!places[ui.from].water&&!aircraft.includes(ui.stack)){
      const crossing=noncombatRoutes(g,{...selection,quantity:1,transport:true,extraInf:false});
      if(ui.cross||crossing.size)html+=btn(ui.cross?'Use land routes':'Sea crossing','nc-cross');
      if(ui.cross&&ui.stack!=='inf'&&g.unused[ui.from].inf>0)html+=btn(ui.extraInf?'Remove accompanying infantry':'Take one infantry as well','nc-infantry');
    }
    html+=block(routes.size?'Choose a highlighted destination':'No eligible destinations');
    for(const [id,path] of [...routes].sort(([a],[b])=>places[a].name.localeCompare(places[b].name))){
      const stops=path.slice(1,-1).map(p=>places[p].name);
      const label=stops.length?'Via '+stops.join(' → '):'Direct';
      html+=opt(id,places[id].name,neutralKey(g.owners[id])?'Activate friendly neutral · '+label:label,'↗','nc-target');
    }
    return html+btn('Back to noncombat moves','clear');
  }
  if(ui.inspect){
    const id=ui.inspect,free=g.unused[id];
    return title(places[id].name,'Noncombat move · '+g.owners[id])+boardGarrison(id)+block('Available to move')+
      (Object.entries(free).filter(([,n])=>n>0).map(([t,n])=>btn(unitCounter(t,n,attacker)+' '+stats[t].name,
        'nc-stack','secondary','data-id="'+id+'" data-k="'+t+'"')).join('')||'<p class="hint">No unused units here.</p>')+btn('Back to moves','clear');
  }
  let html=title('Noncombat move','Tap an unused stack, choose how many units to move, then select a highlighted destination.');
  const recovered=s.record.filter(e=>e.scrambleRecovery);
  if(recovered.length)html+='<details class="review-item"><summary>Defending aircraft landings</summary>'+timeline(recovered)+'</details>';
  if(g.flights.some(f=>f.available)){
    html+=block('Aircraft landings');
    for(const [i,f] of g.flights.entries()){
      if(!f.available)continue;
      html+=opt(String(i),f.available+' × '+stats[f.type].name+' from '+places[f.from].name,
        (f.base?'Reserved at '+places[f.base].name:'Landing required')+' · '+f.range+' movement left','↗','nc-flight');
    }
  }
  html+=carrierLaunchPanel()+block('Queued moves · '+g.moves.length);
  if(g.moves.length){
    for(const [index,m] of g.moves.entries())html+='<div class="review-item"><strong>'+m.path.map(p=>esc(places[p].name)).join(' → ')+'</strong><p>'+
      (m.unloaded?'Unloaded '+unitLine(m.unloaded,attacker):unitCounter(m.type,m.quantity,attacker)+' '+stats[m.type].name)+(m.extraInf?' + 1 infantry':'')+(m.transport?' · Sea crossing':m.flight!=null?' · Aircraft landing':'')+'</p>'+(index<g.moves.length-1?btn('Remove move','nc-remove','secondary','data-id="'+index+'"'):'')+'</div>';
    html+=btn('Undo last move','nc-undo');
  }
  const stranded=g.flights.reduce((n,f)=>n+(f.base?0:f.available),0);
  if(stranded)html+='<p class="hint">'+stranded+' aircraft still need landing spaces. Aircraft without a legal landing are lost at turn end.</p>';
  $('action').innerHTML='<button id="finishNoncombat" class="primary hold-to-confirm">'+(stranded?'Hold to resolve landings and mobilize':g.moves.length?'Hold to commit moves and mobilize':'Hold to begin mobilization')+'</button>';
  return html;
}
function carrierLaunchPanel(){
  const match=globalBoard.match,wallets=spendingEconomies(match).filter(w=>match.mobilization?.[w]?.carrier);
  if(!wallets.length)return '';
  const launches=s.carrierLaunches||[];
  let html='<details class="review-item" '+(ui.showLaunches?'open':'')+'><summary>Reserve a carrier launch'+(launches.length?' · '+launches.length:'')+'</summary>'+
    '<p class="hint">Choose a sea zone for a purchased carrier to make its two landing spaces available this turn.</p>';
  for(const [i,o] of launches.entries())html+=btn('Release '+places[o.to].name+' · '+places[o.site].name,'release-launch','secondary','data-id="'+i+'"');
  const plan=launchPlan(match,s);
  for(const wallet of wallets)for(const o of placementOptions(plan,wallet,'carrier'))
    html+=btn(places[o.to].name+' · from '+places[o.site].name,'reserve-launch','secondary','data-id="'+o.to+'" data-k="'+o.site+'" data-wallet="'+wallet+'"');
  return html+'</details>';
}
let placementDraft,placementPreview;
function reserves(){
  if(s.placements!==placementDraft){
    placementPreview=mobilizationPlan(globalBoard.match,s);placementDraft=s.placements;
  }
  return placementPreview;
}
function reserveChoices(){return placementOptions(reserves(),ui.wallet||s.power,ui.reserve);}
function currentPlacement(){return reserveChoices().find(o=>o.site===ui.site&&o.to===ui.destination);}
function setProducingSite(id){
  const choice=reserveChoices().find(o=>o.to===ui.destination&&o.site===id);
  if(!choice)throw Error('Choose a highlighted producing complex.');
  ui.site=id;ui.quantity=1;
}
function choosePlacementSite(id){
  if(ui.destination&&!ui.site&&reserveChoices().some(o=>o.to===ui.destination&&o.site===id)){setProducingSite(id);return;}
  const choices=reserveChoices().filter(o=>o.to===id);
  if(!choices.length)throw Error('Choose a highlighted placement site.');
  ui.destination=id;ui.site=null;ui.quantity=1;
  if(choices.length===1)setProducingSite(choices[0].site);
}
function treasuryName(wallet){
  return wallet==='British'?'UK Europe':wallet==='UK_Pacific'?'UK Pacific':globalPowers[wallet];
}
function ledgerLine(label,value,note=''){
  return '<div class="ledger-line"><div>'+esc(label)+(note?'<small>'+esc(note)+'</small>':'')+'</div><b>'+esc(value)+'</b></div>';
}
function ledgerSection(name,value,body){
  return '<details class="ledger-section"><summary><span>'+name+'</span><b>'+value+'</b></summary>'+body+'</details>';
}
function incomeLedger(account,rolled){
  const sign=n=>n>0?'+'+n:String(n);
  const amount=incomeAmount(account),pending=!rolled&&account.convoys.length>0;
  const earned=account.objectives.filter(o=>o.earned),unearned=account.objectives.filter(o=>!o.earned);
  const landRows=account.territories.map(t=>ledgerLine(t.name,t.value)).join('');
  const bonusRows=earned.map(o=>ledgerLine(o.label,sign(o.earned),o.condition)).join('');
  const inactive=unearned.length?'<details class="income-unearned"><summary>Unearned objectives ('+unearned.length+')</summary>'+
    unearned.map(o=>ledgerLine(o.label,0,o.condition)).join('')+'</details>':'';
  const convoyRows=account.convoys.map(raid=>{
    const cap=account.territories.filter(t=>raid.coasts.includes(t.name)).reduce((n,t)=>n+t.value,0);
    const debit=Object.entries(raid.charges).map(([n,v])=>n+' −'+v).join(' · ');
    const groups=raid.dice.map(g=>'<div class="convoy-group">'+esc((ownerNames[g.power]||g.power)+' · '+g.count+' × '+globalUnits[g.type][0])+
      (g.rolls?'<span class="convoy-dice" aria-label="Dice results">'+g.rolls.map(d=>'<b class="'+(d<=3?'hit':'miss')+'">'+d+'</b>').join('')+'</span>':
        '<small>'+g.number+(g.number===1?' die':' dice')+'</small>')+'</div>').join('');
    return '<div class="convoy-detail">'+ledgerLine('Sea zone '+raid.zone,pending?'Pending':'−'+raid.loss,
      'Adjacent production '+cap+' IPCs · '+raid.coasts.join(', '))+groups+
      (pending?'':'<p class="hint">Damage rolled '+raid.rolled+' · Charged '+raid.loss+' IPCs'+(debit?' · '+esc(debit):'')+'</p>')+'</div>';
  }).join('');
  const summary='<div class="income-total"><span>'+(pending?'Before convoy losses':'Net income')+'</span><strong>'+sign(amount)+' <small>IPCs</small></strong></div>';
  const locked=account.open?'':'<p class="income-closed">'+esc(account.capital)+' is occupied. This treasury collects 0 IPCs.</p>';
  return '<section class="income-ledger">'+summary+locked+
    ledgerSection('Territory income',sign(account.land),(account.open?'':'<p class="hint">Printed values of territories still held</p>')+(landRows||'<p class="hint">No IPC-producing territories held.</p>'))+
    ledgerSection('National objectives',sign(account.bonus),(bonusRows||'<p class="hint">No bonus income this turn.</p>')+inactive)+
    (account.bonds!=null?ledgerLine('War Bonds','+'+account.bonds+' IPCs'):'')+
    ledgerSection('Convoy losses',pending?'Pending':account.loss?'−'+account.loss:'0',convoyRows?'<p class="hint">Rolls of 1–3 cause damage. Each coast can lose only its own IPC value.</p>'+convoyRows:
      '<p class="hint">'+(account.wallet==='Chinese'?'China is exempt from convoy disruption.':account.open?'No eligible convoy raids this turn.':'Convoys are suspended while the capital is occupied.')+'</p>')+
    '<div class="income-balance"><span>Treasury</span><b>'+account.before+(pending?' IPCs before collection':' → '+(account.before+amount)+' IPCs')+'</b></div></section>';
}
function chartList(match,chart,index,choose=false){
  const known=id=>hasTech(match,match.power,id);
  const remaining=chart.filter(([id])=>!known(id)).length;
  const rows=chart.map(([id,name,detail],i)=>ledgerLine((i+1)+' · '+name,known(id)?'Owned':'',detail)).join('');
  return '<details class="ledger-section"><summary>Chart '+(index+1)+' · '+(index?'Naval and air':'Land and industry')+'</summary>'+rows+'</details>'+
    (choose?btn(remaining?'Roll on chart '+(index+1):'Chart '+(index+1)+' complete','discover','secondary','data-id="'+index+'" '+(remaining?'':'disabled')):'');
}
function researchBudget(match){
  const wallets=researchWallets(match),cash=w=>wallets.includes(w)?match.treasury[w]:0;
  const max=Math.floor(wallets.reduce((sum,w)=>sum+cash(w),0)/5);
  const dice=Math.max(1,Math.min(max,Math.trunc(ui.researchDice)||1)),cost=dice*5;
  const minPacific=Math.max(0,cost-cash(match.power)),maxPacific=Math.min(cost,cash('UK_Pacific'));
  return {wallets,max,dice,cost,minPacific,maxPacific,pacific:Math.max(minPacific,Math.min(maxPacific,Math.trunc(ui.pacific)||0))};
}
function numberField(label,id,value,min,max){
  return '<label class="power-seat">'+esc(label)+'<input type="number" inputmode="numeric" id="'+id+'" min="'+min+'" max="'+max+'" step="1" value="'+value+'"></label>';
}
function researchPanel(){
  const match=globalBoard.match,r=match.researchRoll;
  let html=title('Research & Development','Each die costs 5 IPCs. One or more sixes earn one breakthrough. You choose the chart after rolling.');
  if(!r){
    const b=researchBudget(match);
    html+=b.wallets.map(w=>ledgerLine(treasuryName(w),match.treasury[w]+' IPCs')).join('')+
      numberField('Research dice','researchDice',b.dice,1,b.max);
    if(match.power==='British'){
      if(b.minPacific!==b.maxPacific)html+=numberField('IPCs from UK Pacific','researchPacific',b.pacific,b.minPacific,b.maxPacific);
      html+=ledgerLine('Funding',b.cost+' IPCs','UK Europe '+(b.cost-b.pacific)+' · UK Pacific '+b.pacific);
    }
    $('action').innerHTML='<button id="fundResearch" class="primary hold-to-confirm">Hold to spend '+b.cost+' IPCs and roll</button>';
    html+=btn('Skip research and purchase units','research-finish');
  }else{
    html+=ledgerLine('Research rolls',r.rolls.join(' · '),Object.entries(r.paid).filter(([,n])=>n).map(([w,n])=>treasuryName(w)+' paid '+n+' IPCs').join(' · '));
    if(r.advance){
      const [,name,detail]=breakthroughs.flat().find(([id])=>id===r.advance);
      html+=block('Breakthrough · Chart '+(r.chart+1)+' rolled '+r.breakthroughRolls.join(' → '))+'<h3>'+name+'</h3><p>'+detail+'</p>';
    }else html+='<h3>'+(r.step==='chart'?'Breakthrough! Choose a chart':'No breakthrough this turn')+'</h3>';
    if(r.step==='done')$('action').innerHTML=btn('Continue to Purchase & Repair','research-finish','primary');
  }
  return html+breakthroughs.map((c,i)=>chartList(match,c,i,r?.step==='chart')).join('');
}
function victoryTracker(match){
  return victoryStatus(match).map(goal=>{
    const hold=goal.cities.length>=goal.need&&match.victoryHolds?.[goal.key];
    return ledgerSection(goal.side+' · '+goal.name,goal.cities.length+' / '+goal.need,
      '<p>'+esc(goal.cities.join(', ')||'None held')+'</p><p>Home capitals held · '+esc(goal.capitals.join(', ')||'None')+'</p>'+
      (hold?'<p>Hold until the start of '+globalPowers[hold.power]+'’s turn in round '+(hold.round+1)+'.</p>':''));
  }).join('');
}
function victoryPanel(){
  const match=globalBoard.match,v=match.victory;
  $('action').innerHTML=btn('Open game review','final-review','primary');
  return title(v.side==='Axis'?'Axis victory':'Allied victory','Round '+v.round+' · Start of '+globalPowers[v.since.power]+'’s turn')+
    '<p>'+esc(v.side==='Axis'?'The Axis held at least '+v.need+' victory cities in '+(v.key==='pacific'?'the Pacific':'Europe'):'The Allies held Berlin, Rome and Tokyo')+
    ' from '+globalPowers[v.since.power]+'’s turn in round '+v.since.round+' through the start of its next turn.</p>'+
    ledgerLine('Deciding cities',v.cities.length,v.cities.join(', '))+ledgerLine('Home capitals held',v.capitals.length,v.capitals.join(', '))+
    (ui.inspect?inspectionPanel('Back to victory'):'');
}
function objectiveDialog(){
  const m=globalBoard.match;
  const owned=Object.entries(m.technology||{}).filter(([,ids])=>ids.length).map(([p,ids])=>
    '<h4>'+esc(globalPowers[p])+'</h4>'+ids.map(id=>breakthroughs.flat().find(t=>t[0]===id)).filter(Boolean).map(([,n,d])=>ledgerLine(n,'',d)).join('')).join('');
  showDialog('Victory and technology','<p>The Axis needs 8 European cities or 6 Pacific cities. The Allies need Berlin, Rome and Tokyo. Keep the required cities until the capturing power’s next turn and hold at least one home capital at that point.</p>'+
    victoryTracker(m)+'<h3>Developed technology</h3>'+(owned||'<p>No breakthroughs recorded.</p>')+
    (m.researchEnabled===false?'<p>Research is disabled for this game.</p>':breakthroughs.map((c,i)=>chartList(m,c,i)).join('')));
}
function supportChoice(kind){
  const bases=Object.keys(exercise.movement.spaces).filter(id=>exercise.movement.spaces[id].airBase&&(kind!=='paratroopers'||dropRoom(s,id)>0))
    .map(id=>[id,researchRoutes(s,id,kind)]).filter(([,routes])=>routes.size);
  const draft=ui.support?.[kind]||{},[from,routes]=bases.find(([id])=>id===draft.from)||bases[0]||[];
  const to=routes?.has(draft.to)?draft.to:routes?.keys().next().value;
  const options=to?(kind==='rockets'?raidTargets(s,to,'bomber'):Array.from({length:dropRoom(s,from)},(_,i)=>String(i+1))):[];
  return {from,to,bases,routes,options,value:options.includes(draft.value)?draft.value:options[0]};
}
function supportPanel(){
  let html='';
  for(const kind of ['paratroopers','rockets']){
    if(!combatTech(s,kind))continue;
    const c=supportChoice(kind),rocket=kind==='rockets';
    const field=(label,key,options,selected)=>'<label class="power-seat">'+label+'<select data-support="'+kind+'" data-field="'+key+'">'+options.map(([val,name])=>
      '<option value="'+esc(val)+'" '+(val===selected?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label>';
    html+='<details class="review-item" '+(ui.supportOpen===kind?'open':'')+'><summary>'+(rocket?'Rocket attacks':'Paratroopers')+'</summary>';
    if(c.from){
      html+=field('Air base','from',c.bases.map(([id])=>[id,places[id].name]),c.from)+
        field('Destination','to',[...c.routes.keys()].map(id=>[id,places[id].name]),c.to)+
        field(rocket?'Facility':'Infantry','value',c.options.map(v=>[v,rocket?raidFacilityNames[v]:v]),c.value)+
        btn(rocket?'Assign rocket target':'Assign paratroopers','queue-support','secondary','data-id="'+kind+'"');
    }else html+='<p>'+(rocket?'No enemy facility is within four spaces of an operational air base you control.':'Plan a ground or amphibious attack within three spaces of a friendly operational air base with unused infantry.')+'</p>';
    html+='</details>';
  }
  for(const o of s.rocketOrders||[])html+='<div class="review-item">'+ledgerLine('Rocket from '+places[o.from].name,raidFacilityNames[o.target],places[o.to].name)+
    btn('Cancel rocket order','remove-rocket','secondary','data-id="'+o.from+'"')+'</div>';
  return html;
}

function incomePanel(){
  const match=globalBoard.match,report=match.incomeReport;
  $('map').setAttribute('aria-label','Collect income. Select a territory to inspect its production.');
  if(usIncomeChoice(match)){
    $('action').innerHTML=btn('Stay at peace and review income','war-peace','primary');
    return title('U.S. entry into the war','At the start of its third income phase, the United States may declare war on any or all Axis powers.')+warEntry(match);
  }
  const total=report.accounts.reduce((n,a)=>n+incomeAmount(a),0);
  $('action').innerHTML=bondsPending(match)?btn('Roll War Bonds','roll-bonds','primary'):report.rolled?'<button id="collectIncome" class="primary hold-to-confirm">Hold to collect '+total+' IPCs'+(report.accounts.length>1?' across both treasuries':'')+'</button>':
    btn('Roll convoy losses','roll-convoys','primary');
  if(ui.inspect)return inspectionPanel('Back to income');
  const account=report.accounts.find(a=>a.wallet===ui.wallet)||report.accounts[0];
  const wallets=report.accounts.length>1?'<div class="economy-switch" aria-label="Income by treasury">'+report.accounts.map(a=>
    btn(treasuryName(a.wallet)+' · '+(!report.rolled&&a.convoys.length?'Pending':'+'+incomeAmount(a)),'wallet','secondary','data-id="'+a.wallet+'" aria-pressed="'+(a===account)+'"')).join('')+'</div>':'';
  const bonds=report.bondRoll?ledgerLine('War Bonds die',report.bondRoll+' IPCs')+
    (match.power==='British'&&report.accounts.every(a=>a.open)?numberField('War Bonds to UK Pacific','bondSplit',report.accounts.find(a=>a.wallet==='UK_Pacific').bonds||0,0,report.bondRoll):''):
    bondsPending(match)?'<p>Roll one War Bonds die to add its result to your income.</p>':'';
  return '<h2>Collect income</h2>'+warEntry(match)+bonds+wallets+incomeLedger(account,report.rolled);
}
function mobilizePanel(){
  const plan=reserves(),wallet=ui.wallet||s.power;
  const pending=Object.values(plan.remaining).reduce((sum,pool)=>sum+Object.values(pool).reduce((n,v)=>n+v,0),0);
  const ready=plan.assigned===plan.required;
  if(ui.reserve){
    const unit=ui.reserve,choices=reserveChoices(),choice=currentPlacement();
    let html=title('Place '+globalUnits[unit][0].toLowerCase(),plan.remaining[wallet][unit]+' in reserve');
    if(choice){
      const name=places[choice.to].name;
      html+=block(name)+(choice.site===choice.to?'':'<p>Produced in '+esc(places[choice.site].name)+'</p>');
      html+='<div class="stepper"><span>'+unitCounter(boardUnitType(unit),undefined,attacker)+'</span>'+
        btn('−','place-quantity','secondary','data-n="-1" aria-label="Decrease placement" '+(ui.quantity===1?'disabled':''))+
        '<output>'+ui.quantity+'</output>'+btn('+','place-quantity','secondary','data-n="1" aria-label="Increase placement" '+(ui.quantity===choice.limit?'disabled':''))+'</div>';
      if(choice.limit>1)html+=btn('Use maximum ('+choice.limit+')','place-all');
      $('action').innerHTML=btn('Queue '+ui.quantity+' in '+esc(name),'queue-placement','primary');
    }else if(ui.destination){
      html+=block('Choose a producing complex for '+places[ui.destination].name);
      for(const o of choices.filter(o=>o.to===ui.destination))
        html+=opt(o.site,places[o.site].name,plan.slots[o.site]+' production slots left','⌂','place-from');
    }else{
      html+=block(choices.length?'Choose a highlighted site':'No eligible placement sites');
      const destinations=[...new Set(choices.map(o=>o.to))].sort((a,b)=>places[a].name.localeCompare(places[b].name,undefined,{numeric:true}));
      for(const id of destinations){
        const sites=choices.filter(o=>o.to===id);
        const sub=sites.length>1?sites.length+' adjacent complexes':sites[0].site!==id?'From '+places[sites[0].site].name:
          isFacility(unit)?'Facility site':wallet==='Chinese'?'Chinese-controlled territory':plan.slots[id]+' production slots left';
        html+=opt(id,places[id].name,sub,'+','place-at');
      }
    }
    return html+btn('Back to reserves','place-back');
  }
  $('action').innerHTML='<button id="finishMobilization" class="primary hold-to-confirm" '+(ready?'':'disabled')+'>'+
    (!ready?'Assign remaining units to continue':pending?'Hold to refund excess and review income':plan.assigned||plan.upgrades.length?'Hold to mobilize and review income':'Hold to review income')+'</button>';
  if(ui.inspect)return title(places[ui.inspect].name,'Mobilization')+boardGarrison(ui.inspect)+btn('Back to reserves','place-back');
  let html=title('Mobilize new units',pending?'Choose a purchase to see where it can enter play.':
    plan.assigned?'All purchased units are queued for placement.':'No purchased units to place this turn.');
  if(s.power==='British')html+='<div class="economy-switch" aria-label="British reserves">'+spendingEconomies(plan.match).map(id=>
    btn(id==='British'?'Europe':'Pacific','wallet','secondary','data-id="'+id+'" aria-pressed="'+(id===wallet)+'"')).join('')+'</div>';
  const reserve=Object.entries(plan.remaining[wallet]).filter(([,n])=>n>0);
  for(const [unit,n] of reserve)html+=btn(unitCounter(boardUnitType(unit),n,attacker)+' '+globalUnits[unit][0],'reserve','secondary','data-k="'+unit+'"');
  if(!reserve.length&&pending)html+='<p class="hint">This economy has no reserves left.</p>';
  if(plan.upgrades.length)html+=block('Purchased upgrades')+plan.upgrades.map(u=>'<p>'+esc(u.name)+(u.applied?' · Minor complex → major complex':' · 20 IPC refund')+'</p>').join('');
  if(s.placements.length){
    html+=block('Queued units · '+plan.assigned);
    s.placements.forEach((o,i)=>{html+='<div class="review-item"><strong>'+esc(places[o.to].name)+'</strong><p>'+
      unitCounter(boardUnitType(o.unit),o.quantity,attacker)+' '+globalUnits[o.unit][0]+(o.to===o.site?'':' · '+esc(places[o.site].name))+
      '</p>'+btn('Remove placement','remove-placement','secondary','data-id="'+i+'"')+'</div>';});
  }
  if(ready&&pending){
    for(const [id,pool] of Object.entries(plan.remaining)){
      const refund=Object.entries(pool).reduce((sum,[u,n])=>sum+unitPrice(globalBoard.match,u)*n,0);
      if(refund)html+='<p class="hint">'+esc(ownerNames[id])+(id==='UK_Pacific'?' Pacific':'')+' will receive '+refund+' IPCs for excess purchases.</p>';
    }
  }else if(pending)html+='<p class="hint">'+(plan.required-plan.assigned)+(plan.required-plan.assigned===1?' unit still needs':' units still need')+' placement. You can remove queued placements to free a site.</p>';
  return html;
}
function orderRow({unit,name,caption,quantity,plus,facility='',operation='buy',nation=attacker}){
  const change=(delta,disabled)=>btn(delta>0?'+':'−',operation,'order-step',
    'data-k="'+unit+'" data-id="'+esc(facility)+'" data-n="'+delta+'" aria-label="'+
    (delta>0?'Add ':'Remove ')+esc(name)+'" '+(disabled?'disabled':''));
  return '<div class="order-line">'+unitCounter(boardUnitType(unit==='upgrade'?'factory_major':unit),undefined,nation)+
    '<span><strong>'+esc(name)+'</strong><small>'+esc(caption)+'</small></span>'+
    change(-1,!quantity)+'<output>'+quantity+'</output>'+change(1,!plus)+'</div>';
}
function frenchAwardPanel(){
  const draft=s.frenchAward.draft,spent=frenchReinforcementCost(draft),left=12-spent;
  const count=Object.values(draft).reduce((n,v)=>n+v,0);
  $('action').innerHTML='<button id="placeFrenchAward" class="primary hold-to-confirm">'+
    (count?'Hold to place '+count+' French unit'+(count===1?'':'s')+' in Paris':'Hold to decline reinforcements')+'</button>';
  return title('Paris liberated','Player '+globalBoard.match.controllers.French+' controls France. Choose up to 12 IPCs of French units to place in France now.')+
    '<div class="income-balance" aria-live="polite"><span>Reinforcements</span><b>'+spent+' of 12 IPCs selected</b></div>'+
    frenchReinforcements.map(type=>orderRow({unit:type,name:stats[type].name,caption:stats[type].cost+' IPCs',quantity:draft[type]||0,
      plus:stats[type].cost<=left,operation:'french-unit',nation:'France'})).join('')+
    '<p class="hint">France receives this placement once per game. Any unused allowance expires.</p>';
}
function purchasePanel(){
  const match=globalBoard.match,wallet=ui.wallet||match.power,plan=purchasePlan(match,wallet);
  const group=ui.buyGroup||'All',china=wallet==='Chinese',british=match.power==='British';
  const unitGroups=china?['Land']:Object.keys(purchaseGroups);
  const categories=china?['All','Land']:['All',...unitGroups,'Repairs'];
  const total=spendingEconomies(match).reduce((sum,id)=>sum+(id===wallet?plan.cost:purchasePlan(match,id).cost),0);
  $('action').innerHTML='<div class="order-totals" aria-live="polite">'+
    [['Treasury',match.treasury[wallet]],['Order',plan.cost],['Left',plan.remaining]].map(([label,value])=>
      '<span>'+label+'<b>'+value+' <small>IPC</small></b></span>').join('')+'</div>'+
    '<button id="confirmOrder" class="primary hold-to-confirm">'+(total?'Hold to spend '+total+' IPCs':'Hold to finish without spending')+'</button>';
  if(ui.inspect)return inspectionPanel('Back to purchases');
  let html='<h2>Purchase &amp; Repair</h2>';
  if(british)html+='<div class="economy-switch" aria-label="British treasury">'+
    spendingEconomies(match).map(id=>btn(id==='British'?'Europe':'Pacific','wallet','secondary',
    'data-id="'+id+'" aria-pressed="'+(wallet===id)+'"')).join('')+'</div>';
  if(!plan.allowed)return html+'<p class="hint">This economy’s capital is occupied. Its treasury is closed.</p>';
  html+='<div class="order-tools"><select id="buyGroup" aria-label="Order category">'+categories.map(c=>
    '<option '+(group===c?'selected':'')+'>'+c+'</option>').join('')+'</select>'+
    btn('View order','inspect-order')+'</div>';
  if(group==='Repairs'){
    const ships=eligibleShipRepairs(match);
    html+=plan.repairs.map(r=>orderRow({unit:r.unit,name:r.name+' · '+globalUnits[r.unit][0],caption:r.damage+' damage · '+(r.perIPC===2?'2 repairs per IPC':'1 IPC each'),
      quantity:r.quantity,plus:r.quantity<r.damage&&(plan.remaining>=1||r.quantity%r.perIPC>0),facility:r.name,operation:'facility-order'})).join('');
    if(!plan.repairs.length)html+='<p class="hint">No damaged facilities in this economy.</p>';
    for(const ship of ships)html+='<p class="hint">'+esc(ship.name)+' · '+ship.count+' × '+globalUnits[ship.type][0]+' will repair free.</p>';
    return html;
  }
  if(china)html+='<p class="hint">Burma Road '+(plan.roadOpen?'open · Infantry and artillery available.':'closed · Infantry available.')+'</p>';
  else if(group!=='Facilities')html+='<p class="hint">'+(group==='Sea'?'Coastal production · '+plan.seaCount+' of '+plan.coastalCapacity:'Production · '+plan.combatCount+' of '+plan.capacity)+' slots ordered</p>';
  for(const category of group==='All'?unitGroups:[group]){
    if(group==='All'&&unitGroups.length>1)html+=block(category);
    const units=china?(plan.roadOpen?['infantry','artillery']:['infantry']):purchaseGroups[category];
    html+=units.map(unit=>orderRow({unit,name:globalUnits[unit][0],caption:unitPrice(match,unit)+' IPCs',
      quantity:plan.orders[unit]||0,plus:plan.limits[unit]})).join('');
  }
  if(group==='Facilities'||group==='All')html+=plan.upgrades.map(site=>orderRow({unit:'upgrade',name:'Upgrade · '+site.name,
    caption:site.ready?'Minor to major · 20 IPCs':'Fully repair this complex first',quantity:Number(site.selected),
    plus:!site.selected&&site.ready&&plan.remaining>=20,facility:site.name,operation:'facility-order'})).join('');
  return html;
}
function orderSummary(){
  const match=globalBoard.match;
  return spendingEconomies(match).map(wallet=>{
    const plan=purchasePlan(match,wallet);
    const items=Object.entries(plan.orders).map(([unit,n])=>'<p>'+unitCounter(boardUnitType(unit),n,attacker)+' '+(isFacility(unit)?n+' × ':'')+globalUnits[unit][0]+'</p>');
    for(const r of plan.repairs)if(r.quantity)items.push('<p>'+esc(r.name)+' · '+globalUnits[r.unit][0]+' · Repair '+r.quantity+'</p>');
    for(const u of plan.upgrades)if(u.selected)items.push('<p>'+esc(u.name)+' · Upgrade to major complex</p>');
    return '<h3>'+(match.power==='British'?(wallet==='British'?'UK Europe':'UK Pacific'):attacker)+' · '+plan.cost+' IPCs</h3>'+
      (items.join('')||'<p>No spending ordered.</p>');
  }).join('');
}

let panelView,panelNation,showingAward=false;
function roomCanAct(){
  return !roomCode||(!roomBusy&&roomOnline&&lanDecision(globalBoard.match).side===roomState.side);
}
function applyRoom(packet,own=false,after){
  if(!packet||packet.revision<=roomState.revision)return;
  const previous=globalBoard.match,m=packet.match;
  const newBoard=m.power!==previous.power||m.round!==previous.round||m.phase==='victory'||
    previous.phase==='purchase'&&m.phase!=='purchase'||JSON.stringify(previous.diplomacy)!==JSON.stringify(m.diplomacy)||
    JSON.stringify(previous.technology)!==JSON.stringify(m.technology);
  roomState=packet;
  if(newBoard){
    try{
      if($('menuDialog').open&&!$('settingsWindow').hidden)sessionStorage.setItem(roomSettingsKey,'open');
      else if($('dialog').open&&$('warReport'))sessionStorage.setItem(roomReportKey,JSON.stringify(warReportView()));
    }catch{}
    location.reload();return;
  }
  endPlayback();
  for(const power of Object.keys(globalPowers)){
    if(m.holdScrambles?.[power])exercise.holdScrambles[power]=true;else delete exercise.holdScrambles[power];
  }
  const names=s.formationNames;
  globalBoard.match=m;s=m.combat?.game||globalBoard.game;s.formationNames=names;
  currentSearch=null;landingCache=null;noncombatPreview=null;placementPreview=null;
  if(!own)ui=freshUI();
  if(after)after();
  render();
  if($('dialog').open&&$('guideTabs'))refreshFieldGuide();
  if($('dialog').open&&$('warReport'))refreshWarReport();
}
async function refreshRoom(){
  if(roomBusy||roomPolling||document.hidden)return;
  const revision=roomState.revision;roomPolling=true;
  try{
    const p=await lanRequest('rooms/'+roomCode+'?since='+revision,roomSeat.token);
    if(roomBusy||roomState.revision!==revision)return;
    const recovered=!roomOnline;roomOnline=true;
    if(p)applyRoom(p);else if(recovered)render();
  }catch{if(!roomBusy&&roomOnline){roomOnline=false;render();}}
  finally{roomPolling=false;}
}
function roomSend(action,args={},after=()=>{ui=freshUI();}){
  if(!roomCode)return false;
  if(action==='air-orders'?(roomBusy||!roomOnline):!roomCanAct())return true;
  roomBusy=true;message='';render();
  const request={revision:roomState.revision,id:lanToken(),action,args};
  (async()=>{
    try{
      let p;
      try{p=await lanRequest('rooms/'+roomCode+'/action',roomSeat.token,request);}
      catch(err){if(err.status)throw err;p=await lanRequest('rooms/'+roomCode+'/action',roomSeat.token,request);}
      roomBusy=false;roomOnline=true;applyRoom(p,true,after);
    }catch(err){
      roomBusy=false;roomOnline=!!err.status;message=err.status?err.message:'Connection lost. Checking the saved board…';
      render();await refreshRoom();
    }
  })();
  return true;
}
function roomButton(act,b){
  const {id,k,n}=b.dataset,qty=Number(n),index=Number(id),m=globalBoard.match;
  const keep=()=>{},clear=()=>{ui=freshUI();};
  switch(act){
    case 'begin-turn':case 'skip-research':case 'research-finish':case 'begin-noncombat':case 'confirm-interceptors':
    case 'roll':case 'defend':case 'opening-fire':return roomSend(act);
    case 'buy':return roomSend(act,{unit:k,delta:qty,wallet:ui.wallet||s.power},keep);
    case 'facility-order':return roomSend(act,{unit:k,site:id,delta:qty,wallet:ui.wallet||s.power},keep);
    case 'french-unit':return roomSend(act,{unit:k,delta:qty},keep);
    case 'queue-support':{
      const c=supportChoice(id);return id==='rockets'?roomSend('rocket',{from:c.from,to:c.to,target:c.value}):roomSend('drop',{from:c.from,to:c.to,n:Number(c.value)});
    }
    case 'remove-drop':case 'raid-remove':case 'land-remove':
      return roomSend('remove-order',{index:ui.dropIndex??ui.raidIndex??ui.landingIndex});
    case 'remove-rocket':return roomSend(act,{from:id});
    case 'fire-rocket':return roomSend(act,{from:id},()=>{clear();message=s.record.findLast(e=>e.rocket).detail;});
    case 'reserve-launch':case 'release-launch':{
      const old=s.carrierLaunches||[];
      const orders=act==='reserve-launch'?[...old,{wallet:b.dataset.wallet,unit:'carrier',site:k,to:id,quantity:1}]:old.filter((_,i)=>i!==index);
      return roomSend('launches',{orders},()=>{ui.showLaunches=true;});
    }
    case 'queue-placement':case 'remove-placement':{
      const orders=act==='queue-placement'?[...s.placements,{unit:ui.reserve,wallet:ui.wallet||s.power,site:ui.site,to:ui.destination,quantity:ui.quantity}]:s.placements.filter((_,i)=>i!==index);
      return roomSend('placements',{orders},()=>{ui={...freshUI(),wallet:ui.wallet};});
    }
    case 'nc-undo':case 'nc-remove':
      return roomSend('redeploy',{orders:act==='nc-undo'?s.noncombatOrders.slice(0,-1):s.noncombatOrders.filter((_,i)=>i!==index)});
    case 'raid-battle':case 'battle':case 'retreat':return roomSend(act,{to:id});
    case 'raid-step':{
      const to=s.activeRaid;
      return roomSend(act,{step:id,losses:ui.raidLosses||[]},()=>{clear();if(s.raids.find(r=>r.to===to)?.step==='done')ui.raidResult=to;});
    }
    case 'land-queue':return roomSend('landing',{from:ui.from,to:ui.assault.to,draft:ui.assault,replace:ui.editLanding});
    case 'add':case 'remove':return roomSend('plan',{from:ui.from,to:ui.to,path:ui.via,units:act==='remove'?{}:ui.units});
    case 'loss':return roomSend('loss',{losses:ui.losses,choice:{beach:ui.beachLoss,boats:ui.lostBoats}});
    case 'players':showDialog('Room seats','<p>Axis · Player '+m.controllers.Germans+'</p><p>Allies · Player '+m.controllers.British+'</p>');return true;
    case 'save-air-orders':{
      const fields=$('dialogBody').querySelectorAll('[data-air-order]:enabled');
      const holds=Object.fromEntries([...fields].map(el=>[el.dataset.airOrder,el.value==='hold']));
      return roomSend('air-orders',{holds},()=>{$('dialog').close();});
    }
    case 'save-players':case 'reset':case 'confirm-reset':return true;
    default:return false;
  }
}

function render(){
  stopHold();$('action').innerHTML='';
  const briefing=inBriefing(),award=s.frenchAward?.status==='pending';
  const nation=award?'France':attacker;
  if(panelNation!==nation){
    panelNation=nation;
    const palette=styleFor(nation);
    $('ordersPanel').style.setProperty('--nation-ink',palette.ink);
    $('ordersPanel').style.setProperty('--nation-paper',palette.paper);
  }
  if(award&&!showingAward&&$('ordersPanel').hidden)$('ordersButton').click();
  showingAward=award;
  $('exerciseBoard').classList.toggle('opening-briefing',briefing);
  document.querySelector('.power-tab').textContent=finished()?'Game over':award?'France · Player '+globalBoard.match.controllers.French:briefing?'Turn briefing':attacker;
  if(finished()||inResearch())$('map').setAttribute('aria-label',finished()?'Final board. Select a territory to inspect.':'Research and development. Pan or pinch the map.');
  if(finished())$('panel').innerHTML=victoryPanel();
  else if(inResearch())$('panel').innerHTML=researchPanel();
  else if(ui.raidResult)$('panel').innerHTML=raidResultPanel();
  else if(award)$('panel').innerHTML=frenchAwardPanel();
  else if(briefing){
    const match=globalBoard.match;
    $('panel').innerHTML=ui.inspect?inspectionPanel('Back to briefing'):
      '<h2>'+seasonForRound(match.round)+'</h2><p class="briefing-round">Round '+match.round+' · '+attacker+(match.power==='Germans'?' moves first':' to move')+'</p>'+
      '<p class="briefing-address">'+esc(openingAddress(match,match.controllers[match.power]))+' Survey the board, then begin your turn when you’re ready.</p><div class="briefing-guides">'+btn('National objectives &amp; politics','power-reference')+btn('Victory and technology','objective-status')+'</div>'+
      Object.entries(match.victoryHolds||{}).map(([key,h])=>'<p class="hint">'+globalPowers[h.power]+' can clinch '+({europe:'Europe',pacific:'the Pacific',capitals:'the Allied capital objective'}[key])+' at the start of its turn in round '+(h.round+1)+'.</p>').join('')+
      (canResearch(match)?btn('Skip research and purchase units','skip-research'):'');
    $('action').innerHTML=btn('Begin '+attacker+'’s turn','begin-turn','primary');
  }else if(inPurchase())$('panel').innerHTML=purchasePanel();
  else if(s.phase==='plan')$('panel').innerHTML=planPanel();
  else if(s.phase==='combat'){
    const last=s.record.filter(e=>e.capital).at(-1);
    $('panel').innerHTML=(!s.active&&last?'<div class="review-item"><strong>'+esc(last.title)+'</strong><p>'+esc(last.detail)+'</p></div>':'')+battlePanel();
  }
  else if(s.phase==='noncombat')$('panel').innerHTML=noncombatPanel();
  else if(s.phase==='mobilize')$('panel').innerHTML=mobilizePanel();
  else if(s.phase==='income')$('panel').innerHTML=incomePanel();
  else{
    $('panel').innerHTML=title(isGlobal?'Combat review':'Exercise review','Committed attacks and resolved outcomes.')+timeline();
    $('action').innerHTML=isGlobal?btn('Begin noncombat move','begin-noncombat','primary'):btn('Start another exercise','reset');
  }
  updateBattleForces();
  const nextView=[finished(),inResearch(),globalBoard?.match.researchRoll?.step,ui.dropIndex,ui.raidResult,s.raidDefensePending,s.activeRaid,currentRaid(s)?.step,ui.raidMode,ui.raidTo,!!ui.assault,ui.assault?.to,ui.landingIndex,award,briefing,inPurchase(),ui.buyGroup,ui.wallet,ui.reserve,ui.site,ui.destination,ui.inspect,s.phase,s.active,currentBattle(s)?.step,ui.from,ui.to,ui.stack,ui.flight,ui.cross,ui.routeTo,ui.twoSpace,...(ui.passageSteps||[])].join('|');
  if(panelView!==nextView)document.querySelector('.panel-scroll').scrollTop=0;
  panelView=nextView;
  $('notice').textContent=message;
  $('mapNotice').textContent=message;
  const nc=s.phase==='noncombat';
  if(nc)$('map').setAttribute('aria-label','Noncombat move. Select an unused unit and a highlighted destination.');
  if(s.phase==='mobilize'){
    $('map').setAttribute('aria-label','Mobilize new units. Select a purchase and a highlighted placement site.');
    let choices=null;
    if(ui.reserve){
      const options=reserveChoices();
      choices=ui.destination&&!ui.site?options.filter(o=>o.to===ui.destination).map(o=>o.site):[...new Set(options.map(o=>o.to))];
    }
    draw(reserves().game,ui.destination||ui.inspect,null,null,layoutSeed,null,false,choices);
  }else if(ui.assault?.to||ui.raidTo||s.activeRaid||ui.raidResult){
    draw(s,ui.raidResult||ui.raidTo||s.activeRaid||ui.assault?.to,null,null,layoutSeed,null,false,null);
  }else draw(nc?redeployment():s,ui.inspect||ui.from,ui.routeTo||ui.to,ui.stack||ui.inspectedType,layoutSeed,ui.stack?null:ui.inspectedNation,briefing||inPurchase()||inResearch()||finished(),ui.stack?(nc?[...noncombatRoutes(redeployment(),selectedNoncombatOrder()).keys()]:moveChoices()):null);
  if(roomCode){
    const d=lanDecision(globalBoard.match),can=roomCanAct();
    $('storage').textContent='Wi-Fi · '+roomState.side;
    const status=document.createElement('p');status.className='lan-status';status.setAttribute('role','status');
    status.textContent=!roomOnline?'Host disconnected · Reconnecting…':roomBusy?'Saving to host…':d.side?(can?'Your decision':'Waiting for '+d.side)+' · '+d.label:'Final board';
    $('panel').prepend(status);
    if(!can){
      for(const el of document.querySelectorAll('#panel button:not([data-act="objective-status"]):not([data-act="power-reference"]),#panel select,#panel input,#action button:not([data-act="final-review"])'))el.disabled=true;
      return;
    }
  }
  if(award)bindHold($('placeFrenchAward'),()=>roomSend('french-place')||run(()=>{placeFrenchAward(s);ui=freshUI();}));
  else if($('fundResearch'))bindHold($('fundResearch'),()=>{const b=researchBudget(globalBoard.match);advanceEconomy('research-buy',[b.dice,b.pacific]);});
  else if($('collectIncome'))bindHold($('collectIncome'),()=>advanceEconomy('collect'));
  else if($('finishMobilization'))bindHold($('finishMobilization'),()=>advanceEconomy('mobilize'));
  else if($('finishNoncombat'))bindHold($('finishNoncombat'),()=>roomSend('finish-noncombat')||run(()=>{s=beginMobilization(s);ui=freshUI();}));
  else if(inPurchase())bindHold($('confirmOrder'),()=>roomSend('pay')||run(()=>{
    const receipt=confirmPurchase(globalBoard.match);
    globalBoard.match.combatStart=structuredClone(globalBoard.match.board);
    exercise.refreshBases(globalBoard.match.board);
    for(const [id,place] of Object.entries(exercisePlaces)){
      const damage=globalBoard.match.board[place.name]?.shipDamage;
      if(damage)(s.shipDamage??={})[id]=structuredClone(damage);
    }
    s.record.push(receipt);ui=freshUI();
    $('map').setAttribute('aria-label',combatMapLabel);
  }));
  else bindHold($('hold'),()=>roomSend('commit')||run(()=>{commit(s);ui=freshUI();}));
}
const guideTabs={objectives:'Objectives',politics:'Politics',rules:'How to play'};
function openFieldGuide(){
  const tabs=Object.entries(guideTabs).map(([id,name])=>'<button type="button" role="tab" id="guide-'+id+
    '" data-section="'+id+'" aria-controls="guideContent">'+name+'</button>').join('');
  const options=Object.entries(globalPowers).map(([id,name])=>'<option value="'+id+'">'+esc(name)+'</option>').join('');
  showDialog('Field guide','<div id="guideTabs" role="tablist" aria-label="Field guide sections">'+tabs+
    '</div><div id="guideContent" role="tabpanel" tabindex="0"><div id="guideContext"><label for="guidePower">Power</label>'+
    '<select id="guidePower">'+options+'</select><small id="guideTurn"></small></div><div id="guidePage"></div></div>');
  $('guidePower').value=globalBoard.match.power;
  switchGuideTab('objectives');
}
function switchGuideTab(section){
  const body=$('guideContent');
  body.setAttribute('aria-labelledby','guide-'+section);
  for(const tab of $('guideTabs').children){
    const selected=tab.dataset.section===section;
    tab.setAttribute('aria-selected',String(selected));
    tab.tabIndex=selected?0:-1;
  }
  $('guideContext').hidden=section==='rules';
  updateGuidePage(section);
  $('dialogBody').scrollTop=0;
}
function updateGuidePage(section){
  const match=globalBoard.match,power=$('guidePower').value;
  $('guideTurn').textContent='Round '+match.round+' · '+(finished()?'Game over':globalPowers[match.power]+' to move');
  $('guideContent').style.setProperty('--guide-ink',styleFor(globalPowers[power]).ink);
  $('guidePage').innerHTML=section==='objectives'?objectivesReference(match,power):
    section==='politics'?politicsReference(match,power):fieldGuideCopy();
}
function refreshFieldGuide(){
  const section=$('guideTabs').querySelector('[aria-selected="true"]').dataset.section;
  const summaryKey=el=>el&&(el.querySelector('strong')?.textContent||el.firstChild.textContent);
  const open=new Set([...$('guidePage').querySelectorAll('details[open]>summary')].map(summaryKey));
  const focused=summaryKey(document.activeElement.closest('summary'));
  const scroll=$('dialogBody').scrollTop;
  updateGuidePage(section);
  for(const d of $('guidePage').querySelectorAll('details')){
    const summary=d.querySelector('summary');
    d.open=open.has(summaryKey(summary));
    if(focused===summaryKey(summary))summary.focus({preventScroll:true});
  }
  $('dialogBody').scrollTop=scroll;
}
$('dialogBody').addEventListener('change',e=>{
  if(e.target.id==='guidePower')updateGuidePage($('guideTabs').querySelector('[aria-selected="true"]').dataset.section);
});
$('dialogBody').addEventListener('click',e=>{
  const tab=e.target.closest('#guideTabs [role="tab"]');
  if(tab)switchGuideTab(tab.dataset.section);
});
$('dialogBody').addEventListener('keydown',e=>{
  if(!e.target.matches('#guideTabs [role="tab"]'))return;
  const tabs=[...$('guideTabs').children],i=tabs.indexOf(e.target);
  const dest={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[e.key];
  if(dest===undefined)return;
  e.preventDefault();tabs[dest].focus();switchGuideTab(tabs[dest].dataset.section);
});
function showDialog(heading,html){
  $('dialogTitle').textContent=heading;
  $('dialogBody').innerHTML=html;
  $('dialogBody').scrollTop=0;
  if(!$('dialog').open)$('dialog').showModal();
  $('closeDialog').focus();
}
$('dialog').addEventListener('close',()=>{
  if($('issueWar')||$('dialogBody').querySelector('.war-targets')){
    render();
    $('panel').querySelector('[data-act="war-open"]')?.focus({preventScroll:true});
  }
});
// Persist the phase transition and its financial effects in one local-storage write.
async function advanceEconomy(action,targets=[]){
  if(roomCode){
    const cmd={roll:'roll-convoys',bonds:'roll-bonds'}[action]||action;
    const args=action==='research-buy'?{dice:targets[0],pacific:targets[1]}:action==='discover'?{chart:targets[0]}:{targets};
    roomSend(cmd,args,()=>{ui=freshUI();if($('dialog').open)$('dialog').close();});return;
  }
  const persist=()=>{
    if(localStorage.getItem(key)!==lastGlobalSave){location.reload();return;}
    const match=globalBoard.match;
    let next;
    if(action==='mobilize')next=finishMobilization(match,s);
    else if(action==='politics')next=confirmPoliticalChoice(match,targets);
    else if(action==='roll')next=rollConvoys(match);
    else if(action==='bonds')next=rollBonds(match);
    else if(action==='research-buy'||action==='discover'){
      next=structuredClone(match);
      if(action==='research-buy')buyResearch(next,...targets);else discover(next,...targets);
    }
    else next=collectIncome(match);
    localStorage.setItem(key,JSON.stringify(next));
    location.reload();
  };
  try{
    if(navigator.locks)await navigator.locks.request(key+'.economy',persist);
    else persist();
  }catch(error){message=error.message;render();}
}
document.addEventListener('change',event=>{
  if(event.target.matches('.war-targets input'))$('dialogBody').querySelector('[data-act="war-review"]').disabled=!$('dialogBody').querySelector('.war-targets input:checked');
  if(event.target.id==='buyGroup'){
    run(()=>{ui.buyGroup=event.target.value;});
    $('buyGroup')?.focus({preventScroll:true});
  }
});
document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]');if(!b)return;
  const {act,id,k,n}=b.dataset;
  if(act==='power-reference'){openFieldGuide();return;}
  if(act==='objective-status'){objectiveDialog();return;}
  if(act==='final-review'){$('journal').click();return;}
  if(finished()&&act!=='clear')return;
  if(act==='discover'){advanceEconomy('discover',[Number(id)]);return;}
  if(act==='roll-bonds'){advanceEconomy('bonds');return;}
  if(roomCode){
    if((!roomCanAct()&&!['players','air-orders','save-air-orders','clear','war-cancel'].includes(act))||roomButton(act,b))return;
  }
  if(act==='war-open'){chooseWarTargets();return;}
  if(act==='war-cancel'){stopHold();$('dialog').close();return;}
  if(act==='war-review'){reviewWarTargets();return;}
  if(act==='war-peace'){advanceEconomy('politics');return;}
  if(act==='roll-convoys'){advanceEconomy('roll');return;}
  run(()=>{
    switch(act){
      case 'french-unit':changeFrenchDraft(s,k,Number(n));break;
      case 'research-finish':finishResearch(globalBoard.match,s);ui=freshUI();$('map').setAttribute('aria-label','Purchase and repair. Select a territory or force to inspect.');break;
      case 'queue-support':{
        const c=supportChoice(id);
        if(id==='rockets')queueRocket(s,c.from,c.to,c.value);else queueDrop(s,c.from,c.to,Number(c.value));
        ui=freshUI();break;
      }
      case 'remove-drop':s.orders=s.orders.filter((_,i)=>i!==ui.dropIndex);ui=freshUI();break;
      case 'remove-rocket':s.rocketOrders=s.rocketOrders.filter(o=>o.from!==id);break;
      case 'fire-rocket':fireRocket(s,id);message=s.record.findLast(e=>e.rocket).detail;break;
      case 'skip-research':
      case 'begin-turn':
        if(inBriefing()){
          globalBoard.match.phase=act==='begin-turn'&&canResearch(globalBoard.match)?'research':'purchase';ui=freshUI();
          $('map').setAttribute('aria-label','Purchase and repair. Select a territory or force to inspect.');
        }
        break;
      case 'wallet':ui={...freshUI(),buyGroup:ui.buyGroup,wallet:id};break;
      case 'inspect-order':showDialog('Current order',orderSummary());break;
      case 'buy':changePurchase(globalBoard.match,k,Number(n),ui.wallet||s.power);break;
      case 'facility-order':changeFacilityOrder(globalBoard.match,ui.wallet||s.power,id,k,Number(n));break;
      case 'begin-noncombat':beginNoncombat(s);ui=freshUI();break;
      case 'reserve-launch':
      case 'release-launch':{
        const previous=s.carrierLaunches||[];
        const draft=act==='reserve-launch'?[...previous,{wallet:b.dataset.wallet,unit:'carrier',site:k,to:id,quantity:1}]:
          previous.filter((_,i)=>i!==Number(id));
        s.carrierLaunches=reviseLaunches(globalBoard.match,s,draft);
        noncombatPreview=null;currentSearch=null;ui.showLaunches=true;break;
      }
      case 'reserve':ui={...freshUI(),wallet:ui.wallet,reserve:k};break;
      case 'place-at':choosePlacementSite(id);break;
      case 'place-from':setProducingSite(id);break;
      case 'place-quantity':ui.quantity=Math.max(1,Math.min(currentPlacement().limit,ui.quantity+Number(n)));break;
      case 'place-all':ui.quantity=currentPlacement().limit;break;
      case 'queue-placement':{
        const draft=[...s.placements,{unit:ui.reserve,wallet:ui.wallet||s.power,site:ui.site,to:ui.destination,quantity:ui.quantity}];
        mobilizationPlan(globalBoard.match,s,draft);
        s.placements=draft;ui={...freshUI(),wallet:ui.wallet};break;
      }
      case 'remove-placement':{
        const draft=s.placements.filter((_,i)=>i!==Number(id));
        try{mobilizationPlan(globalBoard.match,s,draft);}catch{throw Error('This carrier is needed for an aircraft landing.');}
        s.placements=draft;ui={...freshUI(),wallet:ui.wallet};break;
      }
      case 'place-back':ui={...freshUI(),wallet:ui.wallet};break;
      case 'nc-stack':selectRedeployment(id,k);break;
      case 'nc-flight':{
        const f=redeployment().flights[Number(id)];selectRedeployment(f.from,f.type,Number(id));break;
      }
      case 'nc-quantity':{
        const g=redeployment(),limit=ui.flight==null?g.unused[ui.from][ui.stack]:g.flights[ui.flight].available;
        ui.quantity=Math.max(1,Math.min(limit,ui.cross?(ui.stack==='inf'?2:1):limit,ui.quantity+Number(n)));break;
      }
      case 'nc-unload':ui.load=ui.load===id?null:id;ui.quantity=1;break;
      case 'nc-cross':ui.cross=!ui.cross;ui.extraInf=false;ui.quantity=1;break;
      case 'nc-infantry':ui.extraInf=!ui.extraInf;break;
      case 'nc-target':queueRedeployment(id);break;
      case 'nc-remove':{
        const draft=s.noncombatOrders.filter((_,index)=>index!==Number(id));
        try{noncombatPosition(s,draft);}catch{throw Error('Undo the later moves that depend on this order first.');}
        s.noncombatOrders=draft;ui=freshUI();break;
      }
      case 'nc-undo':s.noncombatOrders=s.noncombatOrders.slice(0,-1);ui=freshUI();break;
      case 'quantity': ui.quantity=Math.max(1,Math.min(available(s,ui.from)[ui.stack],ui.quantity+Number(n)));break;
      case 'raid-mode':ui.raidMode=!ui.raidMode;delete ui.routeTo;delete ui.passageSteps;break;
      case 'raid-quantity':{
        const draft={...s,orders:s.orders.filter((_,i)=>i!==ui.raidIndex)};
        ui.quantity=Math.max(1,Math.min(available(draft,ui.from)[ui.stack],ui.quantity+Number(n)));break;
      }
      case 'raid-assign':queueRaidSortie(id);break;
      case 'raid-remove':s.orders=s.orders.filter((_,i)=>i!==ui.raidIndex);ui=freshUI();break;
      case 'raid-battle':chooseRaid(s,id);break;
      case 'confirm-interceptors':confirmInterceptors(s);break;
      case 'raid-step':{
        const raid=currentRaid(s);advanceRaid(s,id,ui.raidLosses||[]);delete ui.raidLosses;
        if(raid.step==='done')ui.raidResult=raid.to;break;
      }
      case 'raid-result-close':delete ui.raidResult;break;
      case 'land-start':ui.assault={};break;
      case 'land-engage':ui.assault.engage=!ui.assault.engage;break;
      case 'land-coast':pickLandingCoast(id);break;
      case 'land-another':ui.assault={};break;
      case 'land-back':if(ui.editLanding!=null)ui={...freshUI(),landingIndex:ui.editLanding};else delete ui.assault;break;
      case 'land-cargo':
      case 'land-escort':{
        const d=ui.assault,rows=act==='land-cargo'?d.cargo:d.escorts;
        d.showEscort=$('landingEscorts')?.open;
        const row=rows.find(r=>r.from===id&&r.type===k);
        if(row){row.n+=Number(n);if(!row.n)rows.splice(rows.indexOf(row),1);}
        else if(Number(n)===1)rows.push({from:id,type:k,n:1});break;
      }
      case 'land-queue':{
        const g=landingPosition();queueLanding(g,ui.from,ui.assault.to,ui.assault);s.orders=g.orders;ui=freshUI();break;
      }
      case 'land-edit':{
        const i=ui.landingIndex,o=s.orders[i];
        ui={...freshUI(),editLanding:i,stack:'transport',from:o.from,quantity:1,assault:{...structuredClone(o.landing),to:o.to}};break;
      }
      case 'land-remove':s.orders=s.orders.filter((_,i)=>i!==ui.landingIndex);ui=freshUI();break;
      case 'target': selectTarget(id);break;
      case 'route-back': if(ui.passageSteps?.length)ui.passageSteps.pop();else delete ui.routeTo;break;
      case 'two-space': ui.twoSpace=!ui.twoSpace;break;
      case 'assign': ui.units[k]=(ui.units[k]||0)+Number(n);break;
      case 'casualty': ui.losses[k]=(ui.losses[k]||0)+Number(n);delete ui.beachLoss;if(k==='transport')delete ui.lostBoats;break;
      case 'lost-boat':ui.lostBoats=ui.lostBoats?.includes(id)?ui.lostBoats.filter(x=>x!==id):[...(ui.lostBoats||[]),id];break;
      case 'back': ui=freshUI();break;
      case 'clear': ui=inPurchase()||s.phase==='income'?{...freshUI(),wallet:ui.wallet,buyGroup:ui.buyGroup}:freshUI();break;
      case 'edit': {const order=s.orders[Number(id)];
        if(order.drop){ui={...freshUI(),dropIndex:Number(id)};break;}
        if(order.raid){
          const stack=Object.keys(order.units).find(t=>order.units[t]>0);
          ui={...freshUI(),raidIndex:Number(id),from:order.from,raidTo:order.to,via:orderPassages(order),stack,quantity:order.units[stack]};break;
        }
        if(order.landing){ui={...freshUI(),landingIndex:Number(id)};break;}selectOrigin(order.from);ui.to=order.to;ui.via=orderPassages(order);ui.units={...order.units};break;}
      case 'add': plan(s,ui.from,ui.to,ui.units,ui.via);ui=freshUI();break;
      case 'remove': plan(s,ui.from,ui.to,{},ui.via);ui=freshUI();break;
      case 'battle': chooseBattle(s,id);break;
      case 'opening-fire': ui.losses={};rollOpening(s);break;
      case 'roll': ui.losses={inf:0,tank:0};rollAttack(s);beginRoll('attack');break;
      case 'defend': rollDefense(s);beginRoll('defense');break;
      case 'loss': casualties(s,ui.losses,{beach:ui.beachLoss,boats:ui.lostBoats});ui.losses={inf:0,tank:0};delete ui.beachLoss;delete ui.lostBoats;break;
      case 'retreat': retreat(s,id);break;
      case 'air-orders': {
        if(!isGlobal)break;
        const locked=finished()||s.phase!=='plan'||(s.orders.length>0||s.rocketOrders?.length>0);
        const options=Object.entries(globalPowers).filter(([p])=>p!=='Chinese').map(([p,name])=>
          '<label class="power-seat">'+esc(name)+'<select data-air-order="'+p+'" '+(locked||roomCode&&lanSide(p)!==roomState.side?'disabled':'')+'>'+
          '<option value="scramble">Scramble</option><option value="hold" '+(exercise.holdScrambles[p]?'selected':'')+'>Stay at base</option></select></label>').join('');
        showDialog('Air defense orders','<p>Each operative coastal or island air base can send up to three fighters or tactical bombers. Bases cover amphibious assaults first, then the highest defending IPC value. Ties go to the lowest sea-zone number.</p>'+
          options+(locked?'<p>Change orders before the next combat moves are planned.</p>':btn('Save air defense orders','save-air-orders','primary')));break;
      }
      case 'save-air-orders':
        if(isGlobal&&s.phase==='plan'&&!s.orders.length&&!s.rocketOrders?.length){
          for(const input of $('dialogBody').querySelectorAll('[data-air-order]')){
            if(input.value==='hold')exercise.holdScrambles[input.dataset.airOrder]=true;
            else delete exercise.holdScrambles[input.dataset.airOrder];
          }
          currentSearch=null;$('dialog').close();
        }
        break;
      case 'players': {
        if(!isGlobal)break;
        const locked=(s.orders.length>0||s.rocketOrders?.length>0)||s.phase!=='plan';
        const rows=Object.entries(globalPowers).map(([p,name])=>'<label class="power-seat">'+name+'<select data-power="'+p+'" '+(locked?'disabled':'')+'>'+
          Array.from({length:9},(_,i)=>'<option value="'+(i+1)+'" '+(i+1===globalBoard.match.controllers[p]?'selected':'')+'>Player '+(i+1)+'</option>').join('')+'</select></label>').join('');
        showDialog('Local players',rows+(locked?'':btn('Save players','save-players','primary')));break;
      }
      case 'save-players':
        if(isGlobal&&s.phase==='plan'&&!s.orders.length&&!s.rocketOrders?.length){
          for(const select of $('dialogBody').querySelectorAll('[data-power]'))globalBoard.match.controllers[select.dataset.power]=Number(select.value);
          $('dialog').close();
        }
        break;

      case 'reset':
        showDialog(isGlobal?'Restart global combat?':'Restart exercise?', '<p>'+(isGlobal?'Restore the position at the start of this combat move and clear its orders and review?':'This replaces the position and its local review on this device.')+'</p>'+btn(isGlobal?'Restart combat':'Restart exercise','confirm-reset','danger'));break;
      case 'confirm-reset':
        if(s.phase==='income')throw Error('Mobilization has already been committed.');
        endPlayback();
        if(isGlobal){
          const procurement=s.record.filter(entry=>entry.title==='Purchase & Repair'||entry.research||entry.declaration);
          reverseCapitalPayments(globalBoard.match);
          globalBoard.match.board=structuredClone(globalBoard.match.combatStart);s=structuredClone(globalBoard.game);s.record=procurement;
        }
        else s=newGame(exerciseId);
        nameFormations();layoutSeed=newLayoutSeed();ui=freshUI();$('dialog').close();$('map').setAttribute('aria-label',combatMapLabel);$('recenter').click();break;
    }
  });
  if(e.detail===0&&['buy','facility-order','wallet','french-unit','land-cargo','land-escort'].includes(act)){
    const rowButtons=[...$('panel').querySelectorAll('button[data-act]')].filter(button=>
      button.dataset.act===act&&button.dataset.id===id&&button.dataset.k===k&&!button.disabled);
    (rowButtons.find(button=>button.dataset.n===n)||rowButtons[0])?.focus({preventScroll:true});
  }
});
$('panel').addEventListener('change',e=>{
  const field=e.target.id;
  if(field==='researchDice'||field==='researchPacific')run(()=>{
    const b=researchBudget(globalBoard.match),n=Number(e.target.value);
    if(field==='researchDice')ui.researchDice=Math.max(1,Math.min(b.max,Math.trunc(n)||1));
    else ui.pacific=Math.max(b.minPacific,Math.min(b.maxPacific,Math.trunc(n)||0));
  });
  if(roomCode&&field==='bondSplit'){roomSend('split-bonds',{pacific:Number(e.target.value)},()=>{});return;}
  if(field==='bondSplit')run(()=>splitBonds(globalBoard.match,Number(e.target.value)));
  if(e.target.matches('[data-support]'))run(()=>{
    const kind=e.target.dataset.support,key=e.target.dataset.field,options=(ui.support??={})[kind]??={};
    options[key]=e.target.value;ui.supportOpen=kind;
    if(key==='from')delete options.to;
    if(key!=='value')delete options.value;
  });
  if(roomCode&&e.target.matches('[data-interceptor]')){roomSend('interceptor',{to:e.target.dataset.place,power:e.target.dataset.interceptor,n:Number(e.target.value)},()=>{});return;}
  if(roomCode&&e.target.matches('[data-bomb-target]')){roomSend('bomb-target',{index:Number(e.target.dataset.bombTarget),target:e.target.value},()=>{});return;}
  if(e.target.matches('[data-interceptor]'))run(()=>setInterceptorCount(s,e.target.dataset.place,e.target.dataset.interceptor,Number(e.target.value)));
  if(e.target.matches('[data-bomb-target]'))run(()=>setRaidTarget(s,Number(e.target.dataset.bombTarget),e.target.value));
  if(e.target.matches('[data-raid-loss]'))run(()=>{
    const i=Number(e.target.dataset.raidLoss);
    ui.raidLosses=e.target.checked?[...(ui.raidLosses||[]),i]:(ui.raidLosses||[]).filter(n=>n!==i);
  });
  if(e.target.matches('[data-beach-loss]'))run(()=>{(ui.beachLoss??={})[e.target.dataset.beachLoss]=Number(e.target.value);});
  if(e.target.matches('[data-landing-route]'))run(()=>setLandingPath(Number(e.target.value)));
  if(e.target.matches('[data-landing-load]'))run(()=>{ui.assault.load=e.target.value||null;ui.assault.cargo=[];});
});
$('exerciseMenu').onclick=()=>{location.hash=roomCode?'lobby/'+roomCode:'';};
document.querySelector('.theater').textContent=exercise.name;
const combatMapLabel='Pan or pinch the map. Select a unit from '+attacker+' and an eligible destination.';
$('map').setAttribute('aria-label',inBriefing()?'Opening board. Pan or pinch the map and select a territory or force to inspect.':inPurchase()?'Purchase and repair. Select a territory or force to inspect.':combatMapLabel);
$('controlKey').innerHTML=(isGlobal?[attacker]:[attacker,defender]).map(n=>'<i data-nation="'+n+'"></i>'+n).join(' ');
$('closeDialog').onclick=()=>$('dialog').close();
function currentWarChart(){
  return warStatusChart(isGlobal?globalWarStatus(globalBoard.match):exerciseWarStatus(s));
}
function warReportView(){
  return {scroll:$('dialogBody').scrollTop,expanded:[...$('warReport').querySelectorAll('details[open]')].map(row=>row.dataset.metric),
    focused:document.activeElement.closest('[data-metric]')?.dataset.metric};
}
function restoreReportView(viewState){
  for(const row of $('warReport').querySelectorAll('details')){
    row.open=viewState.expanded.includes(row.dataset.metric);
    if(row.dataset.metric===viewState.focused)row.querySelector('summary').focus({preventScroll:true});
  }
  $('dialogBody').scrollTop=viewState.scroll;
}
function refreshWarReport(){
  const lastView=warReportView();
  $('warReport').innerHTML=currentWarChart();
  restoreReportView(lastView);
}
$('warStatus').onclick=()=>showDialog('War Status','<section id="warReport" aria-label="Allies and Axis comparison">'+currentWarChart()+'</section>');
$('journal').onclick=()=>{
  const current=finished()?'<h3>'+esc(globalBoard.match.victory.side==='Axis'?'Axis victory':'Allied victory')+' · Round '+globalBoard.match.victory.round+'</h3>':['review','noncombat','mobilize','income'].includes(s.phase)?timeline()||'<p>No combat was recorded.</p>':timeline(s.record.filter(e=>e.research||e.declaration||e.capital||e.frenchUnits||e.scramblePower||e.raid))+'<p>The current combat review opens after all battles are resolved.</p>';
  const previous=(globalBoard?.match.turnReviews||[]).slice().reverse().map(turn=>{
    const nation=globalPowers[turn.power];
    return '<details class="review-item review-round" '+(finished()&&turn===globalBoard.match.turnReviews.at(-1)?'open':'')+'><summary>'+seasonForRound(turn.round)+' · '+nation+'</summary>'+
      (timeline(turn.record,nation)||'<p>No combat was recorded.</p>')+'</details>';
  }).join('');
  showDialog(isGlobal?'Game review':'Exercise review',current+previous);
};
function fieldGuideCopy(){
  const navigation='<p>Pan with one finger. '+(isGlobal?'The global map wraps east and west. ':'')+
    'Pinch or use the magnifying glasses to zoom. The crosshair centers the active front. The framed map shows the whole theater. Tap Orders in the center of the bottom bar to show or hide the sheet. Drag its grip to resize it.</p>';
  const terrain='<p>★ marks a capital victory city. ◆ marks another victory city. Both count as one.</p>'+
    '<p>National colors fade inward from the border. Across neutral territories, single grey lines mark strict neutrals, paired lines mark pro-Allied neutrals and dashed lines mark pro-Axis neutrals. Grey stippling marks impassable terrain.</p>'+
    '<p>Tap a territory to inspect it in violet, then tap again to clear it. Dashed borders separate sea zones. Tap water to see adjacent zone numbers.</p>';
  const symbols='<details class="unit-key"><summary>Unit symbols</summary><ul>'+Object.entries(globalUnits).map(([type,[name]])=>
    '<li>'+unitCounter(boardUnitType(type),undefined,attacker)+' '+name+'</li>').join('')+'</ul></details>';
  const planning='<p>Select a stack, set its quantity and tap a highlighted destination. Tap a planned attack to revise or cancel it. Hold to commit all attacks together.</p>'+
    '<p>Land arrows are red, air arrows blue and sea arrows ochre. Nearby routes of the same category can share an arrowhead. Assigned stacks have a muted national color and a dark corner.</p>';
  if(!isGlobal)return '<h3>Navigate the map</h3>'+navigation+'<h3>Read the board</h3>'+terrain+symbols+'<h3>Plan an attack</h3>'+planning+
    '<p>This local exercise covers adjacent land attacks with infantry and tanks. Your position saves on this device.</p>'+btn('Restart exercise','reset','danger');
  const phase=globalBoard.match.phase;
  const phases=[
    ['briefing','Turn briefing','<p>Inspect the board and check your national objectives before beginning your turn. An opponent’s capital or a change in diplomacy can affect your next collection.</p>'],
    ['research','Research and development','<p>When research is available, each die costs 5 IPCs. At least one 6 lets you choose a development chart and roll for one new technology. You may skip research and save your IPCs.</p>'],
    ['purchase','Purchase and repair','<p>Choose new units and repairs, then hold to pay. New units go to your reserves until mobilization. The United Kingdom spends from its Europe and Pacific treasuries separately.</p>'],
    ['combatMove','Combat move',planning+'<p>Issue any declaration of war before queuing orders. Amber marks eligible destinations. For a distant destination, choose the dashed teal passages along the route. Committing an attack on a strict neutral changes the alignment of other eligible strict neutrals.</p>'+
      '<p>Tanks and mechanized infantry move two spaces. Mechanized infantry needs a tank on the same route to blitz until it gains Improved Mechanized Infantry. Ships normally move two spaces, fighters and tactical bombers four, and strategic bombers six. An operational friendly base can add one space at departure. Aircraft must have enough range to land on eligible carriers or territory that was friendly at the start of the turn.</p>'],
    ['conductCombat','Conduct combat','<p>Select a pending battle or raid. Follow the prompts for opening fire, dice, casualties and any retreat. Antiaircraft artillery fires at incoming aircraft during opening fire. A capture or liberation can change who receives territory income.</p>'],
    ['combatReview','Combat review','<p>Read the battle results and territory changes. Choose Begin noncombat move to continue.</p>'],
    ['noncombatMove','Noncombat move','<p>Redeploy unused units, choose eligible aircraft landings and activate friendly neutrals. A transport can carry one land unit plus one additional infantry between friendly coasts. Queued moves can be removed before you commit.</p>'],
    ['mobilize','Mobilize new units','<p>Select a reserve, a highlighted site and the quantity to place. Ships use a sea zone adjacent to an eligible coastal factory. A purchased carrier can be reserved earlier when aircraft need its deck to land. Hold to place your reserves.</p>'],
    ['income','Collect income','<p>Open the territory and national objective lines to see their sources. Resolve any convoy losses, War Bonds or political decision shown on the sheet. Hold to credit your treasury and pass the turn.</p>']
  ];
  const phaseList=phases.filter(([id])=>id!=='research'||globalBoard.match.researchEnabled!==false).map(([id,label,copy])=>
    '<details class="guide-rule"'+(id===phase?' open':'')+'><summary>'+label+(id===phase?' <small>Current phase</small>':'')+'</summary>'+copy+'</details>').join('');
  const actions=btn('Victory and technology','objective-status')+(finished()?'':btn('Air defense orders','air-orders')+
    btn(roomCode?'Room seats':'Local players','players'))+((roomCode||finished()||inResearch()||inBriefing()||inPurchase()||s.phase==='income')?'':btn('Restart combat','reset','danger'));
  return '<h3>Turn sequence</h3>'+phaseList+'<h3>Map and counters</h3>'+navigation+terrain+symbols+
    '<p>'+(roomCode?'Your position saves on the Wi-Fi host.':'Your position saves on this device.')+
    ' On Android, use the browser menu to install WarTable when available.</p>'+actions+
    '<p>Inland China terrain data courtesy of Mapzen, the U.S. Geological Survey and NOAA. Rivers and lakes from Natural Earth.</p>';
}
$('help').onclick=()=>isGlobal?openFieldGuide():showDialog('Field guide',fieldGuideCopy());
// Store the two panel dimensions separately so rotating the phone restores the last fit.
function setupOrdersPanel(){
  const main=document.querySelector('main'),sheet=$('ordersPanel'),grip=$('resizePanel');
  const button=$('ordersButton'),stacked=matchMedia('(max-width:650px) and (orientation:portrait)');
  // Visibility is local to this board visit. Only Settings changes the opening preference.
  const sizeKey='wartable.orders-panel-size.v1';
  let collapsed=false,sizes={};
  try{
    const opening=JSON.parse(localStorage.getItem(ordersPanelKey))||{};
    collapsed=opening.hidden===true;
    const saved=JSON.parse(localStorage.getItem(sizeKey))||opening;
    sizes={width:saved.width,height:saved.height};
  }catch{}
  function persistSize(axis){
    try{
      const stored=JSON.parse(localStorage.getItem(sizeKey))||sizes;
      localStorage.setItem(sizeKey,JSON.stringify({...stored,[axis]:sizes[axis]}));
    }catch{}
  }
  function dimensions(){
    const vertical=stacked.matches,axis=vertical?'height':'width';
    const extent=main.getBoundingClientRect()[axis];
    const max=Math.floor(extent*(vertical?.74:.62)),min=Math.min(max,vertical?(currentBattle(s)?232:162):218);
    return {axis,extent,min,max,coordinate:vertical?'clientY':'clientX'};
  }
  function apply(){
    sheet.hidden=collapsed;main.classList.toggle('panel-closed',collapsed);
    button.setAttribute('aria-expanded',String(!collapsed));
    main.style.gridTemplateColumns='';main.style.gridTemplateRows='';
    if(collapsed)return;
    const {axis,extent,min,max}=dimensions();
    if(Number.isFinite(sizes[axis])){
      const size=Math.max(min,Math.min(max,Math.round(sizes[axis]*extent)));
      const property=axis==='height'?'gridTemplateRows':'gridTemplateColumns';
      main.style[property]='minmax(0,1fr) '+size+'px';
    }
    grip.setAttribute('aria-orientation',axis==='height'?'horizontal':'vertical');
    grip.setAttribute('aria-valuemin',min);grip.setAttribute('aria-valuemax',max);
    const actual=Math.round(sheet.getBoundingClientRect()[axis]);
    grip.setAttribute('aria-valuenow',actual);grip.setAttribute('aria-valuetext',actual+' pixels '+(axis==='height'?'high':'wide'));
  }
  function toggle(){
    stopHold();collapsed=!collapsed;
    apply();
    (collapsed?button:sheet).focus({preventScroll:true});
  }
  button.onclick=toggle;
  sheet.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!event.defaultPrevented&&!event.target.matches('select,input,textarea')){
      event.preventDefault();toggle();
    }
  });
  function sizeTo(pixels){
    const {axis,extent,min,max}=dimensions();
    sizes[axis]=Math.max(min,Math.min(max,pixels))/extent;apply();
  }
  let drag=null;
  grip.onpointerdown=e=>{
    if(e.button!==0||!e.isPrimary)return;
    const {coordinate,axis}=dimensions();
    drag={coordinate,axis,start:e[coordinate],size:sheet.getBoundingClientRect()[axis]};
    grip.setPointerCapture(e.pointerId);
  };
  grip.onpointermove=e=>{
    if(drag&&grip.hasPointerCapture(e.pointerId)&&drag.axis===dimensions().axis)
      sizeTo(drag.size+drag.start-e[drag.coordinate]);
  };
  grip.onlostpointercapture=()=>{if(drag)persistSize(drag.axis);drag=null;};
  grip.onkeydown=e=>{
    const {min,max,axis}=dimensions(),size=sheet.getBoundingClientRect()[axis];
    const larger=axis==='width'?'ArrowLeft':'ArrowUp',smaller=axis==='width'?'ArrowRight':'ArrowDown';
    if(e.key===larger||e.key===smaller)sizeTo(size+(e.key===larger?24:-24));
    else if(e.key==='Home')sizeTo(min);
    else if(e.key==='End')sizeTo(max);
    else return;
    e.preventDefault();persistSize(axis);
  };
  apply();
  const layoutObserver=new ResizeObserver(apply);
  layoutObserver.observe(main);layoutObserver.observe($('battleForces'));
}
setupOrdersPanel();
render();
if(roomCode){
  try{
    const report=sessionStorage.getItem(roomReportKey);
    if(report){sessionStorage.removeItem(roomReportKey);$('warStatus').click();restoreReportView(JSON.parse(report));}
    else if(sessionStorage.getItem(roomSettingsKey)){
      sessionStorage.removeItem(roomSettingsKey);$('boardSettings').focus();$('boardSettings').click();
    }
  }catch{}
  setInterval(refreshRoom,1200);document.addEventListener('visibilitychange',refreshRoom);window.addEventListener('online',refreshRoom);}
try{draw=await atlas(pick,v=>{view=v;save();},view,exercise);render();save();}catch{message='The map could not load. Reopen the playtest while online to finish the download.';render();}
