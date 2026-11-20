import {places,stats,types,newGame,count,available,plan,commit,chooseBattle,currentBattle,rollAttack,rollDefense,casualties,retreat} from './rules.js';
import {atlas} from './map.js';
const $=id=>document.getElementById(id), key='wartable.western-front.v1';
const newLayoutSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
let layoutSeed=newLayoutSeed();
const freshUI=()=>({from:null,to:null,stack:null,quantity:1,units:{inf:0,tank:0},losses:{inf:0,tank:0}});
let s=newGame(),ui=freshUI(),view=null,draw=()=>{},message='';
try{
  const saved=JSON.parse(localStorage.getItem(key)||'null');
  if(saved?.game?.version===1){s=saved.game;ui={...freshUI(),...saved.ui};view=saved.view;layoutSeed=saved.layoutSeed??0;}
}catch{message='The saved exercise could not be read. A new exercise is open.';}
function save(){
  try{localStorage.setItem(key,JSON.stringify({game:s,ui,view,layoutSeed}));}
  catch{$('storage').textContent='Saving unavailable';}
}
function selectOrigin(id){ui.from=id;ui.to=null;ui.stack=null;message='';}
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
function selectTarget(id){
  if(!ui.from)throw new Error('Select a German force first.');
  if(!places[ui.from].targets.includes(id))throw new Error(places[id].name+' does not share a playable border with '+places[ui.from].name+'.');
  const order=s.orders.find(o=>o.from===ui.from&&o.to===id);
  if(ui.stack){
    const assigned=order?{...order.units}:{inf:0,tank:0};
    assigned[ui.stack]+=ui.quantity;
    plan(s,ui.from,id,assigned);
    ui=freshUI();
    return;
  }
  ui.to=id;
  ui.units=order?{...order.units}:{inf:0,tank:0};
}
function pick(id,type){
  if(s.phase==='plan'){run(()=>{
    if(places[id].owner==='Germany'&&type)selectStack(id,type);
    else if(places[id].owner==='Germany')selectOrigin(id);
    else if(ui.stack||ui.to)selectTarget(id);
    else if(type)throw new Error('Choose an infantry or armor stack first.');
  });}
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
function unitCounter(type,amount){
  const label=amount===undefined?stats[type].name:amount+' '+(type==='inf'?'infantry':amount===1?'tank':'tanks');
  return '<span class="counter-face" role="img" aria-label="'+label+'" title="'+label+'"><i class="symbol '+type+'"></i>'+
    (amount===undefined?'':'<b>'+amount+'</b>')+'</span>';
}
function unitLine(units){
  return types.filter(k=>units[k]>0).map(k=>unitCounter(k,units[k])).join(' ')||'no units';
}
// The local journal stores sentences. Render counts in existing saved reviews as counters too.
function reviewDetail(detail){
  return esc(detail).replace(/\b(\d+) (infantry|tanks?)\b/g,(_,n,name)=>unitCounter(name==='infantry'?'inf':'tank',Number(n)));
}
const diePips=[[],[5],[1,9],[1,5,9],[1,3,7,9],[1,3,5,7,9],[1,3,4,6,7,9]];
function dieFace(d){
  const label=stats[d.type].name+' rolled '+d.face+', '+(d.hit?'hit':'miss');
  const pips=diePips[d.face].map(pos=>'<i style="grid-area:'+Math.ceil(pos/3)+' / '+((pos-1)%3+1)+'"></i>').join('');
  return '<span role="img" aria-label="'+label+'" title="'+label+'" class="die '+(d.hit?'hit':'miss')+'">'+pips+'</span>';
}
function stepper(kind,values,limits,keys=types,min=0){
  return keys.map(k=>'<div class="stepper"><span>'+unitCounter(k)+'</span><button aria-label="Remove one '+stats[k].name+'" data-act="'+kind+'" data-k="'+k+'" data-n="-1" '+(values[k]<=min?'disabled':'')+'>−</button><output>'+values[k]+'</output><button aria-label="Add one '+stats[k].name+'" data-act="'+kind+'" data-k="'+k+'" data-n="1" '+(values[k]>=limits[k]?'disabled':'')+'>+</button></div>').join('');
}
function forceRoster(id){
  const free=available(s,id);
  const stacks=types.filter(k=>free[k]).map(k=>{
    const label=stats[k].name+', '+free[k]+' available in '+places[id].name;
    return '<button class="force" data-act="stack" data-id="'+id+'-'+k+'" aria-label="'+label+'">'+
      unitCounter(k,free[k])+'<span class="end" aria-hidden="true">›</span></button>';
  });
  return block(places[id].name)+(stacks.length?'<div class="roster">'+stacks.join('')+'</div>':'<p class="hint">All units assigned.</p>');
}
function planPanel(){
  let html=title('Combat move','Select a stack here or on the map, then choose how many units to send.');
  if(ui.to){
    const existing=s.orders.some(o=>o.from===ui.from&&o.to===ui.to);
    html=title('Plan attack',places[ui.from].name+' → '+places[ui.to].name)+block('Assign units')+stepper('assign',ui.units,available(s,ui.from,ui.to))+
    '<div class="actions">'+btn('Back','back')+btn(existing?'Update order':'Add order','add','primary',count(ui.units)?'':'disabled')+'</div>';
    if(existing)html+=btn('Cancel this order','remove','danger','style="margin-top:8px"');
  }else if(ui.stack){
    html=title(unitCounter(ui.stack)+' stack',places[ui.from].name)+block('Units to move')+
      stepper('quantity',{[ui.stack]:ui.quantity},available(s,ui.from),[ui.stack],1)+
      block('Tap destination to plan move')+
      places[ui.from].targets.map(id=>opt(id,places[id].name,unitLine(s.units[id]),'↗','target')).join('')+
      '<div class="actions">'+btn('Deselect stack','clear')+'</div>';
  }else{
    const origins=ui.from?[ui.from]:['hb','wg'];
    html+=origins.map(forceRoster).join('');
    if(ui.from)html+=btn('All forces','clear');
  }
  if(!ui.to&&s.orders.length){
    html+=block('Planned attacks · '+s.orders.length)+s.orders.map((o,i)=>opt(String(i),places[o.to].name,places[o.from].name+' · '+unitLine(o.units),'↗','edit')).join('');
  }
  $('action').innerHTML=!ui.to&&!ui.stack?'<button class="primary" id="hold" '+(s.orders.length?'':'disabled')+'>Hold to commit attacks</button>':'';
  return html;
}
function rollsBox(dice){
  if(!dice)return '';
  return ['attack','defense'].filter(side=>dice[side]).map(side=>{
    const rolls=dice[side], hits=rolls.filter(d=>d.hit).length;
    const label=side==='attack'?'German attack':'French defense';
    const groups=types.map(type=>{
      const group=rolls.filter(d=>d.type===type);
      if(!group.length)return '';
      const threshold=stats[type][side];
      const diceRow=group.map(dieFace).join('');
      return '<div class="roll-unit">'+unitCounter(type)+'<small>Hits on '+(threshold===1?'1':'1–'+threshold)+'</small><div class="dice-row">'+diceRow+'</div></div>';
    }).join('');
    return '<section class="roll-card" data-side="'+side+'"><h4>'+label+'<span>'+hits+' '+(hits===1?'hit':'hits')+'</span></h4>'+groups+'</section>';
  }).join('');
}
function battlePanel(){
  const b=currentBattle(s);
  if(!b){
    return title('Conduct combat','Choose the next battle to resolve.')+block('Battle order')+
      s.battles.map(b=>b.resolved?'<div class="review-item"><strong>'+places[b.to].name+'</strong><p>'+reviewDetail(b.result)+'</p></div>':opt(b.to,places[b.to].name,unitLine(b.attack)+' attacking','⚑','battle')).join('');
  }
  const info=title(places[b.to].name,'Germany · '+unitLine(b.attack)+'<br>France · '+unitLine(s.units[b.to]))+block(b.round?'Battle round '+b.round:'Land battle')+rollsBox(b.dice);
  if(b.step==='defense'){
    $('action').innerHTML=btn('Roll French defense','defend','primary');
    return info+'<p class="hint">All defending units in this round return fire, including those hit by Germany.</p>';
  }
  if(b.step==='losses' && !b.hits){
    $('action').innerHTML=btn('Resolve round','loss','primary');
    return info+'<p class="hint">Germany takes no casualties this round.</p>';
  }
  if(b.step==='losses'){
    const limits={};
    for(const k of types)limits[k]=Math.min(b.attack[k],ui.losses[k]+b.hits-count(ui.losses));
    $('action').innerHTML=btn('Confirm casualties','loss','primary',count(ui.losses)===b.hits?'':'disabled');
    return info+'<h3>Choose your casualties</h3><p class="hint">Assign '+b.hits+' German '+(b.hits===1?'loss':'losses')+'.</p>'+stepper('casualty',ui.losses,limits);
  }
  $('action').innerHTML=btn(b.round?'Continue · roll German attack':'Roll German attack','roll','primary');
  if(b.step==='decision'){
    return info+'<h3>Continue or retreat?</h3><p class="hint">Retreat all survivors to one origin.</p>'+b.origins.map(id=>btn('Retreat to '+places[id].name,'retreat','secondary','data-id="'+id+'"')).join('');
  }
  return info+'<p class="hint">'+unitCounter('inf')+' hits on 1 attacking or 1–2 defending. '+unitCounter('tank')+' hits on 1–3.</p>';
}
function timeline(){
  return s.record.map(e=>'<div class="review-item"><strong>'+esc(e.title)+'</strong><p>'+reviewDetail(e.detail)+'</p>'+rollsBox(e.dice)+'</div>').join('');
}
let stopHold=()=>{};
function bindHold(){
  const button=$('hold');if(!button||button.disabled)return;
  let timer=null;
  const cancel=()=>{clearTimeout(timer);timer=null;button.classList.remove('holding');};
  stopHold=cancel;
  const start=()=>{if(timer)return;button.classList.add('holding');timer=setTimeout(()=>{cancel();run(()=>{commit(s);ui=freshUI();});},850);};
  button.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();button.setPointerCapture(e.pointerId);start();};
  button.onpointermove=e=>{const b=button.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)cancel();};
  button.onpointerup=button.onpointercancel=button.onlostpointercapture=button.onblur=cancel;
  button.oncontextmenu=e=>e.preventDefault();
  button.onkeydown=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)start();}};
  button.onkeyup=e=>{if([' ','Enter'].includes(e.key))cancel();};
}
window.addEventListener('blur',()=>stopHold());
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopHold();});
let panelView;
function render(){
  stopHold();$('action').innerHTML='';
  if(s.phase==='plan')$('panel').innerHTML=planPanel();
  else if(s.phase==='combat')$('panel').innerHTML=battlePanel();
  else{
    $('panel').innerHTML=title('Exercise review','Committed attacks and resolved outcomes.')+timeline();
    $('action').innerHTML=btn('Start another exercise','reset');
  }
  const nextView=[s.phase,s.active,currentBattle(s)?.step,ui.from,ui.to,ui.stack].join('|');
  if(panelView!==nextView)document.querySelector('.panel-scroll').scrollTop=0;
  panelView=nextView;
  $('notice').textContent=message;
  if(message&&$('ordersPanel').hidden)$('openPanel').click();
  draw(s,ui.from,ui.to,ui.stack,layoutSeed);bindHold();
}
function showDialog(heading,html){
  $('dialogTitle').textContent=heading;
  $('dialogBody').innerHTML=html;
  $('dialogBody').scrollTop=0;
  if(!$('dialog').open)$('dialog').showModal();
  $('closeDialog').focus();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]');if(!b)return;
  const {act,id,k,n}=b.dataset;
  run(()=>{
    switch(act){
      case 'stack': {const [place,type]=id.split('-');selectStack(place,type);break;}
      case 'quantity': ui.quantity=Math.max(1,Math.min(available(s,ui.from)[ui.stack],ui.quantity+Number(n)));break;
      case 'target': selectTarget(id);break;
      case 'assign': ui.units[k]+=Number(n);break;
      case 'casualty': ui.losses[k]+=Number(n);break;
      case 'back': ui.to=null;break;
      case 'clear': ui=freshUI();break;
      case 'edit': {const order=s.orders[Number(id)];selectOrigin(order.from);selectTarget(order.to);break;}
      case 'add': plan(s,ui.from,ui.to,ui.units);ui=freshUI();break;
      case 'remove': plan(s,ui.from,ui.to,{inf:0,tank:0});ui=freshUI();break;
      case 'battle': chooseBattle(s,id);break;
      case 'roll': ui.losses={inf:0,tank:0};rollAttack(s);break;
      case 'defend': rollDefense(s);break;
      case 'loss': casualties(s,ui.losses);ui.losses={inf:0,tank:0};break;
      case 'retreat': retreat(s,id);break;
      case 'reset': showDialog('Restart exercise?','<p>This replaces the position and its local review on this device.</p>'+btn('Restart exercise','confirm-reset','danger'));break;
      case 'confirm-reset': s=newGame();layoutSeed=newLayoutSeed();ui=freshUI();$('dialog').close();$('recenter').click();break;
    }
  });
});
$('closeDialog').onclick=()=>$('dialog').close();
$('journal').onclick=()=>showDialog('Exercise review',(s.phase==='review'?timeline():'<p>The record opens after the last battle. It includes committed attacks, dice, casualties, retreats, and control of each territory.</p>'));
$('help').onclick=()=>showDialog('Field guide','<h3>Navigate the map</h3><p>Pan with one finger. Pinch or use + and − to zoom. ⌖ returns to the front. ⤢ shows the whole theater. Drag the panel grip to resize the orders sheet. Use Hide orders for a full map and Open orders to return.</p><h3>Read the board</h3><p>The narrow olive hatch marks German control and the blue hatch marks French control. Tap a territory to read its controller. Dashed lines separate numbered sea zones. Tap water to see its zone and adjacent zone numbers.</p><h3>Plan an attack</h3><p>German counters use '+unitCounter('inf')+' for infantry and '+unitCounter('tank')+' for armor. Adjust the quantity, then tap a highlighted French territory to place the order. Select the remaining stack to split it again. Tap a planned attack to revise or cancel it. Hold the commit button to lock in all attacks.</p><h3>About this exercise</h3><p>This local exercise covers adjacent land attacks with infantry and tanks. The starting forces are arranged for testing. The surrounding atlas is for exploration.</p><p>Your position saves on this device. On Android, use the browser menu and choose <b>Install app</b> or <b>Add to home screen</b> when available.</p>'+btn('Restart exercise','reset','danger'));
// Store the two panel dimensions separately so rotating the phone restores the last fit.
function setupOrdersPanel(){
  const main=document.querySelector('main'),sheet=$('ordersPanel'),grip=$('resizePanel');
  const open=$('openPanel'),hide=$('hidePanel'),stacked=matchMedia('(max-width:650px) and (orientation:portrait)');
  const prefKey='wartable.orders-panel.v1';
  let prefs={};
  try{
    const saved=JSON.parse(localStorage.getItem(prefKey));
    if(saved&&typeof saved==='object')prefs=saved;
  }catch{}
  const persist=()=>{try{localStorage.setItem(prefKey,JSON.stringify(prefs));}catch{}};
  function dimensions(){
    const vertical=stacked.matches,axis=vertical?'height':'width';
    const extent=main.getBoundingClientRect()[axis];
    const max=Math.floor(extent*(vertical?.74:.62)),min=Math.min(max,vertical?162:218);
    return {axis,extent,min,max,coordinate:vertical?'clientY':'clientX'};
  }
  function apply(){
    const collapsed=prefs.hidden===true;
    sheet.hidden=collapsed;open.hidden=!collapsed;main.classList.toggle('panel-closed',collapsed);
    hide.setAttribute('aria-expanded',String(!collapsed));
    main.style.gridTemplateColumns='';main.style.gridTemplateRows='';
    if(collapsed)return;
    const {axis,extent,min,max}=dimensions();
    if(Number.isFinite(prefs[axis])){
      const size=Math.max(min,Math.min(max,Math.round(prefs[axis]*extent)));
      const property=axis==='height'?'gridTemplateRows':'gridTemplateColumns';
      main.style[property]='minmax(0,1fr) '+size+'px';
    }
    grip.setAttribute('aria-orientation',axis==='height'?'horizontal':'vertical');
    grip.setAttribute('aria-valuemin',min);grip.setAttribute('aria-valuemax',max);
    const actual=Math.round(sheet.getBoundingClientRect()[axis]);
    grip.setAttribute('aria-valuenow',actual);grip.setAttribute('aria-valuetext',actual+' pixels '+(axis==='height'?'high':'wide'));
  }
  function toggle(collapsed){
    prefs.hidden=collapsed;apply();persist();(collapsed?open:hide).focus({preventScroll:true});
  }
  hide.onclick=()=>toggle(true);open.onclick=()=>toggle(false);
  function sizeTo(pixels){
    const {axis,extent,min,max}=dimensions();
    prefs[axis]=Math.max(min,Math.min(max,pixels))/extent;apply();
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
  grip.onlostpointercapture=()=>{drag=null;persist();};
  grip.onkeydown=e=>{
    const {min,max,axis}=dimensions(),size=sheet.getBoundingClientRect()[axis];
    const larger=axis==='width'?'ArrowLeft':'ArrowUp',smaller=axis==='width'?'ArrowRight':'ArrowDown';
    if(e.key===larger||e.key===smaller)sizeTo(size+(e.key===larger?24:-24));
    else if(e.key==='Home')sizeTo(min);
    else if(e.key==='End')sizeTo(max);
    else return;
    e.preventDefault();persist();
  };
  apply();new ResizeObserver(apply).observe(main);
}
setupOrdersPanel();
render();
try{draw=await atlas(pick,v=>{view=v;save();},view);render();save();}catch{message='The map could not load. Reopen the playtest while online to finish the download.';render();}
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{$('storage').textContent='Offline install unavailable';});
}
