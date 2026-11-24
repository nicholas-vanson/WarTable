import {places,exercises,stats} from './rules.js';
import {neutralOwners,neutralKey,canEnterNeutral,hostileNeutral,openingLand} from './neutral-rules.js';
// Global 1940 Second Edition order of play. Both British economies share a controller.
export const globalPowers={
  Germans:'Germany',Russians:'Soviet Union',Japanese:'Japan',Americans:'United States',
  Chinese:'China',British:'United Kingdom',Italians:'Italy',ANZAC:'ANZAC',French:'France'
};
export const ownerNames={...globalPowers,UK_Pacific:'United Kingdom',Dutch:'Netherlands',
  ...neutralOwners};
export const globalUnits={
  infantry:['Infantry',3],artillery:['Artillery',4],mech_infantry:['Mechanized infantry',4],armour:['Tank',6],aaGun:['AAA',5],
  fighter:['Fighter',10],tactical_bomber:['Tactical bomber',11],bomber:['Strategic bomber',12],
  submarine:['Submarine',6],transport:['Transport',7],destroyer:['Destroyer',8],cruiser:['Cruiser',12],
  carrier:['Aircraft carrier',16],battleship:['Battleship',20],factory_minor:['Minor industrial complex',12],
  factory_major:['Major industrial complex',30],airfield:['Air base',15],harbour:['Naval base',15]
};
export function startGlobalMatch(setup,controllers){
  for(const power of Object.keys(globalPowers)){
    if(!Number.isInteger(controllers[power])||controllers[power]<1||controllers[power]>9)throw Error('Assign a local player to each power.');
  }
  return {version:1,round:1,power:'Germans',phase:'purchase',controllers:{...controllers},
    treasury:{...setup.treasury},draft:{},mobilization:{},board:Object.fromEntries(
      Object.entries(setup.regions).map(([name,r])=>[name,{owner:r.owner,units:r.units.map(stack=>[...stack])}]))};
}
// The local playtest enters combat after the player surveys the opening board.
export function startGlobalPlaytest(setup,controllers){
  const match=startGlobalMatch(setup,controllers);
  match.phase='briefing';
  return match;
}
export function openingAddress(match,seat){
  if(seat===match.controllers[match.power])return 'You command '+globalPowers[match.power]+'.';
  const powers=Object.keys(globalPowers).filter(power=>match.controllers[power]===seat);
  const names=powers.map(power=>({British:'the United Kingdom',Americans:'the United States',Russians:'the Soviet Union'}[power]||globalPowers[power]));
  return names.length?'You command '+new Intl.ListFormat('en').format(names)+'.':'You are observing this game.';
}
export function purchaseTotal(draft){
  return Object.entries(draft).reduce((sum,[unit,n])=>sum+n*globalUnits[unit][1],0);
}
export function changePurchase(match,unit,delta){
  if(match.phase!=='purchase'||!Object.hasOwn(globalUnits,unit)||![-1,1].includes(delta))throw Error('This purchase cannot be changed.');
  const n=(match.draft[unit]||0)+delta;
  const next={...match.draft,[unit]:n};
  if(n<0||purchaseTotal(next)>match.treasury[match.power])throw Error('This order exceeds the available units or IPCs.');
  if(!n)delete next[unit];
  match.draft=next;
}
export function confirmPurchase(match){
  if(match.phase!=='purchase')throw Error('This purchase was already recorded.');
  const cost=purchaseTotal(match.draft);
  if(cost>match.treasury[match.power])throw Error('Insufficient IPCs.');
  match.treasury[match.power]-=cost;
  match.mobilization[match.power]={...match.draft};
  match.draft={};match.phase='combatMove';
}
export const globalKey='wartable.global1940.match.v1';
const regionAliases={'Holland Belgium':'hb','Western Germany':'wg','Normandy Bordeaux':'nb','France':'fr',
  'Northern Italy':'ni','Southern France':'sf','Baltic States':'bs','Eastern Poland':'ep','Bessarabia':'be','Poland':'pl','Romania':'ro'};
