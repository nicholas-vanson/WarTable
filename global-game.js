// Global 1940 Second Edition order of play. Both British economies share a controller.
export const globalPowers={
  Germans:'Germany',Russians:'Soviet Union',Japanese:'Japan',Americans:'United States',
  Chinese:'China',British:'United Kingdom',Italians:'Italy',ANZAC:'ANZAC',French:'France'
};
const ownerNames={...globalPowers,UK_Pacific:'United Kingdom · Pacific',Dutch:'Netherlands',
  Neutral_True:'Strict neutral',Neutral_Allies:'Pro-Allied neutral',Neutral_Axis:'Pro-Axis neutral',Mongolians:'Mongolia'};
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
  return {version:1,round:1,power:'Germans',phase:'purchase',controllers:{...controllers},
    treasury:{...setup.treasury},draft:{},mobilization:{},board:Object.fromEntries(
      Object.entries(setup.regions).map(([name,r])=>[name,{owner:r.owner,units:r.units.map(stack=>[...stack])}]))};
}
export function purchaseTotal(draft){
  return Object.entries(draft).reduce((sum,[unit,n])=>sum+n*globalUnits[unit][1],0);
}
export function changePurchase(match,unit,delta){
  if(match.phase!=='purchase'||!Object.hasOwn(globalUnits,unit)||![-1,1].includes(delta))throw Error('This purchase cannot be changed.');
  const n=(match.draft[unit]||0)+delta;
  const next={...match.draft,[unit]:n};
  if(n<0||purchaseTotal(next)>match.treasury[match.power])throw Error('This order exceeds the available units or IPCs.');
  if(!n)delete next[unit];
  match.draft=next;
}
export function confirmPurchase(match){
  if(match.phase!=='purchase')throw Error('This purchase was already recorded.');
  const cost=purchaseTotal(match.draft);
  if(cost>match.treasury[match.power])throw Error('Insufficient IPCs.');
  match.treasury[match.power]-=cost;
  match.mobilization[match.power]={...match.draft};
  match.draft={};match.phase='combatMove';
}
const globalKey='wartable.global1940.match.v1';
function globalElement(tag,text='',className=''){
  const el=document.createElement(tag);el.textContent=text;
  if(className)el.className=className;
  return el;
}
export async function openGlobalGame(root){
  const setup=await (await fetch('./assets/global-setup.json')).json();
  const byId=id=>root.querySelector('#'+id);
  const names=Object.keys(setup.regions).sort(new Intl.Collator('en',{numeric:true}).compare);
  let match,selected='Germany',tab='orders',confirming=false;
  function read(){
    const saved=JSON.parse(localStorage.getItem(globalKey));
    if(saved&&(saved.version!==1||!saved.board?.Germany||!saved.controllers||!saved.treasury))throw Error('The saved global match could not be opened.');
    return saved;
  }
  function report(err){byId('globalStatus').textContent=err.message||'This device could not save the match.';}
  function setupScreen(){
    const seats=byId('controllers');seats.replaceChildren();
    for(const [power,name] of Object.entries(globalPowers)){
      const row=globalElement('label',name),select=globalElement('select');select.name=power;
      for(let i=1;i<=9;i++)select.add(new Option(i===1?'Player 1 · host':'Player '+i,String(i)));
      row.append(select);seats.append(row);
    }
    byId('globalSetup').hidden=false;byId('matchDesk').hidden=true;
  }
  function territory(){
    const data=setup.regions[selected],position=match.board[selected];
    const body=byId('areaInfo');body.replaceChildren(globalElement('h3',selected));
    const control=data.water?'Sea zone':data.blocked?'Impassable':ownerNames[position.owner]||'Neutral';
    body.append(globalElement('p',[control,...(!data.water&&!data.blocked?[data.ipc+' IPC']:[]),...(data.city?['Victory city']:[])].join(' · '),'hint'));
    if(!position.units.length)body.append(globalElement('p','No units present.','hint'));
    const forces=new Map();
    for(const [power,unit,n] of position.units){
      if(!forces.has(power))forces.set(power,[]);
      forces.get(power).push(n+' × '+(globalUnits[unit]?.[0]||unit));
    }
    for(const [power,units] of forces){
      body.append(globalElement('h4',ownerNames[power]||power),globalElement('p',units.join(' · ')));
    }
    const links=globalElement('div','','area-links');
    for(const name of data.links){
      const b=globalElement('button',name);b.type='button';b.dataset.region=name;links.append(b);
    }
    body.append(globalElement('h4','Adjacent areas'),links);
    byId('globalArea').value=selected;
  }
  function render(){
    if(!match){setupScreen();return;}
    byId('globalSetup').hidden=true;byId('matchDesk').hidden=false;
    const phase=match.phase==='purchase'?'Purchase and Repair Units':'Combat Move';
    byId('turnTitle').textContent='Round '+match.round+' · '+globalPowers[match.power];
    byId('turnInfo').textContent='Player '+match.controllers[match.power]+' · '+phase;
    byId('globalOrders').hidden=tab!=='orders';byId('globalBoard').hidden=tab!=='board';
    for(const b of root.querySelectorAll('[data-global-tab]'))b.setAttribute('aria-pressed',String(b.dataset.globalTab===tab));
    if(tab==='board'){territory();return;}
    const cost=purchaseTotal(match.draft),cash=match.treasury[match.power];
    byId('cash').textContent=match.phase==='purchase'?(cash-cost)+' IPCs available · '+cost+' IPCs ordered':cash+' IPCs in treasury';
    byId('purchases').hidden=match.phase!=='purchase';
    byId('confirmOrder').hidden=match.phase!=='purchase';
    byId('confirmOrder').textContent=confirming?'Confirm and end purchases':cost?'Review purchase':'Finish without purchases';
    byId('editOrder').hidden=!confirming||match.phase!=='purchase';
    byId('stageNote').textContent=match.phase==='purchase'?(confirming?'Order total: '+cost+' IPCs. Confirm to enter Combat Move.':''):
      'Opening purchases are saved. Global combat movement is in development.';
    const list=byId('purchases');
    if(!list.children.length){
      for(const [unit,[name,price]] of Object.entries(globalUnits)){
        const row=globalElement('div','','buy-row'),desc=globalElement('span',name);
        desc.append(globalElement('small',price+' IPCs'));
        const buttons=[-1,1].map(delta=>{
          const b=globalElement('button',delta<0?'−':'+');b.dataset.buy=unit;b.dataset.delta=delta;
          b.setAttribute('aria-label',(delta<0?'Remove one ':'Add one ')+name);return b;
        });
        row.append(desc,buttons[0],globalElement('output'),buttons[1]);list.append(row);
      }
    }
    for(const row of list.children){
      const [remove,add]=row.querySelectorAll('button'),unit=add.dataset.buy,n=match.draft[unit]||0;
      row.querySelector('output').textContent=n;remove.disabled=!n||confirming;add.disabled=globalUnits[unit][1]>cash-cost||confirming;
    }
    const ordered=byId('mobilization');ordered.replaceChildren();
    if(match.phase!=='purchase'){
      ordered.append(globalElement('h3','Awaiting mobilization'));
      const units=Object.entries(match.mobilization[match.power]||{});
      ordered.append(globalElement('p',units.map(([u,n])=>n+' × '+globalUnits[u][0]).join(' · ')||'No units purchased.'));
    }
  }
  // Re-read under a same-origin lock so concurrent tabs cannot charge the same order twice.
  async function update(fn){
    const apply=()=>{
      const current=read(),next=fn(current)||current;
      localStorage.setItem(globalKey,JSON.stringify(next));match=next;
    };
    try{
      if(navigator.locks)await navigator.locks.request(globalKey,apply);else apply();
      byId('globalStatus').textContent='';
    }catch(err){report(err);try{match=read();}catch{}}
    render();
  }
  byId('beginGlobal').onclick=()=>{
    const seats=Object.fromEntries([...byId('controllers').querySelectorAll('select')].map(el=>[el.name,Number(el.value)]));
    update(current=>current||startGlobalMatch(setup,seats));
  };
  for(const name of names)byId('globalArea').add(new Option(name,name));
  byId('globalArea').onchange=e=>{selected=e.target.value;territory();};
  root.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||!match)return;
    if(b.dataset.globalTab){tab=b.dataset.globalTab;render();}
    else if(b.dataset.region){selected=b.dataset.region;territory();byId('areaInfo').scrollIntoView({block:'nearest'});}
    else if(b.dataset.buy){update(current=>{changePurchase(current,b.dataset.buy,Number(b.dataset.delta));});}
    else if(b.id==='editOrder'){confirming=false;render();}
    else if(b.id==='confirmOrder'){
      if(!confirming){confirming=true;render();return;}
      const reviewed=JSON.stringify(match.draft);
      confirming=false;update(current=>{
        if(JSON.stringify(current.draft)!==reviewed)throw Error('The order changed in another tab. Please review it again.');
        confirmPurchase(current);
      });
    }
  });
  window.addEventListener('storage',e=>{
    if(e.key===globalKey||e.key===null){try{match=read();confirming=false;render();}catch(err){report(err);}}
  });
  match=read();render();
}
