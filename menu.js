import {exercises} from './rules.js';
import {globalKey,globalPowers,loadGlobalSetup,startGlobalMatch} from './global-game.js';
import {motionKey,ordersPanelKey} from './preferences.js';

const launcher=document.getElementById('launcher');
const route=location.hash.slice(1);
window.addEventListener('hashchange',()=>location.reload());
let registrationPromise;
if('serviceWorker' in navigator){
  registrationPromise=navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{document.getElementById('storage').textContent='Offline install unavailable';});
}
if(route==='global'||route.startsWith('exercise/')&&Object.hasOwn(exercises,route.slice('exercise/'.length))){
  launcher.hidden=true;
  document.getElementById('exerciseHeader').hidden=false;
  document.getElementById('exerciseBoard').hidden=false;
  try{await import('./app.js');}
  catch(error){document.getElementById('notice').textContent='Could not open this board. '+error.message;document.getElementById('exerciseMenu').onclick=()=>{location.hash='';};}
}else{
  const el=id=>document.getElementById(id);
  const dialog=el('menuDialog');
  const version=document.querySelector('meta[name="application-version"]').content;
  for(const label of document.querySelectorAll('[data-version]'))label.textContent=version;
  const windows={setupWindow:'New local game',settingsWindow:'Settings',guideWindow:'Field guide',aboutWindow:'About WarTable'};
  function openWindow(id){
    for(const name of Object.keys(windows))el(name).hidden=name!==id;
    el('menuDialogTitle').textContent=windows[id];
    el('menuError').hidden=true;
    dialog.showModal();
  }
  function showError(message){
    el('menuError').textContent=message;el('menuError').hidden=false;
  }
  el('menuClose').onclick=()=>dialog.close();
  el('cancelGame').onclick=()=>dialog.close();
  el('menuGuide').onclick=()=>openWindow('guideWindow');
  el('menuAbout').onclick=()=>openWindow('aboutWindow');
  const updateButton=el('checkUpdate'),updateStatus=el('updateStatus');
  if(registrationPromise){
    updateButton.hidden=false;
    updateButton.onclick=async()=>{
      updateButton.disabled=true;
      updateStatus.textContent='Checking for updates…';
      let applying=false;
      const reload=()=>location.reload();
      try{
        const registration=await registrationPromise;
        if(!registration||!navigator.onLine)throw Error();
        if(!registration.waiting&&!registration.installing)await registration.update();
        const worker=registration.installing;
        if(worker){
          updateStatus.textContent='Downloading the playtest…';
          await new Promise((resolve,reject)=>{
            const changed=()=>{
              if(['installed','activating','activated','redundant'].includes(worker.state)){
                worker.removeEventListener('statechange',changed);
                if(worker.state==='redundant')reject(Error());else resolve();
              }
            };
            worker.addEventListener('statechange',changed);changed();
          });
        }
        if(registration.waiting){
          updateStatus.textContent='Opening the updated playtest…';
          navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});
          applying=true;
          registration.waiting.postMessage('apply-update');
        }else{
          // Another open tab may have activated an update while this menu stayed open.
          const html=await (await fetch('./index.html',{cache:'no-store'})).text();
          const current=new DOMParser().parseFromString(html,'text/html').querySelector('meta[name="application-version"]');
          if(current&&current.content!==version)reload();
          else updateStatus.textContent='Version '+version+' is up to date.';
        }
      }catch{
        applying=false;
        navigator.serviceWorker.removeEventListener('controllerchange',reload);
        updateStatus.textContent='Could not check for updates. Connect to the internet and try again.';
      }finally{if(!applying)updateButton.disabled=false;}
    };
    const url=new URL(location.href);
    if(url.searchParams.has('update')){
      url.searchParams.delete('update');
      history.replaceState(history.state,'',url);
      openWindow('aboutWindow');
      updateButton.click();
    }
  }else{
    updateStatus.textContent='For this downloaded edition, open a newly downloaded copy to update.';
  }
  el('menuSettings').onclick=()=>{
    openWindow('settingsWindow');
    try{
      el('menuMotion').value=localStorage.getItem(motionKey)==='reduce'?'reduce':'system';
      el('menuOrders').value=JSON.parse(localStorage.getItem(ordersPanelKey))?.hidden?'hidden':'shown';
    }catch{showError('Device settings could not be read.');}
  };
  el('menuMotion').onchange=event=>{
    try{localStorage.setItem(motionKey,event.target.value);}
    catch{showError('The motion setting could not be saved on this device.');}
  };
  el('menuOrders').onchange=event=>{
    try{
      const prefs=JSON.parse(localStorage.getItem(ordersPanelKey))||{};
      prefs.hidden=event.target.value==='hidden';
      localStorage.setItem(ordersPanelKey,JSON.stringify(prefs));
    }catch{showError('The panel setting could not be saved on this device.');}
  };
  if(route==='exercises'){
    el('modeChoices').hidden=true;el('exerciseChoices').hidden=false;
    for(const [id,front] of Object.entries(exercises)){
      const link=document.createElement('a');link.className='front-link';link.href='#exercise/'+id;
      link.innerHTML='<span><strong>'+front.name+'</strong><small>'+front.attacker+' vs '+front.defender+'</small></span><span class="tool-arrow" aria-hidden="true">→</span>';
      el('frontList').append(link);
    }
  }else{
    const phases={purchase:'Purchase & Repair',combatMove:'Combat Move',conductCombat:'Conduct Combat',combatReview:'Combat Review'};
    const summary=el('campaignSummary');
    const defaultSummary=summary.textContent;
    let setupSnapshot;
    function updateMenu(){
      let match;
      try{match=JSON.parse(localStorage.getItem(globalKey));}catch{}
      const saved=match?.version===1&&match.board?.Germany&&Object.hasOwn(globalPowers,match.power);
      el('continueGlobal').hidden=!saved;
      el('newGlobal').className=saved?'campaign-secondary':'campaign-primary';
      summary.textContent=saved?'Round '+match.round+' · '+globalPowers[match.power]+' · '+(phases[match.phase]||'Local match'):defaultSummary;
    }
    function confirmReplacement(raw){
      setupSnapshot=raw;
      el('replaceNote').hidden=raw===null;
      el('startGame').textContent=raw===null?'Start local game':'Replace and start';
    }
    el('newGlobal').onclick=()=>{
      openWindow('setupWindow');
      try{confirmReplacement(localStorage.getItem(globalKey));el('startGame').disabled=false;}
      catch{el('startGame').disabled=true;showError('Starting a local game requires access to device storage.');}
    };
    el('startGame').onclick=async()=>{
      const start=el('startGame');start.disabled=true;
      try{
        const setup=await loadGlobalSetup();
        if(!dialog.open||el('setupWindow').hidden)return;
        const current=localStorage.getItem(globalKey);
        if(current!==setupSnapshot){
          confirmReplacement(current);
          showError('The saved game changed in another window. Review your choice before starting.');return;
        }
        const seats=Object.fromEntries(Object.keys(globalPowers).map(power=>[power,1]));
        const match=startGlobalMatch(setup,seats);
        match.phase='combatMove';
        localStorage.setItem(globalKey,JSON.stringify(match));
        location.hash='global';
      }catch{showError('The local game could not be started. Check device storage and reopen the playtest.');}
      finally{start.disabled=false;}
    };
    window.addEventListener('storage',event=>{if(event.key===globalKey||event.key===null)updateMenu();});
    updateMenu();
  }
}
