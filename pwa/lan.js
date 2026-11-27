// Only the seat credential and personal map position live on the phone.
import {globalPowers} from './global-game.js';
const lanRoomPattern=/^[A-F0-9]{10}$/;
const lanBookKey='wartable.lan.seats.v1';
export function lanToken(){return Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');}
export function lanSeats(){return JSON.parse(localStorage.getItem(lanBookKey)||'{}');}
export function rememberSeat(code,seat){localStorage.setItem(lanBookKey,JSON.stringify({...lanSeats(),[code]:seat}));}
export async function lanRequest(path,token,body){
  const headers={};if(token)headers.Authorization='Bearer '+token;
  if(body!==undefined)headers['Content-Type']='application/json';
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);
  try{
    const response=await fetch('./api/'+path,{method:body===undefined?'GET':'POST',headers,body:JSON.stringify(body),cache:'no-store',signal:abort.signal});
    if(response.status===204)return null;
    if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Open the Wi-Fi address printed by the WarTable host.');
    const data=await response.json();
    if(!response.ok)throw Object.assign(Error(data.error||'Room request failed.'),{status:response.status});
    return data;
  }finally{clearTimeout(timer);}
}
export function installLanMenu(selectTab){
  const el=id=>document.getElementById(id),page=location.hash.slice(1);
  let available=false,checking=false,packet=null,working=false,checkingRoom=false;
  const invite=page.match(/^join\/([A-F0-9]{10})$/i)?.[1].toUpperCase();
  const lobby=page.match(/^lobby\/([A-F0-9]{10})$/i)?.[1].toUpperCase();
  function notice(s){el('lanNotice').textContent=s;}
  function section(name){for(const id of ['lanSetup','lanChoose','lanHost','lanJoin','lanLobby'])el(id).hidden=id!==name;}
  function bookmarks(){
    const list=el('lanResume');list.replaceChildren();
    for(const [code,s] of Object.entries(lanSeats()).reverse()){
      if(!lanRoomPattern.test(code))continue;
      const link=document.createElement('a');link.className='campaign-secondary';link.href='#lobby/'+code;
      link.textContent='Resume '+s.side+' · '+code;list.append(link);
    }
  }
  function roomView(p){
    packet=p;section('lanLobby');
    el('lanCode').textContent=p.code;el('lanSide').textContent='You control the '+p.side+'.';
    el('lanHostSeat').textContent=p.hostSide+' · Host';
    el('lanGuestSeat').textContent=(p.hostSide==='Axis'?'Allies':'Axis')+(p.joined?' · Joined':' · Waiting for player');
    el('lanShare').value=new URL('#join/'+p.code,location.href).href;
    el('lanInviteBlock').hidden=p.joined;
    el('lanStart').hidden=p.seat!==1||!!p.match;
    el('lanStart').disabled=!p.joined||working;
    el('lanEnter').hidden=!p.match;el('lanEnter').href='#room/'+p.code;
    el('lanStage').textContent=p.match?(p.match.victory?'Game over':'Round '+p.match.round+' · '+globalPowers[p.match.power]):p.joined?(p.seat===1?'Both players are ready.':'Waiting for the host to start.'):'Share the invite link or give the other player the room code.';
  }
  async function refreshLobby(){
    if(!lobby||document.hidden||checkingRoom||working)return;
    checkingRoom=true;
    try{
      const saved=lanSeats()[lobby];if(!saved)throw Error('Join this room from the invitation first.');
      const p=await lanRequest('rooms/'+lobby+(packet?'?since='+packet.revision:''),saved.token);
      if(p)roomView(p);
      notice('');
    }catch(err){notice(err.status?err.message:'Waiting for the computer hosting this room. Reconnecting…');}
    finally{checkingRoom=false;}
  }
  async function connectMenu(){
    if(checking)return;checking=true;
    try{
      if(!/^https?:$/.test(location.protocol))throw Error();
      const status=await lanRequest('lan');
      if(status.service!=='WarTable LAN')throw Error();
      if(status.version!==document.querySelector('meta[name="application-version"]').content){notice('Reload this page to match the host version.');return;}
      available=true;bookmarks();
      if(lobby&&lanSeats()[lobby]){section('lanLobby');await refreshLobby();}
      else if(invite||lobby){const code=invite||lobby;if(lanSeats()[code]){location.hash='lobby/'+code;return;}section('lanJoin');el('joinCode').value=code;}
      else section('lanChoose');
    }catch{section('lanSetup');}
    finally{checking=false;}
  }
  function act(fn){return async e=>{
    e.preventDefault();if(working||!available)return;working=true;const button=e.submitter||e.currentTarget;
    button.disabled=true;notice('');
    try{await fn();}catch(err){notice(err.status?err.message:'Could not reach the host. Check Wi-Fi and try again.');}
    finally{working=false;button.disabled=false;}
  };}
  async function takeSeat(code,side,research){
    const pending='wartable.lan.pending.'+(code||'host');
    let token=(code&&lanSeats()[code]?.token)||localStorage.getItem(pending)||lanToken();
    localStorage.setItem(pending,token);
    const p=await lanRequest(code?'rooms/'+code+'/join':'rooms',token,code?{}:{side,research});
    rememberSeat(p.code,{token,side:p.side});localStorage.removeItem(pending);location.hash='lobby/'+p.code;
  }
  el('lanCreateChoice').onclick=()=>{notice('');section('lanHost');};
  el('lanJoinChoice').onclick=()=>{notice('');section('lanJoin');el('joinCode').focus();};
  for(const b of document.querySelectorAll('[data-lan-back]'))b.onclick=()=>{notice('');if(page!=='multiplayer')location.hash='multiplayer';else section('lanChoose');};
  el('hostForm').onsubmit=act(()=>takeSeat(null,el('hostSide').value,el('hostResearch').checked));
  el('joinForm').onsubmit=act(()=>{
    const code=el('joinCode').value.trim().toUpperCase();
    if(!lanRoomPattern.test(code)){notice('Enter the 10-character code shown on the host’s phone.');return;}
    return takeSeat(code);
  });
  el('lanStart').onclick=act(async()=>{
    const p=await lanRequest('rooms/'+lobby+'/start',lanSeats()[lobby].token,{revision:packet.revision,id:lanToken()});roomView(p);location.hash='room/'+lobby;
  });
  el('lanCopy').onclick=async()=>{
    const field=el('lanShare');field.focus();field.select();
    try{if(navigator.clipboard)await navigator.clipboard.writeText(field.value);else if(!document.execCommand('copy'))throw Error();notice('Invite link copied.');}
    catch{notice('Select and copy the invite link, or share the room code.');}
  };
  el('lanAddressForm').onsubmit=e=>{
    e.preventDefault();
    try{
      const typed=el('lanAddress').value.trim(),url=new URL(typed.includes('://')?typed:'http://'+typed);
      if(url.protocol!=='http:'||url.username||url.password||!(/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(url.hostname)||url.hostname==='localhost'))throw Error();
      location.href=url.origin+'/#multiplayer';
    }catch{notice('Enter the IP address and port printed by the computer, such as 192.168.1.20:8080.');}
  };
  const tab=el('multiTab');tab.addEventListener('click',()=>{if(!available)connectMenu();});
  tab.addEventListener('focus',()=>{if(!available)connectMenu();});
  if(page==='multiplayer'||lobby||invite){selectTab(tab);connectMenu();}
  if(lobby){setInterval(()=>{if(available)refreshLobby();else if(!document.hidden)connectMenu();},1600);document.addEventListener('visibilitychange',refreshLobby);}
}
