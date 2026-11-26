import {beginMobilization,mobilizationPlan,placementOptions,finishMobilization,launchPlan,reviseLaunches} from './mobilize.js';
import {beginNoncombat,noncombatPosition,noncombatRoutes} from './noncombat.js';
import {asPassages,orderPassages,samePassages} from './movement.js';
import {ordersPanelKey,reducedMotion} from './preferences.js';
import {neutralKey,strictKey,allianceOf,hostileNeutral} from './neutral-rules.js';
import {globalKey,loadGlobalBoard,saveGlobalPosition,purchaseGroups,spendingEconomies,purchasePlan,eligibleShipRepairs,changePurchase,changeFacilityOrder,confirmPurchase,openingAddress,seasonForRound,nextPower,globalUnits,boardUnitType,isFacility,globalPowers,ownerNames,nationalArmies} from './global-game.js';
import {places,stats,types,exercises,adjectives,newGame,count,describe,available,plan,commit,chooseBattle,currentBattle,mobileTypes,aircraft,targetsFor,movementFor,flightRecoveries,defendingRows,openingFireKind,rollOpening,casualtyLimits,retreatSites,rollAttack,rollDefense,casualties,retreat,theaterVictoryCities} from './rules.js';
import {drawFormationNames} from './formation-names.js';
import {atlas,styleFor} from './map.js';
const $=id=>document.getElementById(id);
const isGlobal=location.hash==='#global';
const exerciseId=isGlobal?'global':location.hash.slice('#exercise/'.length);
const globalBoard=isGlobal?await loadGlobalBoard():null;
let lastGlobalSave=isGlobal?localStorage.getItem(globalKey):null;
const key=isGlobal?globalKey:exerciseId==='west'?'wartable.western-front.v1':'wartable.exercise.'+exerciseId+'.v1';
const exercise=exercises[exerciseId],{attacker,defender}=exercise;
const panelPalette=styleFor(attacker);
$('ordersPanel').style.setProperty('--nation-ink',panelPalette.ink);
$('ordersPanel').style.setProperty('--nation-paper',panelPalette.paper);
const exercisePlaces=Object.fromEntries(Object.keys(exercise.forces).map(id=>[id,places[id]]));
const newLayoutSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
let layoutSeed=newLayoutSeed();
const freshUI=()=>({from:null,to:null,stack:null,quantity:1,units:{inf:0,tank:0},losses:{inf:0,tank:0}});
let s=isGlobal?structuredClone(globalBoard.game):newGame(exerciseId),ui=freshUI(),view=null,draw=()=>{},message='';
try{
  const saved=isGlobal?globalBoard.match.combat:JSON.parse(localStorage.getItem(key)||'null');
  if(saved?.game?.version===1&&(saved.game.exercise||'west')===exerciseId){s=saved.game;ui={...freshUI(),...saved.ui};view=saved.view;layoutSeed=saved.layoutSeed??0;}
}catch{message='The saved exercise could not be read. A new exercise is open.';}
const inPurchase=()=>globalBoard?.match.phase==='purchase';
const inBriefing=()=>globalBoard?.match.phase==='briefing';
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
    const snapshot={game:s,ui,view,layoutSeed};
    if(isGlobal){
      if(localStorage.getItem(key)!==lastGlobalSave){location.reload();return;}
      const match=globalBoard.match;
      if(!inBriefing()&&!inPurchase()){
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
function selectOrigin(id){delete ui.via;delete ui.passageSteps;delete ui.routeTo;delete ui.twoSpace;ui.from=id;ui.to=null;ui.stack=null;delete ui.inspect;delete ui.inspectedType;delete ui.inspectedNation;delete ui.inspectedOrigin;message='';}
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
  const result=stackSearch();
  if(!result)return targetsFor(s,ui.from,ui.stack);
  if(ui.routeTo){
    const prefix=ui.passageSteps||[];
    const choices=result.search.passagesTo(ui.routeTo,prefix);
    if(prefix.length&&result.search.legal(ui.routeTo,prefix))choices.unshift(ui.routeTo);
    return choices;
  }
  return ui.twoSpace?result.multi:result.all.filter(id=>id!==ui.from);
}
function addStackOrder(to,path=[]){
  const prior=s.orders.find(o=>o.from===ui.from&&o.to===to&&samePassages(o,path));
  const units={...prior?.units};
  units[ui.stack]=(units[ui.stack]||0)+ui.quantity;
  if(ui.stack==='mech_infantry'&&path.length&&exercise.movement.spaces[path[0]].blitz)
    units.tank=Math.max(units.tank||0,units.mech_infantry);
  plan(s,ui.from,to,units,path);
  ui=freshUI();
}
function selectTarget(id){
  if(!moveChoices().includes(id))throw new Error('Choose a highlighted space for this move.');
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
  if(!id){run(()=>{ui=freshUI();});return;}
  if(inBriefing()||inPurchase()){
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
  else if(s.phase==='combat'&&!s.active&&s.battles.some(b=>b.to===id&&!b.resolved))run(()=>chooseBattle(s,id));
}
function run(fn){
  message='';
  try{fn();save();}catch(e){message=e.message;}
  render();
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
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
  const label=nation+' '+stats[d.type].name+(stage==='rolling'?' rolling':' rolled '+face+(stage==='marked'?', '+(d.hit?'hit':'miss'):''));
  const pips=diePips[face].map(pos=>'<i style="grid-area:'+Math.ceil(pos/3)+' / '+((pos-1)%3+1)+'"></i>').join('');
  return '<span role="img" aria-label="'+esc(label)+'" title="'+esc(label)+'" '+combatColors(nation)+' class="die '+(stage==='marked'&&d.hit?'hit':'miss')+'">'+pips+'</span>';
}
function stepper(kind,values,limits,keys=types,min=0){
  return keys.map(k=>'<div class="stepper"><span>'+unitCounter(k,undefined,attacker)+'</span><button aria-label="Remove one '+stats[k].name+'" data-act="'+kind+'" data-k="'+k+'" data-n="-1" '+((values[k]||0)<=min?'disabled':'')+'>−</button><output>'+ (values[k]||0) +'</output><button aria-label="Add one '+stats[k].name+'" data-act="'+kind+'" data-k="'+k+'" data-n="1" '+((values[k]||0)>=(limits[k]||0)?'disabled':'')+'>+</button></div>').join('');
}
function armiesAt(id,combatOnly=false){
  const stacks=(s.phase==='noncombat'?redeployment():s.phase==='mobilize'?reserves().game:s).pieces?.[id]||[];
  return nationalArmies(combatOnly?defendingRows(s,id):stacks);
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
  if(facilities.size)forces.push(block('Facilities')+[...facilities].map(type=>unitCounter(type)).join(' '));
  return forces.join('')||'<p class="hint">No units present.</p>';
}
function plannedAttacks(){
  const destinations=new Map();
  const landings=isGlobal?flightRecoveries(s,s.orders):null;
  s.orders.forEach((order,index)=>{
    if(!destinations.has(order.to))destinations.set(order.to,[]);
    const origin=[order.from,...orderPassages(order)].map(id=>places[id].name).join(' → ');
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
  return html;
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
function planPanel(){
  let html=title('Combat move','Tap a unit stack on the map to plan an attack.');
  if(ui.to){
    const existing=s.orders.some(o=>o.from===ui.from&&o.to===ui.to&&samePassages(o,ui.via));
    const limit=available(s,ui.from,ui.to,ui.via);
    const path=asPassages(ui.via);
    const editing={...s,orders:s.orders.filter(o=>o.from!==ui.from||o.to!==ui.to||!samePassages(o,path))};
    const editable=mobileTypes.filter(t=>limit[t]>0&&(isGlobal?movementFor(editing,ui.from,t).legal(ui.to,path):targetsFor(s,ui.from,t).includes(ui.to)));
    html=title(path.length?'Edit route':'Plan attack',[ui.from,...path,ui.to].map(id=>places[id].name).join(' → '))+block('Assign units')+stepper('assign',ui.units,limit,editable)+
    '<div class="actions">'+btn('Back','back')+btn(existing?'Update order':'Add order','add','primary',count(ui.units)?'':'disabled')+'</div>';
    if(existing)html+=btn('Cancel this order','remove','danger','style="margin-top:8px"');
  }else if(ui.routeTo){
    const path=ui.passageSteps||[];
    html=title('Choose passage to '+places[ui.routeTo].name,[ui.from,...path].map(id=>places[id].name).join(' → '))+
      moveChoices().map(id=>{
        if(id===ui.routeTo)return opt(id,'Finish at '+places[id].name,'Complete this route','↗','target');
        const paired=ui.stack==='mech_infantry'&&exercise.movement.spaces[id].blitz;
        const note=paired?'Blitz with one tank per mechanized infantry':'Passage '+(path.length+1);
        return opt(id,'Via '+places[id].name,note,'↗','target');
      }).join('')+btn(path.length?'Back one passage':'Back to destinations','route-back');
  }else if(ui.stack){
    const range=stackSearch()?.search.range;
    const reach=range?' · '+range+(aircraft.includes(ui.stack)?' total spaces for combat and landing':range===1?' space':' spaces'):'';
    html=title(unitCounter(ui.stack,undefined,attacker)+' '+esc(s.formationNames[ui.from+'/'+attacker]?.[ui.stack]||s.formationNames[ui.from]?.[ui.stack]||stats[ui.stack].name),stats[ui.stack].name+' · '+places[ui.from].name+reach)+block('Units to move')+
      stepper('quantity',{[ui.stack]:ui.quantity},available(s,ui.from),[ui.stack],1)+
      (stackSearch()?.multi.length?btn(ui.twoSpace?'Show all moves':'Choose a multi-space route','two-space'):'')+
      block(moveChoices().length?'Tap destination to plan move':'No eligible enemy spaces')+
      moveChoices().map(id=>{
        const routed=ui.twoSpace||isGlobal&&!stackSearch().search.legal(id);
        return opt(id,places[id].name,(routed?'Choose passage · ':'')+targetUnits(id),'↗','target');
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
  if(isGlobal&&!ui.to&&!ui.stack&&!ui.inspect)html+=carrierLaunchPanel();
  if(!ui.to&&!ui.stack)$('action').innerHTML='<button class="primary hold-to-confirm" id="hold" '+(s.orders.length||isGlobal?'':'disabled')+'>'+(isGlobal&&!s.orders.length?'Hold to finish combat moves':'Hold to commit attacks')+'</button>';
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
  return '<button class="battle-choice" data-act="battle" data-id="'+b.to+'">'+
    '<span class="battle-choice-title"><strong>'+places[b.to].name+'</strong><span class="end" aria-hidden="true">›</span></span>'+
    cityObjective(b.to)+'<span class="force-columns">'+forceColumns(b.attack,s.units[b.to],s.owners[b.to],'total',isGlobal?armiesAt(b.to,true):null)+'</span></button>';
}
function battlePanel(){
  const b=currentBattle(s);
  if(!b){
    return title('Conduct combat','Choose the next battle to resolve.')+block('Battle order')+s.battles.map(battleChoice).join('');
  }
  const dice=b.step==='openingLosses'?b.openingDice:b.step==='regular'?null:b.dice;
  const nations=defendingNations(dice,liveDefenders(b));
  const info='<h2>'+places[b.to].name+'</h2>'+block(b.step==='openingLosses'?'Opening fire · round '+b.round:b.round?'Battle round '+b.round:places[b.to].water?'Naval battle':'Land battle')+
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
    return info+'<h3>Assign hits</h3><p class="hint">Assign '+b.hits+' '+(b.hits===1?'hit':'hits')+' to your force.'+shipNote+'</p>'+stepper('casualty',ui.losses,limits,keys);
  }
  const opening=b.step==='regular'?'':openingFireKind(s,b);
  $('action').innerHTML=opening?btn('Roll '+opening.toLowerCase(),'opening-fire','primary'):btn((b.step==='decision'?'Continue · roll ':'Roll ')+adjectives[attacker]+' attack','roll','primary');
  if(b.step==='decision'){
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
    const heading=esc(e.title);
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
  return {from:ui.from,type:ui.stack,quantity:ui.quantity,flight:ui.flight,transport:!!ui.cross,extraInf:!!ui.extraInf};
}
function selectRedeployment(id,type,flight){
  const g=redeployment(),limit=flight==null?g.unused[id]?.[type]:g.flights[flight]?.available;
  if(!limit)throw Error('This stack has no units left to move.');
  ui={...freshUI(),from:id,stack:type,quantity:limit,flight};
}
function queueRedeployment(to){
  const order={...selectedNoncombatOrder(),to},draft=[...s.noncombatOrders,order];
  const preview=noncombatPosition(s,draft);
  s.noncombatOrders=draft;noncombatPreview=preview;displayedDraft=draft;
  ui=freshUI();
}
function noncombatPanel(){
  const g=redeployment();
  if(ui.stack){
    const selection=selectedNoncombatOrder(),flight=g.flights[ui.flight];
    const maximum=flight?flight.available:g.unused[ui.from][ui.stack];
    const limit=ui.cross?Math.min(maximum,ui.stack==='inf'?2:1):maximum;
    const routes=noncombatRoutes(g,selection);
    const range=flight?flight.range:exercise.movement.allowance(ui.from,ui.stack);
    let html=title((flight?'Land ':'Move ')+stats[ui.stack].name.toLowerCase(),
      places[ui.from].name+' · '+(ui.cross?'Sea crossing':range+' movement point'+(range===1?'':'s')+(flight?' remaining':'')))+
      stepper('nc-quantity',{[ui.stack]:ui.quantity},{[ui.stack]:limit},[ui.stack],1);
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
      unitCounter(m.type,m.quantity,attacker)+' '+stats[m.type].name+(m.extraInf?' + 1 infantry':'')+(m.transport?' · Sea crossing':m.flight!=null?' · Aircraft landing':'')+'</p>'+(index<g.moves.length-1?btn('Remove move','nc-remove','secondary','data-id="'+index+'"'):'')+'</div>';
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
  $('action').innerHTML='<button id="endTurn" class="primary hold-to-confirm" '+(ready?'':'disabled')+'>'+
    (!ready?'Assign remaining units to continue':pending?'Hold to refund excess and end turn':plan.assigned||plan.upgrades.length?'Hold to mobilize and end turn':'Hold to end turn')+'</button>';
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
      const refund=Object.entries(pool).reduce((sum,[u,n])=>sum+globalUnits[u][1]*n,0);
      if(refund)html+='<p class="hint">'+esc(ownerNames[id])+(id==='UK_Pacific'?' Pacific':'')+' will receive '+refund+' IPCs for excess purchases.</p>';
    }
  }else if(pending)html+='<p class="hint">'+(plan.required-plan.assigned)+(plan.required-plan.assigned===1?' unit still needs':' units still need')+' placement. You can remove queued placements to free a site.</p>';
  return html;
}
function orderRow({unit,name,caption,quantity,plus,facility='',operation='buy'}){
  const change=(delta,disabled)=>btn(delta>0?'+':'−',operation,'order-step',
    'data-k="'+unit+'" data-id="'+esc(facility)+'" data-n="'+delta+'" aria-label="'+
    (delta>0?'Add ':'Remove ')+esc(name)+'" '+(disabled?'disabled':''));
  return '<div class="order-line">'+unitCounter(boardUnitType(unit==='upgrade'?'factory_major':unit),undefined,attacker)+
    '<span><strong>'+esc(name)+'</strong><small>'+esc(caption)+'</small></span>'+
    change(-1,!quantity)+'<output>'+quantity+'</output>'+change(1,!plus)+'</div>';
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
    html+=plan.repairs.map(r=>orderRow({unit:r.unit,name:r.name+' · '+globalUnits[r.unit][0],caption:r.damage+' damage · 1 IPC each',
      quantity:r.quantity,plus:r.quantity<r.damage&&plan.remaining>=1,facility:r.name,operation:'facility-order'})).join('');
    if(!plan.repairs.length)html+='<p class="hint">No damaged facilities in this economy.</p>';
    for(const ship of ships)html+='<p class="hint">'+esc(ship.name)+' · '+ship.count+' × '+globalUnits[ship.type][0]+' will repair free.</p>';
    return html;
  }
  if(china)html+='<p class="hint">Burma Road '+(plan.roadOpen?'open · Infantry and artillery available.':'closed · Infantry available.')+'</p>';
  else if(group!=='Facilities')html+='<p class="hint">'+(group==='Sea'?'Coastal production · '+plan.seaCount+' of '+plan.coastalCapacity:'Production · '+plan.combatCount+' of '+plan.capacity)+' slots ordered</p>';
  for(const category of group==='All'?unitGroups:[group]){
    if(group==='All'&&unitGroups.length>1)html+=block(category);
    const units=china?(plan.roadOpen?['infantry','artillery']:['infantry']):purchaseGroups[category];
    html+=units.map(unit=>orderRow({unit,name:globalUnits[unit][0],caption:globalUnits[unit][1]+' IPCs',
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

let panelView;
function render(){
  stopHold();$('action').innerHTML='';
  const briefing=inBriefing();
  $('exerciseBoard').classList.toggle('opening-briefing',briefing);
  document.querySelector('.power-tab').textContent=briefing?'Turn briefing':attacker;
  if(briefing){
    const match=globalBoard.match;
    $('panel').innerHTML=ui.inspect?inspectionPanel('Back to briefing'):
      '<h2>'+seasonForRound(match.round)+'</h2><p class="briefing-round">Round '+match.round+' · '+attacker+(match.power==='Germans'?' moves first':' to move')+'</p>'+
      '<p class="briefing-address">'+esc(openingAddress(match,match.controllers[match.power]))+' Survey the board, then begin your turn when you’re ready.</p>';
    $('action').innerHTML=btn('Begin '+attacker+'’s turn','begin-turn','primary');
  }else if(inPurchase())$('panel').innerHTML=purchasePanel();
  else if(s.phase==='plan')$('panel').innerHTML=planPanel();
  else if(s.phase==='combat')$('panel').innerHTML=battlePanel();
  else if(s.phase==='noncombat')$('panel').innerHTML=noncombatPanel();
  else if(s.phase==='mobilize')$('panel').innerHTML=mobilizePanel();
  else{
    $('panel').innerHTML=title(isGlobal?'Combat review':'Exercise review','Committed attacks and resolved outcomes.')+timeline();
    $('action').innerHTML=isGlobal?btn('Begin noncombat move','begin-noncombat','primary'):btn('Start another exercise','reset');
  }
  updateBattleForces();
  const nextView=[briefing,inPurchase(),ui.buyGroup,ui.wallet,ui.reserve,ui.site,ui.destination,ui.inspect,s.phase,s.active,currentBattle(s)?.step,ui.from,ui.to,ui.stack,ui.flight,ui.cross,ui.routeTo,ui.twoSpace,...(ui.passageSteps||[])].join('|');
  if(panelView!==nextView)document.querySelector('.panel-scroll').scrollTop=0;
  panelView=nextView;
  $('notice').textContent=message;
  $('mapNotice').textContent=message;
  $('openPanel').textContent=briefing?'Open briefing':'Open orders';
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
  }else draw(nc?redeployment():s,ui.inspect||ui.from,ui.routeTo||ui.to,ui.stack||ui.inspectedType,layoutSeed,ui.stack?null:ui.inspectedNation,briefing||inPurchase(),ui.stack?(nc?[...noncombatRoutes(redeployment(),selectedNoncombatOrder()).keys()]:moveChoices()):null);
  if($('endTurn'))bindHold($('endTurn'),endTurn);
  else if($('finishNoncombat'))bindHold($('finishNoncombat'),()=>run(()=>{s=beginMobilization(s);ui=freshUI();}));
  else if(inPurchase())bindHold($('confirmOrder'),()=>run(()=>{
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
  else bindHold($('hold'),()=>run(()=>{commit(s);ui=freshUI();}));
}
function showDialog(heading,html){
  $('dialogTitle').textContent=heading;
  $('dialogBody').innerHTML=html;
  $('dialogBody').scrollTop=0;
  if(!$('dialog').open)$('dialog').showModal();
  $('closeDialog').focus();
}
function endTurn(){
  try{
    if(localStorage.getItem(key)!==lastGlobalSave){location.reload();return;}
    const next=finishMobilization(globalBoard.match,s);
    localStorage.setItem(key,JSON.stringify(next));
    location.reload();
  }catch(error){
    message='Could not hand over the turn. '+error.message;render();
  }
}
document.addEventListener('change',event=>{
  if(event.target.id==='buyGroup'){
    run(()=>{ui.buyGroup=event.target.value;});
    $('buyGroup')?.focus({preventScroll:true});
  }
});
document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]');if(!b)return;
  const {act,id,k,n}=b.dataset;
  run(()=>{
    switch(act){
      case 'begin-turn':
        if(inBriefing()){
          globalBoard.match.phase='purchase';ui=freshUI();
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
      case 'target': selectTarget(id);break;
      case 'route-back': if(ui.passageSteps?.length)ui.passageSteps.pop();else delete ui.routeTo;break;
      case 'two-space': ui.twoSpace=!ui.twoSpace;break;
      case 'assign': ui.units[k]=(ui.units[k]||0)+Number(n);break;
      case 'casualty': ui.losses[k]=(ui.losses[k]||0)+Number(n);break;
      case 'back': ui=freshUI();break;
      case 'clear': ui=inPurchase()?{...freshUI(),wallet:ui.wallet,buyGroup:ui.buyGroup}:freshUI();break;
      case 'edit': {const order=s.orders[Number(id)];selectOrigin(order.from);ui.to=order.to;ui.via=orderPassages(order);ui.units={...order.units};break;}
      case 'add': plan(s,ui.from,ui.to,ui.units,ui.via);ui=freshUI();break;
      case 'remove': plan(s,ui.from,ui.to,{},ui.via);ui=freshUI();break;
      case 'battle': chooseBattle(s,id);break;
      case 'opening-fire': ui.losses={};rollOpening(s);break;
      case 'roll': ui.losses={inf:0,tank:0};rollAttack(s);beginRoll('attack');break;
      case 'defend': rollDefense(s);beginRoll('defense');break;
      case 'loss': casualties(s,ui.losses);ui.losses={inf:0,tank:0};break;
      case 'retreat': retreat(s,id);break;
      case 'players': {
        if(!isGlobal)break;
        const locked=s.orders.length>0||s.phase!=='plan';
        const rows=Object.entries(globalPowers).map(([p,name])=>'<label class="power-seat">'+name+'<select data-power="'+p+'" '+(locked?'disabled':'')+'>'+
          Array.from({length:9},(_,i)=>'<option value="'+(i+1)+'" '+(i+1===globalBoard.match.controllers[p]?'selected':'')+'>Player '+(i+1)+'</option>').join('')+'</select></label>').join('');
        showDialog('Local players',rows+(locked?'':btn('Save players','save-players','primary')));break;
      }
      case 'save-players':
        if(isGlobal&&s.phase==='plan'&&!s.orders.length){
          for(const select of $('dialogBody').querySelectorAll('[data-power]'))globalBoard.match.controllers[select.dataset.power]=Number(select.value);
          $('dialog').close();
        }
        break;

      case 'reset':
        showDialog(isGlobal?'Restart global combat?':'Restart exercise?', '<p>'+(isGlobal?'Restore the position at the start of this combat move and clear its orders and review?':'This replaces the position and its local review on this device.')+'</p>'+btn(isGlobal?'Restart combat':'Restart exercise','confirm-reset','danger'));break;
      case 'confirm-reset':
        endPlayback();
        if(isGlobal){
          const procurement=s.record.filter(entry=>entry.title==='Purchase & Repair');
          globalBoard.match.board=structuredClone(globalBoard.match.combatStart);s=structuredClone(globalBoard.game);s.record=procurement;
        }
        else s=newGame(exerciseId);
        nameFormations();layoutSeed=newLayoutSeed();ui=freshUI();$('dialog').close();$('map').setAttribute('aria-label',combatMapLabel);$('recenter').click();break;
    }
  });
  if(e.detail===0&&['buy','facility-order','wallet'].includes(act)){
    const rowButtons=[...$('panel').querySelectorAll('button[data-act]')].filter(button=>
      button.dataset.act===act&&button.dataset.id===id&&button.dataset.k===k&&!button.disabled);
    (rowButtons.find(button=>button.dataset.n===n)||rowButtons[0])?.focus({preventScroll:true});
  }
});
$('exerciseMenu').onclick=()=>{location.hash='';};
document.querySelector('.theater').textContent=exercise.name;
const combatMapLabel='Pan or pinch the map. Select a unit from '+attacker+' and an eligible destination.';
$('map').setAttribute('aria-label',inBriefing()?'Opening board. Pan or pinch the map and select a territory or force to inspect.':inPurchase()?'Purchase and repair. Select a territory or force to inspect.':combatMapLabel);
$('controlKey').innerHTML=(isGlobal?[attacker]:[attacker,defender]).map(n=>'<i data-nation="'+n+'"></i>'+n).join(' ');
$('closeDialog').onclick=()=>$('dialog').close();
$('journal').onclick=()=>{
  const current=['review','noncombat','mobilize'].includes(s.phase)?timeline()||'<p>No combat was recorded.</p>':'<p>The current combat review opens after all battles are resolved.</p>';
  const previous=(globalBoard?.match.turnReviews||[]).slice().reverse().map(turn=>{
    const nation=globalPowers[turn.power];
    return '<details class="review-item review-round"><summary>'+seasonForRound(turn.round)+' · '+nation+'</summary>'+
      (timeline(turn.record,nation)||'<p>No combat was recorded.</p>')+'</details>';
  }).join('');
  showDialog(isGlobal?'Game review':'Exercise review',current+previous);
};
$('help').onclick=()=>showDialog('Field guide','<h3>Navigate the map</h3><p>Pan with one finger. '+(isGlobal?'The global map wraps east and west across the Americas. ':'')+'Pinch or use + and − to zoom. ⌖ returns to the front. ⤢ shows the whole theater. Drag the panel grip to resize the orders sheet. Use Hide orders for a full map and Open orders to return.</p><h3>Read the board</h3><p>★ marks a victory city that is a power’s capital. ◆ marks another victory city. Each counts as one.</p><p>The national color fades inward from the hatched border. Neutral hatching slopes up to the right across the whole territory. Single grey lines mark strict neutrals, paired lines mark pro-Allied neutrals, and dashed lines mark pro-Axis neutrals. Grey stippling marks impassable terrain. Units cannot enter or cross these spaces. A committed strict-neutral invasion changes the other eligible strict neutrals immediately. Friendly neutrals can be activated after combat. Tap a territory to mark it in violet and read its status. Tap it again to clear the selection. Dashed lines separate numbered sea zones. Tap water to see its zone and adjacent zone numbers.</p><details class="unit-key"><summary>Unit symbols</summary><ul>'+Object.entries(globalUnits).map(([type,[name]])=>'<li>'+unitCounter(boardUnitType(type),undefined,attacker)+' '+name+'</li>').join('')+'</ul></details><h3>Plan an attack</h3><p>Land arrows are brick red, air arrows are blue, and sea arrows are ochre. Nearby routes in the same category can share an arrowhead.</p><p>Select a stack on the map, adjust the quantity, then tap a highlighted enemy territory to place the order. Assigned stacks at the front have a muted national color and a dark corner. Select the remaining stack to split it again. Tap a planned attack to revise or cancel it. Hold the commit button to lock in all attacks.</p><h3>About this board</h3><p>'+ (isGlobal?'After combat review, choose Begin noncombat move to redeploy unused units, make sea crossings or change aircraft landings. A transport can carry one land unit and one additional infantry between friendly coasts in a single move. You can remove queued moves or undo the last move. Hold to commit your moves and begin mobilization. Select a purchase, a highlighted site and the quantity to place. Ships use an adjacent coastal factory. You can reserve a purchased carrier’s launch during combat or noncombat movement when aircraft need its deck to land. Hold to place your reserves and hand over the turn. Global 1940 uses the opening forces of all nine powers. Tap any territory or counter to inspect it. Amber marks eligible destinations. Select a distant destination, then follow the dashed teal spaces to choose each passage. Tanks and mechanized infantry move two spaces. Each mechanized infantry needs a tank on the same route to blitz. Ships move two sea zones, fighters and tactical bombers four spaces, and strategic bombers six. An operational friendly naval or air base adds one movement point at departure. Aircraft need enough movement to land in territory that was friendly at the start of the turn, or on an eligible carrier. The order shows the outbound cost and planned landing site. AAA fires at incoming aircraft during opening fire.':'This local exercise covers adjacent land attacks with infantry and tanks. The forces are arranged for testing.')+'</p><p>Your position saves on this device. On Android, use the browser menu and choose <b>Install app</b> or <b>Add to home screen</b> when available.</p>'+(isGlobal?'<p>Inland China terrain data courtesy of Mapzen, the U.S. Geological Survey and NOAA. Rivers and lakes from Natural Earth.</p>'+btn('Local players','players','secondary')+((inBriefing()||inPurchase())?'':btn('Restart combat','reset','danger')):btn('Restart exercise','reset','danger')));
// Store the two panel dimensions separately so rotating the phone restores the last fit.
function setupOrdersPanel(){
  const main=document.querySelector('main'),sheet=$('ordersPanel'),grip=$('resizePanel');
  const open=$('openPanel'),hide=$('hidePanel'),stacked=matchMedia('(max-width:650px) and (orientation:portrait)');
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
    sheet.hidden=collapsed;open.hidden=!collapsed;main.classList.toggle('panel-closed',collapsed);
    hide.setAttribute('aria-expanded',String(!collapsed));
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
  function toggle(hidden){
    stopHold();collapsed=hidden;
    apply();(collapsed?open:hide).focus({preventScroll:true});
  }
  hide.onclick=()=>toggle(true);open.onclick=()=>toggle(false);
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
try{draw=await atlas(pick,v=>{view=v;save();},view,exercise);render();save();}catch{message='The map could not load. Reopen the playtest while online to finish the download.';render();}
