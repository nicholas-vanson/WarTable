import {places,types,available} from './rules.js';
const ns='http://www.w3.org/2000/svg';
function node(tag,attrs,text=''){
  const el=document.createElementNS(ns,tag);
  for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
  el.textContent=text;return el;
}
const project=(lon,lat)=>[(lon+13)*34,(69-lat)*52];
const position=id=>project(places[id].lon,places[id].lat);
// Follow the actual border crossing on the atlas rather than cutting across a third territory.
const crossings={
  'hb-nb':[[4.4,51],[3.3,50.8],[2.35,50.24],[1.15,49.65],[.2,48.85]],
  'wg-fr':[[7.4,49.45],[6.9,49.14]]
};
// Stable geographic positions let a split stack stay in place as its count changes.
const stackSites = {
  hb: {home:{inf:[4.4,50.6],tank:[5.5,52.15]}},
  wg: {home:{inf:[7.55,50.25],tank:[9.3,52.1]}},
  nb: {home:{inf:[-1.5,48.35],tank:[-.55,46.65]}, incoming:{inf:[.25,48.95],tank:[-1.42,47.57]}},
  fr: {home:{inf:[2.4,47.95],tank:[5.3,48.78]}, incoming:{inf:[3.45,49.75],tank:[4.1,47.2]}}
};
function drawStack(parent,id,type,number,nation,role,scale,detailed,selected){
  const [x,y]=project(...stackSites[id][role][type]);
  const ink=nation==='Germany'?'#334334':'#294c60';
  const paper=nation==='Germany'?'#e6dfbd':'#d8e6e5';
  const name=type==='inf'?'Infantry':'Armor';
  const label=places[id].name+' · '+nation+' · '+name+' × '+number;
  const stack=node('g',{'data-place':id,'data-unit':type,'data-count':number,'data-role':role,
    'aria-label':label,cursor:'pointer',transform:'translate('+x+' '+y+') scale('+1/scale+')'});
  stack.append(node('title',{},label),node('rect',{x:-22,y:-22,width:44,height:44,fill:'transparent'}));
  if(selected)stack.append(node('rect',{x:-22,y:-15,width:44,height:30,rx:2,fill:'#f4d49a',stroke:'#94522a','stroke-width':2}));
  stack.append(node('rect',{x:-19,y:-11,width:38,height:22,rx:1,fill:paper,stroke:ink,'stroke-width':1.6}));
  stack.append(node('rect',{x:-15,y:-6,width:16,height:12,fill:'none',stroke:ink,'stroke-width':1.3}));
  stack.append(type==='inf'
    ? node('path',{d:'M-15 -6L1 6M-15 6L1 -6',stroke:ink,'stroke-width':1.5})
    : node('ellipse',{cx:-7,cy:0,rx:6.6,ry:3.8,fill:'none',stroke:ink,'stroke-width':1.6}));
  stack.append(node('text',{x:10,y:4,'text-anchor':'middle','font-family':'sans-serif','font-size':13,'font-weight':700,fill:ink},number));
  if(detailed)stack.append(node('text',{x:0,y:24,'text-anchor':'middle','font-family':'sans-serif','font-size':11,'font-weight':650,fill:ink,
    stroke:'#f5efd8','paint-order':'stroke','stroke-width':3},(nation==='Germany'?'DE':'FR')+' · '+name));
  parent.append(stack);
}
const labels=[
  ['NORTH SEA',1,55.2,'water'],['BALTIC SEA',19.7,57.3,'water'],['ATLANTIC OCEAN',-8,47.5,'water'],['MEDITERRANEAN SEA',7.3,38,'water'],['BLACK SEA',33.3,43.4,'water'],['NORWEGIAN SEA',.5,66,'water'],
  ['English Channel',-2.4,50.15,'water'],['Bay of Biscay',-4.3,45.3,'water'],['Adriatic Sea',15,43,'water'],
  ['UNITED KINGDOM',-2.2,53.3],['SCOTLAND',-4.1,57.3],['EIRE',-8,53.2],['NORWAY',9.6,62.2],['SWEDEN',15.2,61.4],['FINLAND',26.4,64.3],['DENMARK',9.3,56.8],['GERMANY',12.6,52],['POLAND',19.2,51.6],['BALTIC STATES',24.3,56.5],['WESTERN UKRAINE',25.8,49.1],['BELARUS',28.5,54.3],['SOVIET UNION',38,56.1],['ROMANIA',24.7,45.9],['YUGOSLAVIA',19.2,44.1],['NORTHERN ITALY',10.1,45.2],['SOUTHERN ITALY',15.3,40.3],['GREECE',22.5,39.7],['SPAIN',-3.5,40.3],['PORTUGAL',-8,39.5],['SWITZERLAND',8.1,46.7],['SOUTHERN FRANCE',3.3,44],['GREATER SOUTHERN GERMANY',13,48.3],
  ['Lille',3.06,50.63,'city'],['Brussels',4.35,50.85,'city'],['Lyon',4.84,45.76,'city'],['Köln',6.96,50.94,'city'],['Vienna',16.37,48.21,'city'],['London',-.12,51.51,'city'],['Paris',2.35,48.86,'city'],['Bordeaux',-.58,44.84,'city'],['Berlin',13.41,52.52,'city'],['Copenhagen',12.57,55.68,'city'],['Rome',12.5,41.9,'city'],['Warsaw',21.01,52.23,'city'],['Moscow',37.62,55.75,'city'],['Madrid',-3.7,40.42,'city'],['Stockholm',18.06,59.33,'city'],['Amsterdam',4.9,52.36,'city'],['Brest',-4.49,48.39,'city']
];
const bound=(v,min,max)=>Math.min(max,Math.max(min,v));
export async function atlas(onPick,onView,initial) {
  const map=document.querySelector('#map'), forces=document.querySelector('#forces'), regions=document.querySelector('#regions'),routes=document.querySelector('#routes');
  const shapes=await (await fetch('./assets/territories.json')).json();
  for(const [id,d] of Object.entries(shapes)) regions.append(node('path',{d,fill:'transparent','data-place':id}));
  const labelGroup=document.querySelector('#labels');
  for(const [name,lon,lat,kind] of labels){
    const [x,y]=project(lon,lat);
    if(kind==='city')labelGroup.append(node('circle',{cx:x,cy:y,r:2.4,fill:'#42463a'}));
    labelGroup.append(node('text',{x:kind==='city'?x+5:x,y:kind==='city'?y-4:y,'text-anchor':kind==='city'?'start':'middle',
      fill:kind==='water'?'#506b6c':'#535747','font-family':'Georgia,serif','font-size':kind==='city'?11:kind==='water'?15:13,'letter-spacing':kind==='city'?0:kind==='water'?2:1.8,'font-style':kind==='city'||kind==='water'?'italic':'normal',
      'paint-order':'stroke','stroke-width':1.8,stroke:kind==='water'?'#bacbcc':'#dcd9c1'},name));
  }
  let game=null,focus=null,target=null,selectedType=null;
  let view=initial&&[initial.x,initial.y,initial.z].every(Number.isFinite)?{...initial}:{x:590,y:985,z:1};
  const pointers=new Map();let gesture=null;
  function metrics(){
    const w=map.clientWidth||1,h=map.clientHeight||1;
    const base=Math.min(w/650,h/480);
    const scale=Math.max(Math.min(w/2006,h/1716),base*view.z);
    return {w,h,scale,vw:w/scale,vh:h/scale,base};
  }
  function render(){
    const {vw,vh,scale}=metrics();
    view.x=vw>=2006?1003:bound(view.x,vw/2,2006-vw/2);
    view.y=vh>=1716?858:bound(view.y,vh/2,1716-vh/2);
    map.setAttribute('viewBox',[view.x-vw/2,view.y-vh/2,vw,vh].join(' '));
    document.querySelector('#scale').textContent=Math.round(view.z*100)+'%';
    const lon=view.x/34-13,lat=69-view.y/52;
    document.querySelector('#coordinates').textContent=lat.toFixed(1)+'° N   '+Math.abs(lon).toFixed(1)+'° '+(lon<0?'W':'E');
    if(!game)return;
    routes.replaceChildren();forces.replaceChildren();
    for(const region of regions.children){
      const id=region.dataset.place;
      const legal=game.phase==='plan'&&places[focus]?.targets.includes(id);
      region.setAttribute('fill',id===target?'#ba84353a':legal?'#d6b65728':'transparent');
      region.setAttribute('stroke',legal?'#895a31':'none');
      region.setAttribute('stroke-width','2');
    }
    for(const order of game.orders){
      const via=(crossings[order.from+'-'+order.to]||[]).map(([lon,lat])=>project(lon,lat));
      for(const type of types.filter(type=>order.units[type]>0)){
        const start=project(...stackSites[order.from].home[type]);
        const [tx,ty]=project(...stackSites[order.to].incoming[type]);
        const points=[start,...via];
        const [lastX,lastY]=points.at(-1);
        const dx=tx-lastX,dy=ty-lastY,dist=Math.hypot(dx,dy);
        const trim=Math.min(dist*.25,22/scale);
        routes.append(node('path',{d:'M'+points.map(pt=>pt.join(' ')).join(' L')+' L'+(tx-dx*trim/dist)+' '+(ty-dy*trim/dist),'stroke':'#99432e','stroke-width':2/scale,'stroke-dasharray':game.phase==='plan'?(6/scale)+' '+(3/scale):'none','marker-end':'url(#arrow)',fill:'none'}));
      }
    }
    const compact=view.z<.66;
    for(const [id,p] of Object.entries(places)){
      const [x,y]=position(id),friendly=game.owners[id]==='Germany';
      const units=game.phase==='plan'&&friendly?available(game,id):game.units[id];
      const color=friendly?'#434f3b':'#3f5964';
      if(compact){
        forces.append(node('circle',{cx:x,cy:y,r:7/scale,fill:color,stroke:'#f7f2df','stroke-width':1.6/scale,'data-place':id}));
        continue;
      }
      forces.append(node('text',{x,y:y+(id==='wg'?-6:5)/scale,'text-anchor':'middle',fill:'#29392d',stroke:'#e9e4cd','stroke-width':3/scale,
        'paint-order':'stroke','font-family':'Georgia,serif','font-weight':'bold','font-size':11.5/scale,'pointer-events':'none'},p.name));
      const battle=game.battles.find(b=>b.to===id&&!b.resolved);
      const incoming=game.phase==='plan'?game.orders.filter(o=>o.to===id)
        .reduce((sum,o)=>({inf:sum.inf+o.units.inf,tank:sum.tank+o.units.tank}),{inf:0,tank:0}):battle?.attack;
      for(const type of types){
        if(units[type])drawStack(forces,id,type,units[type],game.owners[id],'home',scale,view.z>=1.55,id===focus&&type===selectedType);
        if(incoming?.[type])drawStack(forces,id,type,incoming[type],'Germany','incoming',scale,view.z>=1.55,false);
      }
    }
  }
  function zoom(factor,px=map.clientWidth/2,py=map.clientHeight/2) {
    const old=metrics();const wx=view.x+(px-old.w/2)/old.scale,wy=view.y+(py-old.h/2)/old.scale;
    view.z=bound(view.z*factor,.15,4.5);const next=metrics();
    view.x=wx-(px-next.w/2)/next.scale;view.y=wy-(py-next.h/2)/next.scale;render();
  }
  const coords=e=>{const b=map.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top};};
  function basis(){
    const pts=[...pointers.values()]; const a=pts[0],b=pts[1]||a;
    return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y),n:pts.length};
  }
  map.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    pointers.set(e.pointerId,coords(e));map.setPointerCapture(e.pointerId);
    const hit=e.target.closest('[data-place]')?.dataset;
    const v=basis();gesture={...v,firstX:v.x,firstY:v.y,moved:v.n>1,id:hit?.place,type:hit?.unit};
  });
  map.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||!gesture)return;
    pointers.set(e.pointerId,coords(e));const v=basis();
    if(Math.hypot(v.x-gesture.firstX,v.y-gesture.firstY)>5)gesture.moved=true;
    if(gesture.moved){
      if(v.n>1&&gesture.d>0&&v.d>0)zoom(v.d/gesture.d,gesture.x,gesture.y);
      const m=metrics();view.x-=(v.x-gesture.x)/m.scale;view.y-=(v.y-gesture.y)/m.scale;
      render();
    }
    Object.assign(gesture,v);
  });
  function end(e){
    if(!pointers.has(e.pointerId))return;
    const tapped=e.type==='pointerup'&&gesture&&!gesture.moved&&gesture.id;
    const type=gesture?.type;
    pointers.delete(e.pointerId);
    gesture=pointers.size?{...basis(),moved:true}:null;
    if(tapped){if(view.z<.66){[view.x,view.y]=position(tapped);view.z=1.25;render();}onPick(tapped,type);}
    onView({...view});
  }
  map.addEventListener('pointerup',end);map.addEventListener('pointercancel',end);
  map.addEventListener('wheel',e=>{e.preventDefault();const p=coords(e);zoom(Math.exp(-bound(e.deltaY,-240,240)*.002),p.x,p.y);onView({...view});},{passive:false});
  function button(id,fn){document.getElementById(id).onclick=()=>{fn();render();onView({...view});};}
  button('zoomIn',()=>zoom(1.38));button('zoomOut',()=>zoom(1/1.38));
  button('recenter',()=>{view={x:590,y:985,z:1};});
  button('overview',()=>{const m=metrics();view={x:1003,y:858,z:Math.min(m.w/2006,m.h/1716)/m.base};});
  new ResizeObserver(render).observe(map);
  return (s,id,to,type)=>{game=s;focus=id;target=to;selectedType=type;render();};
}
