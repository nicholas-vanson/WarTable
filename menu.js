import {exercises} from './rules.js';
import {globalKey,globalPowers,loadGlobalSetup,startGlobalMatch} from './global-game.js';
import {motionKey,ordersPanelKey} from './preferences.js';

const launcher=document.getElementById('launcher');
const route=location.hash.slice(1);
window.addEventListener('hashchange',()=>location.reload());
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{document.getElementById('storage').textContent='Offline install unavailable';});
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
