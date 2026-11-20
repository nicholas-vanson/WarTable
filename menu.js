import {exercises} from './rules.js';
import {openGlobalGame} from './global-game.js';

const launcher=document.getElementById('launcher');
const route=location.hash.slice(1);
window.addEventListener('hashchange',()=>location.reload());
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{document.getElementById('storage').textContent='Offline install unavailable';});
}
if(route==='global'){
  launcher.hidden=true;
  const screen=document.getElementById('globalScreen');
  screen.hidden=false;
  try{await openGlobalGame(screen);}
  catch(err){document.getElementById('globalStatus').textContent='Could not open the global match. '+err.message;}
}else if(route.startsWith('exercise/')&&Object.hasOwn(exercises,route.slice('exercise/'.length))){
  launcher.hidden=true;
  document.getElementById('exerciseHeader').hidden=false;
  document.getElementById('exerciseBoard').hidden=false;
  await import('./app.js');
}else if(route==='exercises'){
  document.getElementById('modeChoices').hidden=true;
  document.getElementById('exerciseChoices').hidden=false;
  for(const [id,front] of Object.entries(exercises)){
    const link=document.createElement('a');link.className='mode';link.href='#exercise/'+id;
    link.innerHTML='<span><strong>'+front.name+'</strong><small>'+front.attacker+' vs '+front.defender+'</small></span><span aria-hidden="true">→</span>';
    document.getElementById('frontList').append(link);
  }
}else{
  try{
    if(localStorage.getItem('wartable.global1940.match.v1'))document.getElementById('globalSubtitle').textContent='Resume your saved match';
  }catch{}
}
