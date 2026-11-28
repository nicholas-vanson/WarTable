// Count committed pieces in their current location, including units held by a
// battle or transport between departure and placement back on the board.
import {stats,aircraft,ships,exerciseOf,theaterVictoryCities} from './rules.js';
import {globalPowers,boardUnitType,seasonForRound} from './global-game.js';
import {globalCities,victorySide,victoryStatus} from './victory.js';
import {nationalObjectiveAccounts} from './income.js';
import {esc} from './field-guide.js';

function emptyWarSide(){
  return {cities:[],landIncome:0,bonus:0,income:0,treasury:0,territories:0,land:0,air:0,sea:0,military:0};
}
function addWarUnit(side,type,n){
  type=boardUnitType(type);
  if(!side||!stats[type]||!n)return;
  const branch=aircraft.includes(type)?'air':ships.includes(type)?'sea':'land';
  side[branch]+=n;
  side.military+=stats[type].cost*n;
}
function addWarForce(side,units){
  for(const [type,n] of Object.entries(units))addWarUnit(side,type,n);
}
function addBattleForces(sides,game,attackerSide){
  for(const battle of game.battles||[]){
    if(battle.resolved)continue;
    addWarForce(sides[attackerSide],battle.attack);
    for(const boat of battle.boats||[])addWarForce(sides[victorySide(boat.power)],boat.units);
  }
  // Raid and scramble survivors are returned together when noncombat begins.
  if(game.phase==='combat'||game.phase==='review'){
    for(const raid of game.raids||[]){
      for(const plane of raid.planes)if(!plane.lost)addWarUnit(sides[attackerSide],plane.type,1);
      for(const f of raid.interceptors)addWarUnit(sides[victorySide(f.power)],'fighter',f.remaining);
    }
    for(const f of game.scrambles||[])addWarUnit(sides[victorySide(f.power)],f.type,f.remaining);
  }
  // An aircraft with a provisional base is already on the board. Only an
  // airborne aircraft awaiting a landing still needs to be counted separately.
  if(['combat','review','noncombat'].includes(game.phase)){
    for(const f of game.landedFlights||[])if(!f.base)addWarUnit(sides[attackerSide],f.type,f.count);
  }
}

export function globalWarStatus(match){
  const sides={Allies:emptyWarSide(),Axis:emptyWarSide()},production=new Map();
  for(const area of Object.values(match.board)){
    if(area.ipc>0)production.set(area.owner,(production.get(area.owner)||0)+area.ipc);
    for(const [p,type,n] of area.units)addWarUnit(sides[victorySide(p)],type,n);
    for(const boat of area.embarked||[])addWarForce(sides[victorySide(boat.power)],boat.units);
  }
  for(const power of Object.keys(globalPowers)){
    const side=sides[victorySide(power)];
    for(const a of nationalObjectiveAccounts(match,power)){
      if(a.open)side.landIncome+=production.get(a.wallet)||0;
      side.bonus+=a.bonus;
      side.treasury+=match.treasury[a.wallet]||0;
    }
    side.income=side.landIncome+side.bonus;
  }
  for(const [name,territory] of globalCities){
    const side=sides[victorySide(match.board[territory]?.owner)];
    if(side)side.cities.push(name);
  }
  if(match.combat?.game)addBattleForces(sides,match.combat.game,victorySide(match.power));
  const goals=victoryStatus(match).map(goal=>{
    const hold=goal.cities.length>=goal.need&&match.victoryHolds?.[goal.key];
    return {...goal,hold};
  });
  return {sides,goals,global:true,context:seasonForRound(match.round)+' · Round '+match.round,
    turn:match.victory?match.victory.side+' victory':globalPowers[match.power]+' to move'};
}
export function exerciseWarStatus(game){
  const exercise=exerciseOf(game),sides={Allies:emptyWarSide(),Axis:emptyWarSide()};
  const byNation=Object.fromEntries(Object.entries(globalPowers).map(([p,name])=>[name,victorySide(p)]));
  for(const [id,units] of Object.entries(game.units)){
    const side=sides[byNation[game.owners[id]]];
    if(side){side.territories++;addWarForce(side,units);}
  }
  for(const city of theaterVictoryCities){
    const side=sides[byNation[game.owners[city.territory]]];
    if(side)side.cities.push(city.name);
  }
  addBattleForces(sides,game,byNation[exercise.attacker]);
  return {sides,global:false,context:exercise.name+' exercise',turn:exercise.attacker+' vs '+exercise.defender};
}

