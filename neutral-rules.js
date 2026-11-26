// Global 1940 Second Edition, Europe pp. 10–11 and Global pp. 39–40.
import {places,exerciseOf} from './rules.js';

export const neutralOwners={
  Neutral_True:'Strict neutral',Mongolians:'Mongolia',Neutral_Allies:'Pro-Allied neutral',Neutral_Axis:'Pro-Axis neutral',
  Joined_Allies:'Allied-aligned, uncontrolled',Joined_Axis:'Axis-aligned, uncontrolled'
};
const neutralKeys=Object.fromEntries(Object.entries(neutralOwners).map(([key,label])=>[label,key]));
export const neutralKey=owner=>neutralKeys[owner];
export const strictKey=key=>key==='Neutral_True'||key==='Mongolians';
export const allianceOf=power=>['Germans','Italians','Japanese'].includes(power)?'Axis':'Allies';
const landTypes=['inf','tank','artillery','mech_infantry','aaGun'];

export function canEnterNeutral(power,enemies,region){
  if(power==='Chinese'||!enemies.size)return false;
  if(power==='Russians')return region.original==='Mongolians'?enemies.has('Japanese'):enemies.has('Germans')||enemies.has('Italians');
  return true;
}
export function hostileNeutral(power,key){
  return strictKey(key)||!!key&&!key.endsWith('_'+allianceOf(power));
}
function changeUncontrolledStatus(s,id,key){
  s.owners[id]=neutralOwners[key];
  for(const row of s.pieces[id])if(neutralOwners[row[0]])row[0]=key;
}
export function takeFriendlyControl(s,id,power,nation){
  s.owners[id]=nation;
  for(const row of s.pieces[id])if(neutralOwners[row[0]])row[0]=power;
}
export function invadeNeutrals(s){
  const {neighbors,friends}=exerciseOf(s);
  const entered=s.orders.flatMap(o=>o.via&&o.units.tank?[o.via,o.to]:[o.to]);
  const attacked=[...new Set(entered.filter(id=>!friends[s.power].includes(s.owners[id])))];
  const strict=attacked.filter(id=>strictKey(neutralKey(s.owners[id])));
  const mongo=id=>places[id].original==='Mongolians';
  const bordersMongolia=id=>neighbors[id].some(mongo);
  const opposing=allianceOf(s.power)==='Axis'?'Allies':'Axis';
  if(s.power==='Russians'&&Object.keys(s.owners).some(id=>mongo(id)&&strictKey(neutralKey(s.owners[id])))&&
      attacked.some(id=>places[id].name==='Korea'||s.owners[id]==='Japan'&&bordersMongolia(id)))s.mongolianPactBroken=true;
  if(s.power==='Japanese'&&!s.mongolianPactBroken&&attacked.some(id=>s.owners[id]==='Soviet Union'&&bordersMongolia(id)))s.mongolianPactDue=true;
  if(strict.length){
    const sovietInvasion=s.power==='Russians'&&strict.some(mongo);
    for(const id of Object.keys(s.owners)){
      if(!strictKey(neutralKey(s.owners[id]))||attacked.includes(id))continue;
      if(mongo(id)&&opposing==='Axis'&&!sovietInvasion)continue;
      changeUncontrolledStatus(s,id,'Neutral_'+opposing);
    }
    s.record.push({title:'Strict neutrality violated',detail:exerciseOf(s).attacker+' attacked '+strict.map(id=>places[id].name).join(', ')+'. Eligible remaining strict neutrals now favor the '+opposing+'.'});
  }
  for(const id of attacked){
    const key=neutralKey(s.owners[id]);
    if(!key||key.startsWith('Joined_'))continue;
    changeUncontrolledStatus(s,id,'Joined_'+opposing);
    s.record.push({title:places[id].name+' joined the '+opposing,detail:'Its standing army defends. Control goes to the invader only on capture.'});
  }
}
export function settleMongolianPact(s){
  if(!s.mongolianPactDue)return;
  for(const id of Object.keys(s.owners)){
    if(places[id].original==='Mongolians'&&['Mongolians','Neutral_Allies','Joined_Allies'].includes(neutralKey(s.owners[id]))){
      takeFriendlyControl(s,id,'Russians','Soviet Union');
      s.record.push({title:places[id].name,detail:'Entered Soviet control under the Mongolian defense pact.'});
    }
  }
  s.mongolianPactDue=false;
}
export function activationOptions(s,to){
  if(s.exercise!=='global'||s.phase!=='review')return [];
  const key=neutralKey(s.owners[to]),ex=exerciseOf(s);
  if(!key||hostileNeutral(s.power,key)||!ex.neutralEntry[to])return [];
  const options=[];
  for(const from of ex.neighbors[to]){
    for(const [type,opening] of Object.entries(ex.unmovedLand[from]||{})){
      const spent=s.orders.filter(o=>o.from===from).reduce((n,o)=>n+(o.units[type]||0),0)+(s.activationMoves?.[from]?.[type]||0);
      const present=s.pieces[from].filter(([p,t])=>p===s.power&&t===type).reduce((n,row)=>n+row[2],0);
      const available=Math.min(opening-spent,present);
      if(available>0)options.push({from,type,available});
    }
  }
  return options;
}
export function openingLand(stacks,power){
  const units={};
  for(const [p,type,n] of stacks)if(p===power&&landTypes.includes(type))units[type]=(units[type]||0)+n;
  return units;
}
export function activateFriendly(s,to,from,type,quantity){
  const option=activationOptions(s,to).find(o=>o.from===from&&o.type===type);
  if(!option||!Number.isSafeInteger(quantity)||quantity<1||quantity>option.available)throw Error('Choose available land units adjacent to this friendly territory.');
  const nation=exerciseOf(s).attacker;
  let remaining=quantity;
  for(const stack of s.pieces[from]){
    if(stack[0]!==s.power||stack[1]!==type)continue;
    const moved=Math.min(remaining,stack[2]);stack[2]-=moved;remaining-=moved;
  }
  if(type in s.units[from])s.units[from][type]-=quantity;
  takeFriendlyControl(s,to,s.power,nation);
  let arrival=s.pieces[to].find(([p,t])=>p===s.power&&t===type);
  if(!arrival){arrival=[s.power,type,0];s.pieces[to].push(arrival);}
  arrival[2]+=quantity;s.units[to][type]=(s.units[to][type]||0)+quantity;
  s.activationMoves??={};
  const spent=s.activationMoves[from]??={};spent[type]=(spent[type]||0)+quantity;
  s.record.push({title:places[to].name+' activated by '+nation,detail:quantity+' land unit'+(quantity===1?'':'s')+' entered from '+places[from].name+'. Surviving local forces are now under '+nation+' control.'});
}