const typeKeys={infantry:'inf',armour:'tank'};
export const boardUnitType=type=>typeKeys[type]||type;
export function prepareGlobalBoard(setup,atlas,match){
  const {sectors,projection}=atlas;
  const forces={},shapes={},units={},owners={},pieces={};
  const ids=Object.fromEntries(Object.keys(setup.regions).map(name=>[name,regionAliases[name]||'world-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-')]));
  const attacker=globalPowers[match.power];
  const enemies=new Set(setup.diplomacy.filter(([a,b,rel])=>rel==='War'&&(a===match.power||b===match.power)).map(([a,b])=>a===match.power?b:a));
  if(enemies.has('British'))enemies.add('UK_Pacific');
  const neighbors={},neutralEntry={},unmovedLand={};
  for(const [name,r] of Object.entries(setup.regions)){
    const id=ids[name],position=match.board[name],owner=r.blocked?'Impassable':r.water?'Sea zone':ownerNames[position.owner]||'Impassable';
    neighbors[id]=r.links.map(n=>ids[n]);
    neutralEntry[id]=!r.blocked&&canEnterNeutral(match.power,enemies,r);
    const targets=r.blocked||r.water||position.owner!==match.power?[]:r.links.filter(to=>{
      const dest=setup.regions[to],controller=match.board[to].owner;
      return !dest.water&&!dest.blocked&&(enemies.has(controller)||neutralOwners[controller]&&canEnterNeutral(match.power,enemies,dest)&&hostileNeutral(match.power,controller));
    }).map(to=>ids[to]);
    places[id]={name,owner:r.blocked?owner:ownerNames[r.owner]||owner,blocked:r.blocked,targets,water:r.water,city:r.city,ipc:r.ipc,links:r.links,original:r.original};
    pieces[id]=position.units.map(([power,unit,n])=>[power,boardUnitType(unit),n]);
    shapes[id]={...sectors[name],garrison:pieces[id].filter(row=>row[2]>0),homePower:position.owner};
    owners[id]=owner;forces[id]=true;
    if(!r.water&&!r.blocked)unmovedLand[id]=openingLand(pieces[id],match.power);
    const available={inf:0,tank:0};
    for(const [power,type,n] of pieces[id]){
      if(stats[type]&&!r.water&&(owner!==attacker||power===match.power&&['inf','tank'].includes(type)))available[type]=(available[type]||0)+n;
    }
    units[id]=available;
  }
  const cities=[
    ['London','United Kingdom',-.12,51.51,'United Kingdom'],['Paris','France',2.35,48.86,'France'],
    ['Berlin','Germany',13.41,52.52,'Germany'],['Rome','Southern Italy',12.5,41.9,'Italy'],['Moscow','Russia',37.62,55.75,'Soviet Union'],
    ['Warsaw','Poland',21.01,52.23],['Leningrad','Novgorod',30.32,59.94],['Stalingrad','Volgograd',44.51,48.71],
    ['Cairo','Egypt',31.24,30.04],['Ottawa','Ontario',-75.7,45.42],['Washington','Eastern United States',-77.04,38.9,'United States'],
    ['San Francisco','Western United States',-122.42,37.77],['Honolulu','Hawaiian Islands',-157.86,21.3],
    ['Tokyo','Japan',139.69,35.68,'Japan'],['Shanghai','Kiangsu',121.47,31.23],['Hong Kong','Kwangtung',114.17,22.32],
    ['Manila','Philippines',120.98,14.6],['Calcutta','India',88.36,22.57,'UK Pacific'],['Sydney','New South Wales',151.21,-33.87,'ANZAC']
  ].map(([name,region,lon,lat,capitalOf])=>({name,territory:ids[region],lon,lat,point:sectors[region].city,capitalOf}));
  const [x,y]=sectors.Germany.center;
  const camera={x,y,z:.7*projection.detailScale,surveyZoom:true};
  const exercise={name:'Global 1940',attacker,defender:'France',camera,forces,shapes,cities,world:true,projection,neighbors,neutralEntry,unmovedLand};
  exercises.global=exercise;
  let openingView;
  if(match.phase==='briefing'){
    // Fit the opening theater in the map's 650 by 480 reference viewport.
    const landmarks=['United Kingdom','France','Novgorod','Russia'].map(name=>sectors[name].city);
    const xs=landmarks.map(point=>point[0]),ys=landmarks.map(point=>point[1]);
    const left=Math.min(...xs)-360,right=Math.max(...xs)+360;
    const top=Math.min(...ys)-320,bottom=Math.max(...ys)+320;
    openingView={x:(left+right)/2,y:(top+bottom)/2,z:projection.detailScale*Math.min(650/(right-left),480/(bottom-top)),
      surveyZoom:true,projection:projection.id};
  }
  return {exercise,openingView,game:{version:1,exercise:'global',phase:'plan',mongolianPactBroken:!!match.mongolianPactBroken,power:match.power,units,owners,pieces,orders:[],battles:[],active:null,record:[]}};
}
export function saveGlobalPosition(match,game){
  match.mongolianPactBroken=!!game.mongolianPactBroken;
  for(const [id,stacks] of Object.entries(game.pieces)){
    const area=match.board[places[id].name];
    if(game.owners[id]===globalPowers[match.power]&&ownerNames[area.owner]!==game.owners[id])area.owner=match.power;
    else if(neutralKey(game.owners[id]))area.owner=neutralKey(game.owners[id]);
    else if(game.owners[id]==='Soviet Union'&&places[id].original==='Mongolians')area.owner='Russians';
    area.units=stacks.filter(row=>row[2]>0).map(([p,t,n])=>[p,t==='inf'?'infantry':t==='tank'?'armour':t,n]);
  }
}
export async function loadGlobalSetup(){
  return await (await fetch('./assets/global-setup.json')).json();
}
export async function loadGlobalBoard(){
  const setup=await loadGlobalSetup();
  const sectors=await (await fetch('./assets/world-sectors.json')).json();
  const saved=localStorage.getItem(globalKey);
  const match=saved?JSON.parse(saved):startGlobalPlaytest(setup,Object.fromEntries(Object.keys(globalPowers).map(k=>[k,1])));
  if(match.version!==1||!match.board?.Germany)throw Error('The saved global match could not be opened.');
  match.combatStart??=structuredClone(match.board);
  match.combatStartPactBroken??=!!match.mongolianPactBroken;
  // Older saves omit the Sahara and display the Himalayas with China's setup color.
  for(const [name,region] of Object.entries(setup.regions)){
    if(!region.blocked)continue;
    match.board[name]??={owner:region.owner,units:[]};
    match.combatStart[name]??={owner:region.owner,units:[]};
  }
  const board=prepareGlobalBoard(setup,sectors,{...match,board:match.combatStart,mongolianPactBroken:match.combatStartPactBroken});
  const savedGame=match.combat?.game;
  if(savedGame)for(const id of Object.keys(board.game.owners)){
    if(!places[id].blocked)continue;
    savedGame.owners[id]=board.game.owners[id];
    savedGame.units[id]??=board.game.units[id];
    savedGame.pieces[id]??=board.game.pieces[id];
  }
  return {...board,match};
}
