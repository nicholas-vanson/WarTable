import {places,stats,types,newGame,count,describe,available,plan,commit,chooseBattle,currentBattle,rollAttack,rollDefense,casualties,retreat} from './rules.js';
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
  return '<button class="option '+(selected?'active':'')+'" data-act="'+act+'" data-id="'+id+'"><span class="unitcode">'+code+'</span><span><strong>'+label+'</strong><small>'+sub+'</small></span><span class="end">›</span></button>';
}
function title(t,sub){return '<h2>'+t+'</h2><p class="hint">'+sub+'</p>';}
function block(t){return '<div class="block-title">'+t+'</div>';}
function stepper(kind,values,limits,keys=types,min=0){
  return keys.map(k=>'<div class="stepper"><span>'+stats[k].name+'</span><button aria-label="Remove one '+stats[k].name+'" data-act="'+kind+'" data-k="'+k+'" data-n="-1" '+(values[k]<=min?'disabled':'')+'>−</button><output>'+values[k]+'</output><button aria-label="Add one '+stats[k].name+'" data-act="'+kind+'" data-k="'+k+'" data-n="1" '+(values[k]>=limits[k]?'disabled':'')+'>+</button></div>').join('');
}
function planPanel(){
  let html=title('Combat move','Tap an infantry or armor counter, choose how many to move, then tap a highlighted destination.');
  if(ui.to){
    const existing=s.orders.some(o=>o.from===ui.from&&o.to===ui.to);
    html=title('Plan attack',places[ui.from].name+' → '+places[ui.to].name)+block('Assign units')+stepper('assign',ui.units,available(s,ui.from,ui.to))+
    '<div class="actions">'+btn('Back','back')+btn(existing?'Update order':'Add order','add','primary',count(ui.units)?'':'disabled')+'</div>';
    if(existing)html+=btn('Cancel this order','remove','danger','style="margin-top:8px"');
  }else if(ui.stack){
    html=title(stats[ui.stack].name+' stack',places[ui.from].name)+block('Units to move')+
      stepper('quantity',{[ui.stack]:ui.quantity},available(s,ui.from),[ui.stack],1)+
      block('Tap destination to plan move')+
      places[ui.from].targets.map(id=>opt(id,places[id].name,describe(s.units[id]),'↗','target')).join('')+
      '<div class="actions">'+btn('Deselect stack','clear')+'</div>';
  }else{
    const origins=ui.from?[ui.from]:['hb','wg'];
    html+=origins.map(id=>{
      const free=available(s,id);
      return block(places[id].name)+types.filter(k=>free[k]).map(k=>
        opt(id+'-'+k,stats[k].name,free[k]+' available',k==='inf'?'⊠':'⬭','stack')).join('');
    }).join('');
    if(ui.from)html+=btn('All forces','clear');
  }
  if(!ui.to&&s.orders.length){
    html+=block('Planned attacks · '+s.orders.length)+s.orders.map((o,i)=>opt(String(i),places[o.to].name,places[o.from].name+' · '+describe(o.units),'↗','edit')).join('');
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
      const diceRow=group.map(d=>'<span class="die '+(d.hit?'hit':'miss')+'"><b>'+d.face+'</b> '+(d.hit?'Hit':'Miss')+'</span>').join('');
      return '<div class="roll-unit"><strong>'+stats[type].name+'</strong><small>Hits on '+(threshold===1?'1':'1–'+threshold)+'</small><div class="dice-row">'+diceRow+'</div></div>';
    }).join('');
    return '<section class="roll-card"><h4>'+label+'<span>'+hits+' '+(hits===1?'hit':'hits')+'</span></h4>'+groups+'</section>';
  }).join('');
}
function battlePanel(){
  const b=currentBattle(s);
  if(!b){
    return title('Conduct combat','Choose the next battle to resolve.')+block('Battle order')+
      s.battles.map(b=>b.resolved?'<div class="review-item"><strong>'+places[b.to].name+'</strong><p>'+b.result+'</p></div>':opt(b.to,places[b.to].name,describe(b.attack)+' attacking','⚑','battle')).join('');
  }
  const info=title(places[b.to].name,'Germany · '+describe(b.attack)+'<br>France · '+describe(s.units[b.to]))+block(b.round?'Battle round '+b.round:'Land battle')+rollsBox(b.dice);
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
  return info+'<p class="hint">Infantry hit on 1 attacking or 1–2 defending. Tanks hit on 1–3.</p>';
}
function timeline(){
  return s.record.map(e=>'<div class="review-item"><strong>'+esc(e.title)+'</strong><p>'+esc(e.detail)+'</p>'+rollsBox(e.dice)+'</div>').join('');
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
function render(){
  stopHold();$('action').innerHTML='';
  if(s.phase==='plan')$('panel').innerHTML=planPanel();
  else if(s.phase==='combat')$('panel').innerHTML=battlePanel();
  else{
    $('panel').innerHTML=title('Exercise review','Committed attacks and resolved outcomes.')+timeline();
    $('action').innerHTML=btn('Start another exercise','reset');
  }
  $('notice').textContent=message;draw(s,ui.from,ui.to,ui.stack,layoutSeed);bindHold();
}
function showDialog(html){$('dialogBody').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();}
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
      case 'reset': showDialog('<h2>Restart exercise?</h2><p>This replaces the position and its local review on this device.</p>'+btn('Restart exercise','confirm-reset','danger'));break;
      case 'confirm-reset': s=newGame();layoutSeed=newLayoutSeed();ui=freshUI();$('dialog').close();$('recenter').click();break;
    }
  });
});
$('closeDialog').onclick=()=>$('dialog').close();
$('journal').onclick=()=>showDialog('<h2>Exercise review</h2>'+(s.phase==='review'?timeline():'<p>The record opens after the last battle. It includes committed attacks, dice, casualties, retreats, and control of each territory.</p>'));
$('help').onclick=()=>showDialog('<h2>Field guide</h2><p>Pan with one finger. Pinch or use + and − to zoom. ⌖ returns to the front. ⤢ shows the whole theater.</p><p>The narrow olive hatch marks German control and the blue hatch marks French control. Tap a territory to read its controller. Dashed lines separate numbered sea zones. Tap water to see its zone and adjacent zone numbers.</p><p>German counters use crossed lines for infantry and an ellipse for armor. Adjust the quantity, then tap a highlighted French territory to place the order. Select the remaining stack to split it again. Tap a planned attack to revise or cancel it. Hold the commit button to lock in all attacks.</p><p>This local exercise covers adjacent land attacks with infantry and tanks. The starting forces are arranged for testing. The surrounding atlas is for exploration.</p><p>Your position saves on this device. On Android, use the browser menu and choose <b>Install app</b> or <b>Add to home screen</b> when available.</p>'+btn('Restart exercise','reset','danger'));
render();
try{draw=await atlas(pick,v=>{view=v;save();},view);render();save();}catch{message='The map could not load. Reopen the playtest while online to finish the download.';render();}
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{$('storage').textContent='Offline install unavailable';});
}
