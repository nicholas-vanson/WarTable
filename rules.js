// The local exercise models adjacent overland attacks with infantry and tanks.
export const places = {
  hb: {name:'Holland Belgium', owner:'Germany', targets:['fr','nb'], lon:5.0, lat:51.6},
  wg: {name:'Western Germany', owner:'Germany', targets:['fr'], lon:8.9, lat:50.6},
  nb: {name:'Normandy Bordeaux', owner:'France', targets:[], lon:-.8, lat:47.45},
  fr: {name:'France', owner:'France', targets:[], lon:2.65, lat:48.45}
};
export const types = ['inf','tank'];
export const stats = {
  inf:{name:'Infantry',attack:1,defense:2,cost:3},
  tank:{name:'Tank',attack:3,defense:3,cost:6}
};
export const count = units => units.inf + units.tank;
export const describe = units => types.filter(k=>units[k]).map(k=>k==='inf' ? units[k]+' infantry' : units[k]+(units[k]===1?' tank':' tanks')).join(', ') || 'no units';
const empty = () => ({inf:0,tank:0});
export function newGame() {
  return {version:1,phase:'plan',units:{hb:{inf:5,tank:2},wg:{inf:4,tank:3},nb:{inf:2,tank:0},fr:{inf:3,tank:1}},
    owners:Object.fromEntries(Object.entries(places).map(([id,p])=>[id,p.owner])),
    orders:[],battles:[],active:null,record:[]};
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
  check(places[from]?.targets.includes(to),'This exercise allows an attack into an adjacent hostile territory. These territories do not share a playable border.');
  check(validUnits(units,available(s,from,to)),'This order exceeds the forces available at its origin.');
  s.orders=s.orders.filter(o=>o.from!==from||o.to!==to);
  if(count(units)) s.orders.push({from,to,units:{...units}});
}
export function commit(s) {
  check(s.phase==='plan' && s.orders.length,'Plan at least one attack before committing.');
  for(const o of s.orders) {
    let b=s.battles.find(b=>b.to===o.to);
    if(!b){b={to:o.to,origins:[],attack:empty(),round:0,step:'ready',resolved:false};s.battles.push(b);}
    b.origins.push(o.from);
    for(const k of types){b.attack[k]+=o.units[k];s.units[o.from][k]-=o.units[k];}
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
  return types.flatMap(type=>Array.from({length:force[type]},()=>{
    const face=random(); return {type,face,hit:face<=stats[type][mode]};
  }));
}
function finishBattle(s,b,result){
  b.resolved=true;b.step='done';b.result=result;s.active=null;
  s.record.push({title:places[b.to].name,detail:result});
  if(s.battles.every(b=>b.resolved))s.phase='review';
}
function applyLosses(s,b,losses){
  for(const k of types)b.attack[k]-=losses[k];
  const defenders=s.units[b.to];
  let hits=b.dice.attack.filter(d=>d.hit).length;
  const lost=empty();
  for(const k of types){lost[k]=Math.min(defenders[k],hits);defenders[k]-=lost[k];hits-=lost[k];}
  s.record.push({title:places[b.to].name+' · round '+b.round,dice:b.dice,
    detail:'Losses — Germany: '+describe(losses)+'; France: '+describe(lost)+'.'});
  if(!count(defenders)&&count(b.attack)){
    s.owners[b.to]='Germany';s.units[b.to]={...b.attack};finishBattle(s,b,'Captured by Germany with '+describe(b.attack)+'.');
  }else if(!count(b.attack)){
    finishBattle(s,b,count(defenders)?'France held with '+describe(defenders)+'.':'Both forces lost. France retains control.');
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
  b.dice.defense=rollForce(s.units[b.to],'defense',random);
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
  check(b?.step==='decision'&&b.origins.includes(origin)&&s.owners[origin]==='Germany','Retreat all survivors together to a friendly territory used to enter this battle.');
  for(const k of types)s.units[origin][k]+=b.attack[k];
  finishBattle(s,b,'Retreated to '+places[origin].name+' with '+describe(b.attack)+'.');
}
