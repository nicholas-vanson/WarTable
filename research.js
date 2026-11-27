// Global 1940 Second Edition, optional Research and Development.
import {spendingEconomies,purchaseCapitalAvailable} from './global-game.js';
import {die} from './rules.js';
export const breakthroughs=[
  [['artillery','Advanced Artillery','Each artillery supports up to two infantry or mechanized infantry.'],
   ['rockets','Rockets','Each operational air base you control can roll one die of facility damage within four spaces.'],
   ['paratroopers','Paratroopers','Up to two infantry per friendly operational air base may fly up to three spaces to support a land attack.'],
   ['factories','Increased Factory Production','Major complexes produce 12 units and minor complexes 4. Each IPC repairs up to two industrial damage.'],
   ['bonds','War Bonds','Roll one die for additional IPCs when collecting income.'],
   ['mechanized','Improved Mechanized Infantry','Mechanized infantry can blitz independently and attack at 2 with tank or artillery support.']],
  [['submarines','Super Submarines','Submarines attack at 3, including surprise strikes.'],
   ['jets','Jet Fighters','Fighters attack at 4 and hit on 1–2 when escorting or intercepting a raid.'],
   ['shipyards','Improved Shipyards','Battleships cost 17, carriers 13, cruisers 9, destroyers 7, transports 6 and submarines 5 IPCs.'],
   ['radar','Radar','Antiaircraft artillery and facility defenses hit on 1–2.'],
   ['range','Long-Range Aircraft','All aircraft gain one movement point.'],
   ['heavy','Heavy Bombers','Attacking strategic bombers roll twice and keep the better die for combat or facility damage.']]
];
export function hasTech(source,power,id){return !!source?.technology?.[power==='UK_Pacific'?'British':power]?.includes(id);}
export function researchWallets(match){return spendingEconomies(match).filter(w=>purchaseCapitalAvailable(match,w));}
export function canResearch(match){
  return match.researchEnabled!==false&&match.power!=='Chinese'&&breakthroughs.some(chart=>chart.some(([id])=>!hasTech(match,match.power,id)))&&
    researchWallets(match).reduce((n,w)=>n+match.treasury[w],0)>=5;
}
export function buyResearch(match,dice,pacific=0,random=die){
  if(match.phase!=='research'||match.researchRoll||!canResearch(match)||!Number.isSafeInteger(dice)||dice<1||
    !Number.isSafeInteger(pacific)||pacific<0||pacific>5*dice||match.power!=='British'&&pacific)throw Error('Choose an affordable research order.');
  const paid={[match.power]:dice*5-pacific};
  if(pacific)paid.UK_Pacific=pacific;
  for(const [w,n] of Object.entries(paid))if(n&&(!researchWallets(match).includes(w)||match.treasury[w]<n))throw Error('This treasury cannot fund that many dice.');
  const rolls=Array.from({length:dice},()=>random());
  for(const [w,n] of Object.entries(paid))match.treasury[w]-=n;
  match.researchRoll={paid,rolls,step:rolls.includes(6)?'chart':'done'};
}
export function discover(match,index,random=die){
  const chart=breakthroughs[index],r=match.researchRoll;
  if(match.phase!=='research'||r?.step!=='chart'||!chart||!chart.some(([id])=>!hasTech(match,match.power,id)))throw Error('Choose a chart with an undiscovered advance.');
  const rolls=[];let tech;
  do{const face=random();rolls.push(face);tech=chart[face-1];}while(hasTech(match,match.power,tech[0]));
  const owned=(match.technology??={})[match.power]??=[];owned.push(tech[0]);
  Object.assign(r,{chart:index,breakthroughRolls:rolls,advance:tech[0],step:'done'});
}
export function finishResearch(match,game){
  const r=match.researchRoll;
  if(match.phase!=='research'||r&&r.step!=='done')throw Error('Resolve the breakthrough before purchasing units.');
  if(r){
    const found=breakthroughs.flat().find(([id])=>id===r.advance);
    game.record.push({research:true,title:found?'Research · '+found[1]:'Research · No breakthrough',
      detail:Object.entries(r.paid).filter(([,n])=>n).map(([w,n])=>n+' IPCs spent'+(match.power==='British'?' from UK '+(w==='British'?'Europe':'Pacific'):'')).join(' and ')+'. Research rolls '+r.rolls.join(', ')+'.'+(found?' Chart '+(r.chart+1)+' rolled '+r.breakthroughRolls.join(', ')+'. '+found[2]:'')});
  }
  delete match.researchRoll;match.phase='purchase';
}
export function technologyRoll(random,twice,high=false){
  const first=random();if(!twice)return {face:first};
  const second=random();return {face:high?Math.max(first,second):Math.min(first,second),rolls:[first,second]};
}
