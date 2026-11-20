// The local exercise models adjacent overland attacks with infantry and tanks.
export const places = {
  hb: {name:'Holland Belgium', owner:'Germany', targets:['fr','nb'], lon:5.0, lat:51.6},
  wg: {name:'Western Germany', owner:'Germany', targets:['fr'], lon:8.9, lat:50.6},
  nb: {name:'Normandy Bordeaux', owner:'France', targets:[], lon:-.8, lat:47.45},
  fr: {name:'France', owner:'France', targets:[], lon:2.65, lat:48.45}
};
Object.assign(places,{
  ni:{name:'Northern Italy',owner:'Italy',targets:['af','sf']},
  af:{name:'France',owner:'France',targets:[]},
  sf:{name:'Southern France',owner:'France',targets:[]},
  bs:{name:'Baltic States',owner:'Soviet Union',targets:['pl']},
  ep:{name:'Eastern Poland',owner:'Soviet Union',targets:['pl','ro']},
  be:{name:'Bessarabia',owner:'Soviet Union',targets:['ro']},
  pl:{name:'Poland',owner:'Germany',targets:[]},
  ro:{name:'Romania',owner:'Germany',targets:[]}
});
export const exercises={
  west:{name:'Western Front',attacker:'Germany',defender:'France',camera:{x:590,y:985,z:1},
    forces:{hb:[5,2],wg:[4,3],nb:[2,0],fr:[3,1]}},
  alps:{name:'Alpine Front',attacker:'Italy',defender:'France',camera:{x:665,y:1175,z:1.28},
    forces:{ni:[7,3],af:[3,1],sf:[2,1]}},
  east:{name:'Eastern Front',attacker:'Soviet Union',defender:'Germany',camera:{x:1255,y:943,z:.72},
    forces:{bs:[4,2],ep:[6,3],be:[4,1],pl:[4,2],ro:[3,2]}}
};
export const exerciseOf=s=>exercises[s.exercise||'west'];
export const adjectives={Germany:'German',France:'French',Italy:'Italian','Soviet Union':'Soviet','United Kingdom':'British','United States':'American',Japan:'Japanese',China:'Chinese',ANZAC:'ANZAC',Netherlands:'Dutch'};
// Victory cities within this atlas, from Europe 1940 Second Edition, pp. 6 and 34.
export const theaterVictoryCities=[
  {name:'London',lon:-.12,lat:51.51,capitalOf:'United Kingdom'},
  {name:'Paris',lon:2.35,lat:48.86,capitalOf:'France',territory:'fr'},
  {name:'Berlin',lon:13.41,lat:52.52,capitalOf:'Germany'},
  {name:'Rome',lon:12.5,lat:41.9,capitalOf:'Italy'},
  {name:'Moscow',lon:37.62,lat:55.75,capitalOf:'Soviet Union'},
  {name:'Warsaw',lon:21.01,lat:52.23,territory:'pl'},
  {name:'Leningrad',lon:30.32,lat:59.94},
  {name:'Stalingrad',lon:44.51,lat:48.71}
];
export const types = ['inf','tank'];
export const stats = {
  inf:{name:'Infantry',attack:1,defense:2,cost:3},
  tank:{name:'Tank',attack:3,defense:3,cost:6}
};
Object.assign(stats,{
  artillery:{name:'Artillery',defense:2,cost:4,code:'ART'},mech_infantry:{name:'Mechanized infantry',defense:2,cost:4,code:'MECH'},
  aaGun:{name:'AAA',defense:0,cost:5,code:'AAA'},fighter:{name:'Fighter',defense:4,cost:10,code:'FTR'},
  tactical_bomber:{name:'Tactical bomber',defense:3,cost:11,code:'TAC'},bomber:{name:'Strategic bomber',defense:1,cost:12,code:'BMR'}
});
export const count=units=>Object.values(units).reduce((n,v)=>n+v,0);
const casualtyOrder=Object.keys(stats).sort((a,b)=>stats[a].cost-stats[b].cost);
export const describe = units => Object.keys(stats).filter(k=>units[k]).map(k=>k==='inf' ? units[k]+' infantry' : k==='tank'?units[k]+(units[k]===1?' tank':' tanks'):units[k]+' '+stats[k].name.toLowerCase()).join(', ') || 'no units';
const empty = () => ({inf:0,tank:0});
export function newGame(exercise='west') {
  const units={},owners={};
  for(const [id,[inf,tank]] of Object.entries(exercises[exercise].forces)){
    units[id]={inf,tank};owners[id]=places[id].owner;
  }
  return {version:1,exercise,phase:'plan',units,owners,orders:[],battles:[],active:null,record:[]};
}
function check(ok, message) { if (!ok) throw new Error(message); }
export function available(s, from, exceptTarget=null) {
  const free={...s.units[from]};
  for (const order of s.orders.filter(o=>o.from===from && o.to!==exceptTarget)) {
    for(const k of types) free[k]-=order.units[k];
  }
  return free;
}
function validUnits(units,limit) {
  return types.every(k=>Number.isSafeInteger(units[k])&&units[k]>=0&&units[k]<=limit[k]);
}
export function plan(s,from,to,units) {
  check(s.phase==='plan','Movement has already been committed.');
  check(s.owners[from]===exerciseOf(s).attacker&&(s.exercise==='global'?s.owners[to]!==exerciseOf(s).attacker:s.owners[to]===exerciseOf(s).defender)&&places[from]?.targets.includes(to),'This exercise allows an attack into an adjacent hostile territory. These territories do not share a playable border.');
  check(validUnits(units,available(s,from,to)),'This order exceeds the forces available at its origin.');
  s.orders=s.orders.filter(o=>o.from!==from||o.to!==to);
  if(count(units)) s.orders.push({from,to,units:{...units}});
}
function alterStack(s,id,power,type,delta){
  if(!s.pieces||!delta)return;
  let row=s.pieces[id].find(([p,t])=>p===power&&t===type);
  if(!row){row=[power,type,0];s.pieces[id].push(row);}
  row[2]+=delta;
}
export function commit(s) {
  check(s.phase==='plan' && s.orders.length,'Plan at least one attack before committing.');
  for(const o of s.orders) {
    let b=s.battles.find(b=>b.to===o.to);
    if(!b){b={to:o.to,origins:[],attack:empty(),round:0,step:'ready',resolved:false};s.battles.push(b);}
    b.origins.push(o.from);
    for(const k of types){b.attack[k]+=o.units[k];s.units[o.from][k]-=o.units[k];alterStack(s,o.from,s.power,k,-o.units[k]);}
    s.record.push({title:places[o.from].name+' → '+places[o.to].name,detail:describe(o.units)});
  }
  s.phase='combat';
}
export function chooseBattle(s,to) {
  const b=s.battles.find(b=>b.to===to);
  check(s.phase==='combat'&&!s.active&&b&&!b.resolved,'Finish the current battle before choosing another.');
  s.active=to;
}
export const currentBattle = s=>s.battles.find(b=>b.to===s.active);
function die(){
  const bytes=new Uint8Array(1);
  do { crypto.getRandomValues(bytes); } while(bytes[0]>=252);
  return bytes[0]%6+1;
}
function rollForce(force,mode,random) {
  return (mode==='attack'?types:Object.keys(stats).filter(k=>stats[k].defense)).flatMap(type=>Array.from({length:force[type]||0},()=>{
    const face=random(); return {type,face,hit:face<=stats[type][mode]};
  }));
}
function finishBattle(s,b,result){
  b.resolved=true;b.step='done';b.result=result;s.active=null;
  s.record.push({title:places[b.to].name,detail:result});
  if(s.battles.every(b=>b.resolved))s.phase='review';
}
export function defenderLosses(force,hits){
  const lost=empty();
  for(const k of casualtyOrder){if(force[k]){lost[k]=Math.min(force[k],hits);hits-=lost[k];}}
  return lost;
}
function applyLosses(s,b,losses){
  for(const k of types)b.attack[k]-=losses[k];
  const {attacker}=exerciseOf(s),defender=s.owners[b.to];
  const defenders=s.units[b.to];
  const lost=defenderLosses(defenders,b.dice.attack.filter(d=>d.hit).length);
  const nationalLosses={};
  for(const [type,n] of Object.entries(lost)){
    if(!n)continue;
    defenders[type]-=n;
    let remaining=n;
    for(const row of s.pieces?.[b.to]||[]){
      if(row[1]!==type||!remaining||!row[2])continue;
      const taken=Math.min(remaining,row[2]);row[2]-=taken;remaining-=taken;
      const army=nationalLosses[row[0]]??={};army[type]=(army[type]||0)+taken;
    }
  }
  s.record.push({title:places[b.to].name+' · round '+b.round,dice:b.dice,
    losses:{attack:{...losses},defense:lost},defender,nationalLosses,
    detail:'Losses — '+attacker+': '+describe(losses)+'; '+defender+': '+describe(lost)+'.'});
  if(!count(defenders)&&count(b.attack)){
    if(s.pieces){
      for(const row of s.pieces[b.to]){
        if(row[2]&&!stats[row[1]]){row[0]=s.power;if(row[1]==='factory_major')row[1]='factory_minor';}
      }
      for(const k of types)alterStack(s,b.to,s.power,k,b.attack[k]);
    }
    s.owners[b.to]=attacker;s.units[b.to]={...b.attack};finishBattle(s,b,'Captured by '+attacker+' with '+describe(b.attack)+'.');
  }else if(!count(b.attack)){
    finishBattle(s,b,count(defenders)?defender+' held with '+describe(defenders)+'.':'Both forces lost. '+defender+' retains control.');
  }else b.step='decision';
}
export function rollAttack(s,random=die){
  const b=currentBattle(s);
  check(b&&['ready','decision'].includes(b.step),'Resolve casualties before rolling again.');
  b.round++;
  b.dice={attack:rollForce(b.attack,'attack',random)};
  b.step='defense';
}
export function rollDefense(s,random=die){
  const b=currentBattle(s);
  check(b?.step==='defense','Roll the attack first. Each side rolls once per round.');
  // Defenders hit by the attack still return fire in this land battle.
  b.dice.defense=s.pieces?s.pieces[b.to].flatMap(([power,type,n])=>{
    if(!stats[type]?.defense)return [];
    return Array.from({length:n},()=>{
      const face=random();return {type,face,hit:face<=stats[type].defense,power};
    });
  }):rollForce(s.units[b.to],'defense',random);
  b.hits=Math.min(count(b.attack),b.dice.defense.filter(d=>d.hit).length);
  b.step='losses';

}
export function casualties(s,losses){
  const b=currentBattle(s);
  check(b?.step==='losses'&&validUnits(losses,b.attack)&&count(losses)===b.hits,'Assign exactly one eligible unit per hit.');
  applyLosses(s,b,losses);
}
export function retreat(s,origin){
  const b=currentBattle(s);
  check(b?.step==='decision'&&b.origins.includes(origin)&&s.owners[origin]===exerciseOf(s).attacker,'Retreat all survivors together to a friendly territory used to enter this battle.');
  for(const k of types){s.units[origin][k]+=b.attack[k];alterStack(s,origin,s.power,k,b.attack[k]);}
  finishBattle(s,b,'Retreated to '+places[origin].name+' with '+describe(b.attack)+'.');
}
