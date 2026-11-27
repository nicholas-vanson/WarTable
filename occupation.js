// Global 1940 Second Edition, “Liberating a Territory”, “Capturing and
// Liberating Capitals”, and the British regional economies and French troop bonus.
import {politicalPowers} from './politics.js';
export const homeCapitals={Germans:'Germany',Russians:'Russia',Japanese:'Japan',Americans:'Eastern United States',
  British:'United Kingdom',UK_Pacific:'India',Italians:'Southern Italy',ANZAC:'New South Wales',French:'France'};
const capitalCities={Germans:'Berlin',Russians:'Moscow',Japanese:'Tokyo',Americans:'Washington',British:'London',
  UK_Pacific:'Calcutta',Italians:'Rome',ANZAC:'Sydney',French:'Paris'};
const powerLabel=p=>p==='UK_Pacific'?politicalPowers.British:politicalPowers[p];
const walletLabel=p=>p==='British'?'UK Europe':p==='UK_Pacific'?'UK Pacific':politicalPowers[p];
const isAxis=p=>['Germans','Italians','Japanese'].includes(p);
const sameSide=(a,b)=>!!powerLabel(a)&&!!powerLabel(b)&&isAxis(a)===isAxis(b);
const facilityTypes=['factory_minor','factory_major','airfield','harbour'];

export function occupyTerritory(game,id,places,ids,captureWallet,priorFrenchAward){
  const {name,original}=places[id],power=game.power,capital=homeCapitals[original],isCapital=capital===name;
  const restore=sameSide(power,original)&&(isCapital||original==='Chinese'||game.owners[ids[capital]]===powerLabel(original));
  const owner=restore?original:captureWallet(name),previous=game.owners[id],nation=powerLabel(owner);
  function transfer(site,wallet,conquest){
    (game.controlChanges??={})[site]=wallet;
    game.owners[site]=powerLabel(wallet);
    for(const row of game.pieces[site]){
      if(!row[2]||!facilityTypes.includes(row[1]))continue;
      row[0]=wallet;
      if(wallet==='Chinese'&&places[site].original==='Chinese'&&row[1].startsWith('factory_'))row[2]=0;
      else if(conquest&&row[1]==='factory_major')row[1]='factory_minor';
    }
  }
  transfer(id,owner,true);
  if(isCapital&&restore){
    const returned=[];
    for(const [land,site] of Object.entries(ids)){
      if(site===id||places[site].original!==original||game.owners[site]===nation)continue;
      const holder=Object.keys(politicalPowers).find(p=>politicalPowers[p]===game.owners[site]);
      if(sameSide(holder,original)){transfer(site,original,false);returned.push(land);}
    }
    game.record.push({title:capitalCities[original]+' liberated',capital:true,
      detail:walletLabel(original)+' regains its capital and can collect income again.'+
        (returned.length?' Returned to '+nation+' control: '+returned.join(', ')+'.':'')});
    if(original==='French'&&!priorFrenchAward&&!game.frenchAward)game.frenchAward={status:'pending',draft:{}};
  }else if(isCapital&&previous===powerLabel(original)){
    game.record.push({title:capitalCities[original]+' captured',detail:'',capital:true,seizure:{from:original,to:owner}});
  }
  return restore?'Liberated for '+nation:'Captured by '+nation;
}

// Only new captures debit the match. A saved battle, an autosave, and a
// projected mobilization can all submit the same turn record more than once.
export function settleCapitalPayments(match,game){
  const entries=game.record.filter(e=>e.seizure);
  if(!entries.length)return;
  const paid=match.turnCapitalPayments??=[];
  for(const [i,entry] of entries.entries()){
    const {from,to}=entry.seizure;
    if(!paid[i]){
      const amount=match.treasury[from];
      match.treasury[from]=0;match.treasury[to]+=amount;
      paid.push({from,to,amount});
    }
    const {amount}=paid[i];
    entry.seizure.amount=amount;
    entry.detail=amount+' IPCs transferred from '+walletLabel(from)+' to '+walletLabel(to)+'. '+walletLabel(from)+' can collect income again after liberation.';
  }
}
export function reverseCapitalPayments(match){
  for(const {from,to,amount} of [...(match.turnCapitalPayments||[])].reverse()){
    match.treasury[to]-=amount;match.treasury[from]+=amount;
  }
  delete match.turnCapitalPayments;
}
