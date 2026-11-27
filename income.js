// Global 1940 Second Edition, Europe pp. 23–24 and the Global national objectives.
// Printed convoy symbols from the board's Global 1940 Second Edition scenario.
import {declareWar,usIncomeChoice,rememberPoliticalCaptures} from './politics.js';
import {capitals,purchaseCapitalAvailable,spendingEconomies,purchaseGroups,burmaRoadOpen,nextPlaytestTurn} from './global-game.js';
const convoyZones=[1,6,10,19,20,26,35,36,37,39,41,42,43,44,54,62,63,70,71,72,80,82,85,89,93,97,98,99,101,105,106,109,119,125];
const axisPowers=['Germans','Italians','Japanese'];
const alliedPowers=['British','UK_Pacific','ANZAC','French','Chinese','Americans','Russians'];
const warships=['battleship','cruiser','destroyer','carrier','submarine'];
const canonical=p=>p==='UK_Pacific'?'British':p;
function related(match,a,b,relation){
  a=canonical(a);b=canonical(b);
  return match.diplomacy.some(([x,y,r])=>r===relation&&(x===a&&y===b||x===b&&y===a));
}
const incomeWar=(match,a,b)=>related(match,a,b,'War');
function attackedIndochina(match){
  if(match.japanAttackedIndochina||match.board['French Indo China'].owner==='Japanese')return true;
  const current=match.combat?.game;
  if(current?.power==='Japanese'&&current.battles?.some(b=>b.to==='world-french-indo-china'))return true;
  // Pre-income saves already have the committed routes in each power's journal.
  return (match.turnReviews||[]).some(turn=>turn.power==='Japanese'&&turn.record.some(e=>e.title.endsWith(' → French Indo China')));
}
function incomeObjectives(match,wallet){
  const board=match.board,rows=[],power=match.power;
  const own=name=>board[name].owner===wallet,axis=name=>axisPowers.includes(board[name].owner);
  const allied=name=>alliedPowers.includes(board[name].owner);
  const war=other=>incomeWar(match,power,other);
  const atWar=[...axisPowers,...alliedPowers].some(war),europe=war('Germans')||war('Italians');
  const original=owner=>Object.keys(board).filter(n=>board[n].original===owner);
  const present=(name,test)=>board[name].units.some(([p,t,n])=>n>0&&test(p,t));
  const landAt=name=>present(name,(p,t)=>p===power&&purchaseGroups.Land.includes(t));
  function add(label,value,met,condition,key){
    rows.push({label,value,earned:met?value:0,condition,...(key?{key}:{})});
  }
  function group(label,value,active,names,controls,condition){
    const missing=names.filter(n=>!controls(n));
    add(label,value,active&&!missing.length,condition+(active&&missing.length?' Still needed: '+missing.join(', ')+'.':''));
  }
  function each(label,value,active,names,controls,condition){
    const held=names.filter(controls);
    rows.push({label,value,earned:active?value*held.length:0,condition:condition+
      (held.length?' Qualifying territories: '+held.join(', ')+'.':'')});
  }
  const oil=['Iraq','Persia','Northwest Persia'];
  switch(wallet){
    case 'Germans':{
      const west=war('British')&&war('French');
      add('Soviet trade',5,!war('Russians'),'Germany and the Soviet Union are at peace.');
      add('Swedish iron ore',5,west&&own('Denmark')&&own('Norway')&&!allied('Sweden')&&!['Neutral_Allies','Joined_Allies'].includes(board.Sweden.owner),
        'At war with Britain and France. Germany holds Denmark and Norway, and Sweden remains outside Allied control or alignment.');
      each('Soviet cities',5,war('Russians'),['Novgorod','Volgograd','Russia'],own,'At war with the Soviet Union. Earn 5 IPCs per German-held city territory.');
      add('Caucasus oil',5,war('Russians')&&axis('Caucasus'),'At war with the Soviet Union and the Axis holds Caucasus.');
      add('Gateway to Egypt',5,west&&axis('Egypt')&&landAt('Egypt'),'At war with Britain and France, with German land units in Axis-held Egypt.');
      each('Middle East oil',2,west,oil,own,'At war with Britain and France. Earn 2 IPCs each for holding Iraq, Persia or Northwest Persia.');
      break;
    }
    case 'Russians':{
      const guests=original('Russians').some(n=>present(n,(p)=>p!=='Russians'&&alliedPowers.includes(p)));
      const blocked=present('125 Sea Zone',(p,t)=>axisPowers.includes(p)&&warships.includes(t));
      add('Arctic lend-lease',5,europe&&own('Archangel')&&!blocked&&!guests,'At war in Europe, with Soviet control of Archangel, no Axis warships in sea zone 125 and no other Allied units on original Soviet soil.');
      const targets=Object.keys(board).filter(n=>['Germans','Italians','Neutral_Axis'].includes(board[n].original));
      each('Soviet territorial gains',3,europe,targets,own,'At war in Europe. Earn 3 IPCs for each originally German, Italian or pro-Axis territory under Soviet control.');
      add('First capture of Berlin',10,europe&&own('Germany')&&!match.berlinBonusPaid,
        match.berlinBonusPaid?'Paid on an earlier turn.':'One-time award for Soviet control of Germany while at war in Europe.','berlin');
      break;
    }
    case 'Japanese':{
      const west=['Americans','British','ANZAC','French'].some(war);
      add('American trade',10,!war('Americans')&&!attackedIndochina(match)&&!match.japanUnprovokedWesternWar,
        'At peace with the United States, with no Japanese attack on French Indo China or unprovoked Japanese declaration against Britain or ANZAC.');
      group('Pacific island perimeter',5,west,['Guam','Midway','Wake Island','Gilbert Islands','Solomon Islands'],axis,'At war with the Western Allies. The Axis holds all five perimeter islands.');
      each('Allied power centers',5,west,['India','New South Wales','Hawaiian Islands','Western United States'],axis,'At war with the Western Allies. Earn 5 IPCs each for Axis control of Calcutta, Sydney, Honolulu or San Francisco.');
      group('East Indies resources',5,west,['Sumatra','Java','Borneo','Celebes'],axis,'At war with the Western Allies. The Axis holds all four resource islands.');
      break;
    }
    case 'Americans':
      group('Continental United States',10,atWar,['Eastern United States','Central United States','Western United States'],own,'At war and in control of all three mainland U.S. territories.');
      group('Pacific territories',5,atWar,['Alaska','Aleutian Islands','Hawaiian Islands','Johnston Island','Line Islands'],own,'At war and in control of Alaska and all four outlying island groups.');
      group('American defense treaties',5,atWar,['Mexico','Southeast Mexico','Central America','West Indies'],own,'At war and in control of Mexico, Southeast Mexico, Central America and the West Indies.');
      add('Philippines',5,atWar&&own('Philippines'),'At war and in control of the Philippines.');
      add('Allied cooperation in France',5,atWar&&landAt('France'),'At war with at least one U.S. land unit in France.');
      break;
    case 'Chinese':
      add('Burma Road',6,atWar&&burmaRoadOpen(board),'China is at war and the Allies hold India, Burma, Yunnan and Szechwan.');
      break;
    case 'British':
      group('European empire',5,europe,original('British'),own,'At war in Europe and in control of every original UK Europe territory.');
      break;
    case 'UK_Pacific':
      group('Far East trade',5,war('Japanese'),['Kwangtung','Malaya'],own,'At war with Japan and in control of Kwangtung and Malaya.');
      break;
    case 'Italians':{
      const med=Array.from({length:8},(_,i)=>(92+i)+' Sea Zone');
      const enemySurface=med.some(n=>present(n,(p,t)=>alliedPowers.includes(p)&&['carrier','battleship','cruiser','destroyer'].includes(t)));
      add('Mediterranean sea lanes',5,atWar&&!enemySurface,'At war with no Allied surface warships in sea zones 92–99.');
      const ports=['Gibraltar','Southern France','Greece','Egypt'];
      add('Mediterranean strongholds',5,atWar&&ports.filter(axis).length>=3,'At war. The Axis holds at least three of Gibraltar, Southern France, Greece and Egypt.');
      group('North Africa',5,atWar,['Morocco','Algeria','Tunisia','Libya','Tobruk','Alexandria'],axis,'At war and the Axis holds all six North African territories.');
      each('Middle East oil',2,atWar,oil,own,'At war. Earn 2 IPCs each for Italian control of Iraq, Persia or Northwest Persia.');
      break;
    }
    case 'ANZAC':
      add('Defense of Malaya',5,war('Japanese')&&allied('Malaya')&&original('ANZAC').every(own),'At war with Japan. The Allies hold Malaya and ANZAC holds all of its original territories.');
      group('South Pacific perimeter',5,war('Japanese'),['Dutch New Guinea','New Guinea','New Britain','Solomon Islands'],allied,'At war with Japan. Allied powers hold all four islands.');
      break;
  }
  return rows;
}
function convoyRaids(match,territories){
  const held=new Set(territories.map(t=>t.name)),raids=[];
  for(const zone of convoyZones){
    const area=match.board[zone+' Sea Zone'],coasts=area.coasts.filter(n=>held.has(n));
    if(!coasts.length)continue;
    const enemies=area.units.filter(([p,,n])=>n>0&&incomeWar(match,match.power,p));
    if(!enemies.some(([,t])=>warships.includes(t)))continue;
    const decks=new Map(),dice=[];
    for(const [p,t,n] of area.units)if(t==='carrier')decks.set(p,(decks.get(p)||0)+n);
    for(const [p,n] of decks)decks.set(p,2*Math.max(0,n-(area.shipDamage?.[p]?.carrier||0)));
    for(const [power,type,n] of enemies){
      let count=n,per=1;
      if(type==='fighter'||type==='tactical_bomber'){
        count=0;per=2;
        for(const [carrier,spaces] of decks){
          if(canonical(power)!==canonical(carrier)&&!related(match,power,carrier,'Allied'))continue;
          const assigned=Math.min(spaces,n-count);
          count+=assigned;decks.set(carrier,spaces-assigned);
        }
      }else if(type==='submarine')per=2;
      else if(!['cruiser','battleship','destroyer'].includes(type))continue;
      if(count)dice.push({power,type,count,number:count*per});
    }
    if(dice.length)raids.push({zone,coasts,dice,loss:0,charges:{}});
  }
  return raids;
}
// Match each point rolled to at most one printed coastal IPC. Reassign an earlier
// charge if its zone has another eligible coast, so overlapping zones never over- or under-charge.
function applyConvoyCaps(account){
  const seats=new Map(account.territories.map(t=>[t.name,Array(t.value).fill(null)]));
  function charge(raid,seen){
    for(const name of raid.coasts){
      if(seen.has(name))continue;
      seen.add(name);
      const slots=seats.get(name),free=slots.indexOf(null);
      if(free!==-1){slots[free]=raid;return true;}
      for(let i=0;i<slots.length;i++)if(charge(slots[i],seen)){slots[i]=raid;return true;}
    }
    return false;
  }
  for(const raid of account.convoys){
    for(let n=0;n<raid.rolled;n++)if(!charge(raid,new Set()))break;
  }
  for(const [name,slots] of seats)for(const raid of slots)if(raid){
    raid.loss++;raid.charges[name]=(raid.charges[name]||0)+1;
  }
}
function accountStatement(match,wallet){
  const territories=Object.entries(match.board).filter(([,a])=>a.owner===wallet&&a.ipc>0)
    .map(([name,area])=>({name,value:area.ipc})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
  const open=purchaseCapitalAvailable(match,wallet);
  const objectives=open?incomeObjectives(match,wallet):[];
  const land=open?territories.reduce((sum,t)=>sum+t.value,0):0;
  const bonus=objectives.reduce((sum,o)=>sum+o.earned,0);
  return {wallet,capital:capitals[wallet],open,before:match.treasury[wallet],territories,objectives,land,bonus,
    convoys:open&&wallet!=='Chinese'?convoyRaids(match,territories):[],loss:0};
}
export function incomeAmount(account){return account.land+account.bonus-account.loss;}
function makeStatement(match){
  const accounts=spendingEconomies(match).map(wallet=>accountStatement(match,wallet));
  return {power:match.power,round:match.round,accounts,rolled:accounts.every(a=>!a.convoys.length)};
}
export function openIncome(match){
  if(match.phase!=='mobilize'||match.combat?.game.phase!=='mobilize')throw Error('Finish mobilization before reviewing income.');
  match.phase='income';match.combat.game.phase='income';match.combat.ui={};
  if(match.power==='Japanese'&&attackedIndochina(match))match.japanAttackedIndochina=true;
  rememberPoliticalCaptures(match);
  match.incomeReport=makeStatement(match);
  return match;
}
// A 0.1.88 save can already have a pending or rolled Chinese convoy. Its treasury
// has not yet been credited. Completed receipts remain the record of the old turn.
export function restoreChineseStatement(match){
  for(const turn of match.turnReviews||[]){
    if(turn.power!=='Chinese'||turn.record.some(e=>e.chinaConvoyRefund))continue;
    const paid=turn.record.find(e=>e.income)?.income.accounts.find(a=>a.wallet==='Chinese')?.loss||0;
    if(!paid)continue;
    match.treasury.Chinese+=paid;
    const pending=match.incomeReport?.accounts.find(a=>a.wallet==='Chinese');
    if(pending)pending.before+=paid;
    turn.record.push({title:'Chinese convoy refund',detail:paid+' IPCs returned to China for an earlier convoy deduction.',chinaConvoyRefund:paid});
  }
  if(match.phase!=='income'||match.power!=='Chinese')return;
  const report=match.incomeReport,account=report?.accounts.find(a=>a.wallet==='Chinese');
  if(account){account.convoys=[];account.loss=0;report.rolled=true;}
}
export function confirmPoliticalChoice(match,targets){
  if(!targets.length){
    if(!usIncomeChoice(match))throw Error('The income declaration window is closed.');
    const next=structuredClone(match);
    next.incomeReport.stayedAtPeace=true;
    return next;
  }
  const next=declareWar(match,targets);
  if(next.phase==='income')next.incomeReport=makeStatement(next);
  return next;
}
export function rollConvoys(match,random=Math.random){
  if(match.phase!=='income'||!match.incomeReport||match.incomeReport.rolled)throw Error('There are no pending convoy rolls.');
  const next=structuredClone(match);
  for(const account of next.incomeReport.accounts){
    for(const raid of account.convoys){
      raid.rolled=0;
      for(const group of raid.dice){
        group.rolls=Array.from({length:group.number},()=>1+Math.floor(random()*6));
        raid.rolled+=group.rolls.reduce((sum,n)=>sum+(n<=3?n:0),0);
      }
    }
    applyConvoyCaps(account);
    account.loss=account.convoys.reduce((sum,r)=>sum+r.loss,0);
  }
  next.incomeReport.rolled=true;
  return next;
}
export function collectIncome(match){
  if(usIncomeChoice(match))throw Error('Choose whether to enter the war before collecting income.');
  const report=match.incomeReport;
  if(match.phase!=='income'||match.combat?.game.phase!=='income'||!report?.rolled||report.power!==match.power||report.round!==match.round)
    throw Error('Finish reviewing income and resolving convoys before collecting.');
  const next=structuredClone(match);
  for(const a of report.accounts){
    if(next.treasury[a.wallet]!==a.before)throw Error('The treasury changed. Reopen this turn.');
    next.treasury[a.wallet]+=incomeAmount(a);
    if(a.objectives.some(o=>o.key==='berlin'&&o.earned))next.berlinBonusPaid=true;
  }
  next.combat.game.phase='incomeCollected';
  next.combat.game.record.push({title:'Income collected',detail:'',income:next.incomeReport});
  delete next.incomeReport;
  return nextPlaytestTurn(next);
}
