// Global 1940 Second Edition political situations and declaration windows.
export const politicalPowers={
  Germans:'Germany',Russians:'Soviet Union',Japanese:'Japan',Americans:'United States',
  Chinese:'China',British:'United Kingdom',Italians:'Italy',ANZAC:'ANZAC',French:'France'
};
export function countryInSentence(power){
  return (['British','Americans','Russians'].includes(power)?'the ':'')+politicalPowers[power];
}
const axis=['Germans','Italians','Japanese'];
const europeanAxis=['Germans','Italians'];
const western=['British','UK_Pacific','ANZAC','French'];
const mainlandUS=['Eastern United States','Central United States','Western United States'];
const northAmerica=[...mainlandUS,'Alaska','British Columbia','Alberta Saskatchewan Manitoba','Ontario','Quebec',
  'Newfoundland Labrador','New Brunswick Nova Scotia','Mexico','Southeast Mexico','Central America'];

function relationRow(match,one,two){
  return match.diplomacy.find(([a,b])=>a===one&&b===two||a===two&&b===one);
}
export function atWarWith(match,a,b){return relationRow(match,a,b)?.[2]==='War';}
const fightingAxis=(m,p)=>axis.some(a=>atWarWith(m,p,a));
const chineseArea=(name,r)=>r.original==='Chinese'||name==='Burma'||name==='Kwangtung';
const axisHolds=(m,n)=>axis.includes(m.board[n]?.owner);
function enteredChineseArea(match,power){
  const areas=Object.entries(match.board).filter(([n,r])=>chineseArea(n,r));
  if(areas.some(([,r])=>r.units.some(([p,,n])=>p===power&&n>0)))return true;
  const names=new Set(areas.map(([n])=>n));
  return (match.turnReviews||[]).some(t=>t.power===power&&t.record.some(e=>e.title.includes(' → ')&&e.title.split(' → ').slice(1).some(n=>names.has(n))));
}
export function usIncomeChoice(match){
  return match.phase==='income'&&match.power==='Americans'&&match.round===3&&!fightingAxis(match,'Americans')&&!match.incomeReport?.stayedAtPeace;
}
export function declarationWindowOpen(match){
  const game=match.combat?.game;
  return usIncomeChoice(match)||(match.phase==='combatMove'&&game?.phase==='plan'&&!game.orders.length&&!game.rocketOrders?.length);
}
export function declarationTargets(match){
  const p=match.power;
  if(!declarationWindowOpen(match))return [];
  let targets;
  switch(p){
    case 'British':case 'ANZAC':case 'French':targets=['Japanese'];break;
    case 'Germans':case 'Italians':targets=['Russians','Americans','Chinese'];break;
    case 'Japanese':targets=['British','Americans','Russians','French'];break;
    case 'Russians':{
      const europe=match.round>=4||match.londonTakenByAxis||axisHolds(match,'United Kingdom')||europeanAxis.some(a=>atWarWith(match,p,a));
      targets=europe?[...europeanAxis,'Japanese']:['Japanese'];break;
    }
    case 'Chinese':targets=europeanAxis.filter(a=>enteredChineseArea(match,a));break;
    case 'Americans':{
      const canEnter=usIncomeChoice(match)||match.round>=4||fightingAxis(match,p)||match.japanUnprovokedWesternWar||
        match.usEntryByCapture||axisHolds(match,'United Kingdom')||northAmerica.some(n=>axisHolds(match,n));
      targets=canEnter?axis:[];break;
    }
    default:return [];
  }
  return targets.filter(t=>!atWarWith(match,p,t));
}
export function rememberPoliticalCaptures(match){
  if(!axis.includes(match.power))return;
  if(axisHolds(match,'United Kingdom'))match.londonTakenByAxis=true;
  if(match.londonTakenByAxis||northAmerica.some(n=>axisHolds(match,n)))match.usEntryByCapture=true;
}
export function declarationDetails(match,targets){
  const power=match.power,allowed=declarationTargets(match);
  if(!Array.isArray(targets)||!targets.length||new Set(targets).size!==targets.length||targets.some(t=>!allowed.includes(t)))
    throw Error('Choose an eligible power before issuing a declaration.');
  const pacific=power==='Japanese'&&targets.includes('British')||targets.includes('Japanese')&&['British','ANZAC'].includes(power);
  const namedTargets=power==='Japanese'&&pacific?targets.flatMap(t=>t==='British'?[t,'ANZAC']:[t]):targets;
  const names=new Intl.ListFormat('en').format(namedTargets.map(countryInSentence));
  const subject=countryInSentence(power);
  const title=subject[0].toUpperCase()+subject.slice(1)+' declares war on '+names;
  const effects=[];
  if(pacific){
    effects.push('Japan, the United Kingdom and ANZAC enter the Pacific war. Japan can attack Dutch territories.');
    if(power==='Japanese'&&!atWarWith(match,'Japanese','Americans')&&!targets.includes('Americans'))effects.push('The United States may declare war on its next turn. Japan loses eligibility for its American trade bonus.');
  }
  const usEnters=(targets.includes('Americans')||power==='Americans')&&!fightingAxis(match,'Americans');
  if(usEnters)effects.push('The United States enters the war. Its mainland minor industrial complexes upgrade for free, and wartime income objectives become available.');
  if((power==='Russians'&&targets.includes('Germans')||power==='Germans'&&targets.includes('Russians')))
    effects.push('Germany loses its 5 IPC Soviet trade bonus.');
  return {names,title,effects,pacific,usEnters};
}
function setPoliticalRelation(match,a,b,value){
  const row=relationRow(match,a,b);
  if(row)row[2]=value;
}
function alignAllies(match){
  const us=fightingAxis(match,'Americans'),soviet=fightingAxis(match,'Russians');
  for(const ally of western){
    if(us)setPoliticalRelation(match,'Americans',ally,'Allied');
    if(soviet)setPoliticalRelation(match,'Russians',ally,'Allied');
    if(atWarWith(match,ally,'Japanese'))setPoliticalRelation(match,'Chinese',ally,'Allied');
  }
  if(us&&soviet)setPoliticalRelation(match,'Americans','Russians','Allied');
  for(const p of ['Americans','Russians'])if(atWarWith(match,p,'Japanese'))setPoliticalRelation(match,p,'Chinese','Allied');
}
function upgradeUSComplexes(match){
  for(const name of mainlandUS){
    const id='world-'+name.toLowerCase().replaceAll(' ','-');
    for(const board of [match.board,match.combatStart]){
      const area=board?.[name];if(area?.owner!=='Americans')continue;
      const plant=area.units.find(([p,t,n])=>p==='Americans'&&t==='factory_minor'&&n);
      if(!plant)continue;
      plant[1]='factory_major';
      if(area.facilityDamage?.factory_minor){area.facilityDamage.factory_major=area.facilityDamage.factory_minor;delete area.facilityDamage.factory_minor;}
    }
    const piece=match.combat.game.pieces?.[id]?.find(([p,t,n])=>p==='Americans'&&t==='factory_minor'&&n);
    if(match.board[name].owner==='Americans'&&piece)piece[1]='factory_major';
  }
}
export function declareWar(match,targets){
  const {title,effects,pacific,usEnters}=declarationDetails(match,targets),next=structuredClone(match);
  for(const t of targets)setPoliticalRelation(next,next.power,t,'War');
  if(pacific){
    for(const ally of ['British','UK_Pacific','ANZAC','Dutch'])setPoliticalRelation(next,'Japanese',ally,'War');
    if(next.power==='Japanese')next.japanUnprovokedWesternWar=true;
  }
  alignAllies(next);
  if(usEnters)upgradeUSComplexes(next);
  next.combat.game.record.push({title,detail:effects.join(' ')||'The declaration took effect immediately.',declaration:true});
  if(next.phase==='combatMove')next.combat.game.refreshPoliticalForces=true;
  next.combat.ui={};
  return next;
}