const warNumber=n=>n.toLocaleString('en-US');
function warBreakdown(label,left,right){
  return '<tr><td>'+warNumber(left)+'</td><th scope="row">'+label+'</th><td>'+warNumber(right)+'</td></tr>';
}
function warTable(caption,rows){
  return '<table class="war-breakdown" aria-label="'+caption+'"><thead><tr><th scope="col">Allies</th><td></td><th scope="col">Axis</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
function warMetric(id,label,unit,left,right,detail,opened){
  const share=left+right?100*left/(left+right):0;
  const contents='<span class="war-reading"><b>'+warNumber(left)+'</b><span>'+label+(detail?' <i aria-hidden="true"></i>':'')+
    '</span><b>'+warNumber(right)+'</b></span><span class="war-track'+(left&&right?' split':'')+'" aria-hidden="true">'+
    (left+right?'<span style="width:'+share+'%"></span>':'')+'</span><small>'+unit+'</small>';
  const accessible=esc(label+', Allies '+warNumber(left)+', Axis '+warNumber(right)+'. '+unit);
  if(!detail)return '<div class="war-metric" role="group" aria-label="'+accessible+'">'+contents+'</div>';
  return '<details class="war-metric" data-metric="'+id+'"'+(opened?' open':'')+'><summary aria-label="'+accessible+'">'+contents+'</summary>'+
    '<div class="war-detail">'+detail+'</div></details>';
}
export function warStatusChart(report){
  const {Allies:a,Axis:x}=report.sides;
  const goalLines=(report.goals||[]).map(g=>'<li><span>'+esc(g.side+' · '+g.name)+'</span><strong>'+g.cities.length+' / '+g.need+'</strong>'+
    (g.hold?'<small>Hold until '+esc(globalPowers[g.hold.power])+'’s turn in round '+(g.hold.round+1)+'.</small>':'')+'</li>').join('');
  const cityLists='<div class="war-cities">'+[a,x].map((s,i)=>'<div><strong>'+(i?'Axis':'Allies')+'</strong><p>'+esc(s.cities.join(', ')||'None held')+'</p></div>').join('')+'</div>';
  let html='<div class="war-context"><span>'+esc(report.context)+'</span><span>'+esc(report.turn)+'</span></div>'+
    '<div class="war-legend"><strong>Allies</strong><strong>Axis</strong></div>';
  html+=warMetric('cities','Victory cities',report.global?'Cities held worldwide':'Cities on this exercise map',a.cities.length,x.cities.length,
    (goalLines?'<ul class="war-goals">'+goalLines+'</ul><p>Hold the required cities until the start of the capturing power’s next turn, with at least one home capital still held.</p>':'')+cityLists);
  if(report.global){
    const budget=warBreakdown('Territory income',a.landIncome,x.landIncome)+warBreakdown('National objectives',a.bonus,x.bonus)+
      warBreakdown('IPC treasury',a.treasury,x.treasury);
    html+=warMetric('income','Projected income','IPCs per round · land and bonuses',a.income,x.income,warTable('Income and treasury in IPCs',budget)+
      '<p>Each open treasury collects from its territories and qualifying objectives. Convoy losses and War Bonds are settled at collection. Treasury shows cash already held.</p>');
  }else html+=warMetric('territories','Territories held','Land spaces on this exercise map',a.territories,x.territories);
  const forces=warBreakdown('Land units',a.land,x.land)+warBreakdown('Aircraft',a.air,x.air)+warBreakdown('Ships',a.sea,x.sea);
  return html+warMetric('military','Military value','Active units at standard IPC cost',a.military,x.military,warTable('Unit counts by branch',forces)+
    '<p>Counts include surviving units in battle or transport. Facilities and unplaced purchases are excluded.</p>',true)+
    (report.global?'<p class="war-footnote">Powers count toward their side even before they enter the war.</p>':'<p class="war-footnote">This exercise tracks local forces and territory. Income is collected in Global 1940 games.</p>');
}
