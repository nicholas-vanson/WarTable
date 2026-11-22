import {ownerNames,globalUnits} from './global-game.js';
import {places,types,stats,available,theaterVictoryCities} from './rules.js';
const ns='http://www.w3.org/2000/svg';
function node(tag,attrs,text=''){
  const el=document.createElementNS(ns,tag);
  for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
  el.textContent=text;return el;
}
const project=(lon,lat)=>[(lon+13)*34,(69-lat)*52];
// Hand-spaced seats in the projected territory interiors. Arrival seats fan out from
// the actual approach to the defenders, with a separate pair for each legal origin.
const formations={
  hb:{center:[610,926],home:{inf:[602,952],tank:[616,899]}},
  wg:{center:[716,932],home:{inf:[703,957],tank:[729,900]}},
  nb:{center:[421,1100],home:{inf:[387,1094],tank:[427,1150]},
    hb:{inf:[454,1042],tank:[439,1070]}},
  fr:{center:[571,1087],home:{inf:[536,1103],tank:[594,1133]},
    hb:{inf:[549,1021],tank:[609,1038]},wg:{inf:[652,1068],tank:[656,1105]}}
};
Object.assign(formations,{
  ni:{center:[790,1230],home:{inf:[755,1244],tank:[812,1210]}},
  af:{center:[605,1140],home:{inf:[536,1046],tank:[552,1082]},ni:{inf:[614,1147],tank:[614,1107]}},
  sf:{center:[559,1273],home:{inf:[517,1261],tank:[532,1301]},ni:{inf:[586,1251],tank:[607,1292]}},
  bs:{center:[1260,658],home:{inf:[1240,691],tank:[1293,641]}},
  ep:{center:[1297,935],home:{inf:[1286,888],tank:[1300,978]}},
  be:{center:[1420,1158],home:{inf:[1419,1144],tank:[1435,1180]}},
  pl:{center:[1114,873],home:{inf:[1054,877],tank:[1060,926]},
    bs:{inf:[1115,797],tank:[1134,828]},ep:{inf:[1150,879],tank:[1184,928]}},
  ro:{center:[1295,1190],home:{inf:[1253,1211],tank:[1288,1252]},
    ep:{inf:[1262,1152],tank:[1318,1129]},be:{inf:[1339,1168],tank:[1366,1224]}}
});
const position=id=>formations[id].center;
// Bézier handles are surveyed in map coordinates. The two Normandy approaches share
// a narrow coastal passage, then diverge around the arriving infantry and armor.
const approaches={
  'hb-fr':{inf:[[607,982],[575,990]],tank:[[648,935],[640,996]]},
  'wg-fr':{inf:[[719,987],[719,1025]],tank:[[756,977],[712,1098]]},
  'hb-nb':{
    inf:[[580,926],[553,944],[526,971], [506,991],[482,1000]],
    tank:[[592,924],[545,945],[519,971], [475,1026],[409,1030]]
  }
};
// Control points pass through the shared border before fanning into arrival seats.
Object.assign(approaches,{
  'ni-af':{inf:[[712,1232],[668,1220],[647,1199],[636,1187],[636,1168]],tank:[[754,1234],[669,1218],[642,1203],[626,1193],[628,1168]]},
  'ni-sf':{inf:[[720,1262],[658,1283]],tank:[[760,1266],[682,1302]]},
  'bs-pl':{inf:[[1225,735],[1160,757]],tank:[[1256,699],[1200,742]]},
  'ep-pl':{inf:[[1282,873],[1210,870]],tank:[[1285,945],[1226,923]]},
  'ep-ro':{inf:[[1331,1013],[1322,1113]],tank:[[1320,1010],[1318,1058]]},
  'be-ro':{inf:[[1391,1144],[1371,1155]],tank:[[1412,1200],[1390,1217]]}
});
// Each of the eight home counters gets four saved random bits. Keep the small jitter
// within the tested interior margin. Inbound seats stay open for every approach.
function homeOffsets(seed){
  const offsets={};
  for(const id of Object.keys(formations)){
    offsets[id]={};
    for(const type of types){
      offsets[id][type]=[(seed&3)*8/3-4,((seed>>>2)&3)*8/3-4];
      seed=(seed>>>4)|(seed<<28);
    }
  }
  return offsets;
}
function seat(id,group,type,spread,offsets){
  const center=position(id);
  const shift=group==='home'?offsets[id][type]:[0,0];
  return formations[id][group][type].map((v,i)=>center[i]+spread*(v+shift[i]-center[i]));
}
function movementArc(from,to,type,spread,tokenScale,offsets){
  const start=seat(from,'home',type,spread,offsets),end=seat(to,from,type,spread,offsets);
  const handles=approaches[from+'-'+to][type];
  function atCounterEdge(point,handle){
    const dx=handle[0]-point[0],dy=handle[1]-point[1];
    const t=Math.min(.9,1/Math.max(Math.abs(dx)/(22*tokenScale),Math.abs(dy)/(14*tokenScale)));
    return [point[0]+dx*t,point[1]+dy*t];
  }
  const tail=atCounterEdge(start,handles[0]),tip=atCounterEdge(end,handles.at(-1));
  return 'M'+tail.join(' ')+' C'+[...handles,tip].map(p=>p.join(' ')).join(' ');
}

// Measure each curved stroke from its broad departure end. Segment count follows
// the route on the board, so a pinch never adds or removes a break.
function attackArrow(order,type,spread,tokenScale,offsets,planned,elapsed,detailScale){
  const {from,to,units}=order;
  const centerline=node('path',{d:movementArc(from,to,type,spread,tokenScale,offsets)});
  const length=centerline.getTotalLength();
  const baseWidth=Math.min(length*.09,6.8*tokenScale*bound(.83+length/(570*detailScale),.94,1.32));
  const width=baseWidth*(1+.5*Math.log2(units[type]));
  const departure=formations[from].home[type],arrival=formations[to][from][type];
  const distance=Math.hypot(arrival[0]-departure[0],arrival[1]-departure[1]);
  const segments=1+Math.floor(distance/(125*detailScale));
  const gap=Math.min(6.2*tokenScale,length/segments*.12);
  const headLength=Math.min(length*.17,4.4*tokenScale+width*.56);
  const neck=length-headLength;
  const bodies=[],leads=[],glints=[],pencilLanes=[-.62,-.13,.49];
  function section(at){
    const p=centerline.getPointAtLength(at);
    const a=centerline.getPointAtLength(Math.max(0,at-.65)),b=centerline.getPointAtLength(Math.min(length,at+.65));
    const span=Math.hypot(b.x-a.x,b.y-a.y);
    const nx=(a.y-b.y)/span,ny=(b.x-a.x)/span;
    const fraction=at/length;
    const radius=width*(.50-.394*fraction);
    // Fixed, low-amplitude deviations leave the edges as steady as marks on paper.
    const wobble=.16*tokenScale*Math.sin(at*.43)*Math.sin(Math.PI*fraction);
    return (across,along=0)=>{
      const offset=across*radius+wobble;
      return [p.x+offset*nx+along*ny,p.y+offset*ny-along*nx].map(n=>Number(n.toFixed(2))).join(' ');
    };
  }
  for(let part=0;part<segments;part++){
    const start=part===0?0:length*part/segments+gap/2;
    const final=part===segments-1;
    const end=final?neck:length*(part+1)/segments-gap/2;
    const edges=[[],[]],strokes=[[],[],[]];
    const steps=Math.max(5,Math.ceil((end-start)/4));
    for(let i=0;i<=steps;i++){
      const at=start+(end-start)*i/steps,point=section(at);
      // Matching oblique ends suggest a pencil lifted briefly along the same arc.
      const cut=(i===0&&part>0||i===steps&&!final)?Math.min(gap*.23,width*.16):0;
      edges[0].push(point(1,cut));edges[1].push(point(-1,-cut));
      for(const [j,lane] of pencilLanes.entries()){
        strokes[j].push(point(lane+.045*Math.sin(at*.26+j),lane*cut));
      }
    }
    const [outline,opposite]=edges;
    if(final){
      const shoulder=section(neck);
      const ratio=.32/(.50-.394*neck/length);
      outline.push(shoulder(ratio),section(length)(0),shoulder(-ratio));
    }
    bodies.push('M'+outline.concat(opposite.reverse()).join(' L')+' Z');
    leads.push(...strokes.filter((_,i)=>i!==1).map(line=>'M'+line.join(' L')));
    glints.push('M'+strokes[1].join(' L'));
  }
  const group=node('g',{'data-from':from,'data-to':to,'data-unit':type,'clip-path':'url(#route-'+from+'-'+to+')'});
  const ink=node('g',{filter:'url(#route-grain)','stroke-linecap':'round','stroke-linejoin':'round'});
  ink.append(node('path',{d:bodies.join(' '),fill:planned?'#ad5540':'#943d2e','fill-opacity':planned?.60:.79,
    stroke:'#833929','stroke-width':1.15*tokenScale}),
    node('path',{d:leads.join(' '),fill:'none',stroke:'#8b3529','stroke-width':.75*tokenScale,opacity:.79}),
    node('path',{d:glints.join(' '),fill:'none',stroke:planned?'#f5ddab':'#9b4733','stroke-width':.85*tokenScale,
      'stroke-dasharray':planned?4.5*tokenScale+' '+5.5*tokenScale:'none',opacity:.84}));
  group.append(ink);
  const duration=320+90*segments;
  if(elapsed<duration&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    const id='pencil-route-'+from+'-'+to+'-'+type;
    const mask=node('mask',{id,maskContentUnits:'userSpaceOnUse'});
    centerline.setAttribute('pathLength',1);
    centerline.setAttribute('fill','none');centerline.setAttribute('stroke','white');
    centerline.setAttribute('stroke-width',width+4*tokenScale);centerline.setAttribute('stroke-dasharray','1 1');
    mask.append(centerline);group.append(mask);ink.setAttribute('mask','url(#'+id+')');
    const reveal=centerline.animate([{strokeDashoffset:1},{strokeDashoffset:0}],{duration});
    reveal.currentTime=elapsed;
    reveal.onfinish=()=>{ink.removeAttribute('mask');mask.remove();};
  }
  return group;
}

// Battles pool casualties by type. Apportion the surviving counters to their committed
// approaches for display, preserving the exact total without assigning a new game rule.
function arrivals(game,to){
  const orders=game.orders.filter(o=>o.to===to);
  if(game.phase==='plan')return orders;
  const battle=game.battles.find(b=>b.to===to&&!b.resolved);
  if(!battle)return [];
  const groups=orders.map(o=>({from:o.from,units:{}}));
  for(const type of types){
    const total=orders.reduce((n,o)=>n+o.units[type],0);
    if(!total)continue;
    const shares=orders.map((o,i)=>{
      const share=battle.attack[type]*o.units[type]/total;
      groups[i].units[type]=Math.floor(share);
      return {i,remainder:share-Math.floor(share)};
    });
    const assigned=groups.reduce((n,g)=>n+g.units[type],0);
    shares.sort((a,b)=>b.remainder-a.remainder);
    for(const {i} of shares.slice(0,battle.attack[type]-assigned))groups[i].units[type]++;
  }
  return groups;
}
const pencilLine='M-24 -5 C-21 -14 -4 -17 10 -16 C23 -15 30 -8 27 2 C25 12 9 16 -5 15 C-19 15 -29 10 -28 2 C-28 -5 -23 -11 -15 -14';
const selectionOrange='#a4441b';
function pencilMark(){
  const g=node('g',{'aria-hidden':'true','pointer-events':'none',fill:'none',
    stroke:selectionOrange,'stroke-linecap':'round',filter:'url(#pencil-grain)',mask:'url(#pencil-reveal)'});
  g.append(node('path',{d:pencilLine,'stroke-width':1.6,opacity:.84,'stroke-dasharray':'6 .35 2 .3 9 .55'}),
    node('path',{d:pencilLine,transform:'translate(.45 .5) scale(1.025 .96)','stroke-width':.75,opacity:.66,'stroke-dasharray':'2 .55 .6 .5 5 .9'}),
    node('path',{d:pencilLine,transform:'translate(-.5 .2) scale(1.04 1.04)','stroke-width':.65,opacity:.52,'stroke-dasharray':'.2 1.1 .5 1.7'}));
  return g;
}
// Keep the entire pencil curve anchored. A moving clip reveals fresh spine at either
// end, while each hatch gets its own pencil stroke when the front reaches it.
function drawFront(from,to){
  const id='front-reveal-'+from+'-'+to;
  const group=node('g',{'data-from':from,'data-to':to,'clip-path':'url(#inside-'+to+')'});
  const ink=node('g',{fill:'none',stroke:'#ad302d','stroke-linecap':'round','stroke-linejoin':'round',
    filter:'url(#pencil-grain)'});
  const clip=node('clipPath',{id}),windowRect=node('rect',{x:0,y:-20,width:0,height:40});
  clip.append(windowRect);
  const spine=node('g',{'clip-path':'url(#'+id+')'});
  const curve='M-43 -3 Q-32 -1 -24 .1 T-7 1.8 Q0 2.5 7 1.7 T23 .3 Q34 -.7 43 -3';
  spine.append(node('path',{d:curve,'stroke-width':2.9,'vector-effect':'non-scaling-stroke'}),
    node('path',{d:curve,transform:'translate(.3 1)',opacity:.55,'stroke-width':1,'vector-effect':'non-scaling-stroke'}));
  ink.append(clip,spine);
  const ticks=[];
  const step=to==='nb'?12:9;
  for(let x=-Math.floor(40/step)*step;x<=40;x+=step){
    const y=2-5*(x/43)**2,lean=x/18,height=8.6+Math.cos(x)*1.1;
    const path=node('path',{d:'M'+x+' '+y+' q'+(lean*.25)+' 3.5 '+lean+' '+height,
      'stroke-width':2.1,'vector-effect':'non-scaling-stroke',pathLength:1,'stroke-dasharray':'1 1',display:'none'});
    ink.append(path);ticks.push({x,path});
  }
  group.append(ink);
  return {group,ink,windowRect,ticks,left:null,right:null};
}
function updateFront(mark,units){
  const {windowRect,ticks}=mark;
  const left=units.inf?-25-4*(units.inf-1):-7-1.5*(units.tank-1);
  const right=units.tank?25+4*(units.tank-1):7+1.5*(units.inf-1);
  if(left===mark.left&&right===mark.right)return;
  const fresh=mark.left===null;
  const growing=fresh||left<mark.left||right>mark.right;
  const animate=growing&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Read the visible extent before interrupting a quick succession of reinforcements.
  const style=getComputedStyle(windowRect);
  const start=fresh?(units.inf?left:right):parseFloat(style.x);
  const end=fresh?start:start+parseFloat(style.width);
  windowRect.getAnimations().forEach(a=>a.cancel());
  windowRect.setAttribute('x',left);windowRect.setAttribute('width',right-left);
  const duration=fresh?480:410;
  if(animate)windowRect.animate([
    {x:start+'px',width:(end-start)+'px'},{x:left+'px',width:(right-left)+'px'}
  ],{duration});
  for(const {x,path} of ticks){
    const visible=x>=left&&x<=right;
    const wasVisible=path.getAttribute('display')==='inline';
    if(wasVisible===visible)continue;
    path.getAnimations().forEach(a=>a.cancel());
    path.setAttribute('display',visible?'inline':'none');
    if(visible&&animate){
      const fraction=x<start?(start-x)/(start-left):x>end?(x-end)/(right-end):0;
      path.animate([{strokeDashoffset:1},{strokeDashoffset:0}],{duration:145,delay:fraction*duration,fill:'backwards'});
    }
  }
  mark.left=left;mark.right=right;
}
// Centerlines follow the open corridors between the hand-spaced formations. Infantry
// and armor occupy successive stretches of each line, as they do in the arrival seats.
const frontLines={
  'hb-nb':[[394,1049],[418,1071]],
  'hb-fr':[[524,1062],[602,1075]],
  'wg-fr':[[629,1058],[618,1111]]
};
Object.assign(frontLines,{
  'ni-af':[[567,1118],[602,1095]],'ni-sf':[[548,1245],[568,1292]],
  'bs-pl':[[1080,836],[1140,817]],'ep-pl':[[1118,867],[1122,931]],
  'ep-ro':[[1260,1166],[1316,1151]],'be-ro':[[1310,1185],[1330,1237]]
});
function frontTransform(to,group,spread,tokenScale){
  const [start,end]=frontLines[group.from+'-'+to],center=position(to);
  const dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy);
  const x=center[0]+spread*((start[0]+end[0])/2-center[0]);
  const y=center[1]+spread*((start[1]+end[1])/2-center[1]);
  const attacker=formations[to][group.from].inf;
  const side=Math.sign(dy*(attacker[0]-start[0])-dx*(attacker[1]-start[1]));
  const along=spread/57,across=side*tokenScale/length;
  return 'matrix('+[dx*along,dy*along,dy*across,-dx*across,x,y].join(' ')+')';
}
function drawStack(game,parent,id,type,number,nation,role,at,tokenScale,detailed,selected,origin,auxiliary=false){
  const [x,y]=at;
  const style=styleFor(nation),unitInk=style.counter;
  const ink=selected?'#fff9df':unitInk;
  const paper=selected?selectionOrange:style.paper;
  const name=stats[type]?.name||globalUnits[type]?.[0]||type;
  // After capture the counter represents the surviving attackers at this destination.
  const source=origin||(nation!==places[id].owner&&game.orders.find(o=>o.to===id&&o.units[type])?.from)||id;
  const designation=game.formationNames[nation===places[source].owner?source:source+'/'+nation]?.[type]||name;
  const label=designation+' · '+places[id].name+' · '+nation+' · '+name+' × '+number+(origin?' from '+places[origin].name:'');
  const stack=node('g',{'data-place':id,'data-unit':type,'data-count':number,'data-role':role,
    'aria-label':label,cursor:'pointer',transform:'translate('+x+' '+y+') scale('+tokenScale+')'});
  if(origin)stack.dataset.origin=origin;
  stack.dataset.nation=nation;
  stack.append(node('title',{},label));
  // On a crowded global board the territory already extends nearby tap targets.
  // Keep a neighboring stack's invisible padding clear of the printed symbols.
  if(game.exercise!=='global')stack.append(node('rect',{x:-22,y:-22,width:44,height:44,fill:'transparent'}));
  stack.append(node('rect',{x:-19,y:-11,width:38,height:22,rx:1,fill:paper,stroke:selected?'#753515':unitInk,'stroke-width':1.6}));
  stack.append(node('rect',{x:-15,y:-6,width:16,height:12,fill:'none',stroke:ink,'stroke-width':1.3}));
  if(!types.includes(type)){
    stack.append(node('text',{x:-7,y:2.8,'text-anchor':'middle','font-family':'sans-serif','font-size':6.5,'font-weight':700,fill:ink},stats[type]?.code||counterCodes[type]||'•'));
  }else stack.append(type==='inf'
    ? node('path',{d:'M-15 -6L1 6M-15 6L1 -6',stroke:ink,'stroke-width':1.5})
    : node('ellipse',{cx:-7,cy:0,rx:6.6,ry:3.8,fill:'none',stroke:ink,'stroke-width':1.6}));
  stack.append(node('text',{x:10,y:4,'text-anchor':'middle','font-family':'sans-serif','font-size':13,'font-weight':700,fill:ink},number));
  if(detailed&&(!auxiliary||selected))stack.append(node('text',{x:0,y:24,'text-anchor':'middle','font-family':'sans-serif','font-size':11,'font-weight':650,fill:unitInk,
    stroke:'#f5efd8','paint-order':'stroke','stroke-width':3},style.code+' · '+name));
  parent.append(stack);
  return stack;
}
const labels=[
  ['NORTH SEA',1,55.2,'water',70,29],['BALTIC SEA',19.7,57.3,'water',94,28],['ATLANTIC OCEAN',-8,47.5,'water',39,50],['MEDITERRANEAN SEA',7.3,38,'water',79.5,76],['BLACK SEA',33.3,43.4,'water',116,62],['NORWEGIAN SEA',.5,66,'water',73,9],
  ['English Channel',-2.4,50.15,'water',61.1,44.52],['Bay of Biscay',-4.3,45.3,'water',55.9,53.4],['Adriatic Sea',15,43,'water',88.7,61.5],
  ['Lille',3.06,50.63,'city',69.7,44.7],['Brussels',4.35,50.85,'city',71.2,42.4],['Lyon',4.84,45.76,'city',71.4,52.6],['Köln',6.96,50.94,'city',76.3,42.4],['Vienna',16.37,48.21,'city',89.1,48.4],['Bordeaux',-.58,44.84,'city',61.5,56.3],['Copenhagen',12.57,55.68,'city',77.7,31.2],['Madrid',-3.7,40.42,'city',56.2,65.7],['Stockholm',18.06,59.33,'city',89.1,23.9],['Amsterdam',4.9,52.36,'city',73.4,38.5],['Brest',-4.49,48.39,'city',58.4,48.4]
];
// Curved baselines in the atlas projection. Each span fits the interior of its region.
const landNames=[
  ['Holland Belgium', 'M558 925 Q603 929 643 910', 78],
  ['Western Germany', 'M662 958 Q718 951 763 918', 97],
  ['Normandy Bordeaux', 'M419 1144 Q443 1111 447 1071', 70],
  ['France', 'M535 1073 Q584 1089 635 1080', 90],
  ['UNITED KINGDOM', 'M356 881 Q394 838 406 783', 99],
  ['SCOTLAND', 'M263 660 Q304 643 331 609', 76],
  ['EIRE', 'M148 837 Q173 833 192 817', 44],
  ['NORWAY', 'M738 399 Q780 362 799 308', 99],
  ['SWEDEN', 'M933 444 Q971 402 985 347', 99],
  ['FINLAND', 'M1303 275 Q1348 254 1376 214', 86],
  ['DENMARK', 'M747 671 Q767 648 773 619', 52],
  ['GERMANY', 'M825 884 Q870 896 916 884', 82],
  ['POLAND', 'M1046 915 Q1098 918 1144 894', 90],
  ['BALTIC STATES', 'M1236 692 Q1279 658 1300 608', 95],
  ['WESTERN UKRAINE', 'M1258 1062 Q1326 1051 1381 1007', 122],
  ['BELARUS', 'M1364 764 Q1411 777 1458 764', 86],
  ['SOVIET UNION', 'M1651 688 Q1739 692 1817 653', 153],
  ['ROMANIA', 'M1237 1207 Q1283 1213 1326 1195', 81],
  ['YUGOSLAVIA', 'M1050 1271 Q1089 1307 1140 1319', 92],
  ['NORTHERN ITALY', 'M728 1223 Q782 1252 843 1252', 106],
  ['SOUTHERN ITALY', 'M941 1438 Q957 1484 994 1517', 86],
  ['GREECE', 'M1188 1500 Q1195 1532 1216 1557', 58],
  ['SPAIN', 'M271 1499 Q325 1506 375 1486', 94],
  ['PORTUGAL', 'M163 1571 Q180 1536 177 1497', 68],
  ['SWITZERLAND', 'M678 1168 Q720 1170 757 1151', 72],
  ['SOUTHERN FRANCE', 'M499 1314 Q558 1314 610 1286', 103],
  ['GREATER SOUTHERN GERMANY', 'M824 1129 Q897 1135 964 1104', 128],
];
function buildLandLabels(map,layer,exercise){
  const defs=map.querySelector('defs');
  const activeLabels=exercise.world?[]:[...landNames];
  if(!exercise.world&&exercise.forces.ep)activeLabels.push(['Eastern Poland','M1253 947 Q1292 940 1340 912',84],['Bessarabia','M1392 1100 Q1414 1135 1440 1160',65]);
  if(exercise.world){
    for(const [id,sector] of Object.entries(exercise.shapes)){
      if(places[id].water)continue;
      const [x,y,span]=sector.label;
      activeLabels.push([places[id].name,`M${x-span/2} ${y} q${span/2} 3 ${span} 0`,span,
        [sector.label,...sector.alternateLabels]]);
    }
  }
  return activeLabels.map(([name,curve,span,positions],index)=>{
    const id='land-name-'+index;
    const path=node('path',{id,d:curve});defs.append(path);
    const size=Math.min(14*(exercise.projection?.detailScale||1),span/(name.length*.68));
    const length=Math.min(span,size*name.length*.77);
    const text=node('text',{'font-family':'Georgia,serif','font-size':size,'text-anchor':'middle',
      'fill':'#494c3e','paint-order':'stroke',stroke:'#e7e2ce','stroke-width':1.6,'stroke-linejoin':'round'});
    text.append(node('textPath',{href:'#'+id,startOffset:'50%',textLength:length,lengthAdjust:'spacing'},name));
    layer.append(text);
    const candidates=positions?.map(([x,y,width])=>{
      const font=Math.min(14*exercise.projection.detailScale,width/(name.length*.68));
      const inkWidth=Math.min(width,font*name.length*.77);
      return {x,y,font,inkWidth,box:[x-inkWidth/2,y-font,x+inkWidth/2,y+5],
        curve:`M${x-width/2} ${y} q${width/2} 3 ${width} 0`};
    });
    return {text,size,path,candidates};
  });
}
const ownerStyle={
  Germany:{code:'DE',counter:'#334334',paper:'#e6dfbd',ink:'#4d5845',hatch:'german-hatch',angle:37},
  Italy:{code:'IT',counter:'#66472d',paper:'#e3c5a3',ink:'#87582e',hatch:'italian-hatch',angle:52},
  'Soviet Union':{code:'SU',counter:'#743d38',paper:'#e3c4af',ink:'#89483d',hatch:'soviet-hatch',angle:-52},
  France:{code:'FR',counter:'#294c60',paper:'#d8e6e5',ink:'#345f8a',hatch:'french-hatch',angle:-37}
};
const nationalInks={
  'United Kingdom':['UK','#76603e','#ead6ac'],Japan:['JP','#86651e','#eddba0'],'United States':['US','#455939','#d7dfb0'],
  China:['CN','#596a36','#deebbc'],ANZAC:['AZ','#435d63','#c4d8d3'],Netherlands:['NL','#97653d','#e7d5ba'],
  Neutral:['—','#666254','#e6dfcf']
};
for(const [nation,[code,counter,paper]] of Object.entries(nationalInks)){
  ownerStyle[nation]={code,counter,ink:counter,paper,hatch:'hatch-'+code,angle:code==='JP'?42:-32};
}
function styleFor(nation){return ownerStyle[nation]||ownerStyle.Neutral;}
const counterCodes={transport:'TR',submarine:'SS',destroyer:'DD',cruiser:'CA',carrier:'CV',battleship:'BB',
  harbour:'NB',airfield:'AB',factory_minor:'IC',factory_major:'IC'};
function worldSeats(exercise,bands){
  for(const [id,sector] of Object.entries(exercise.shapes)){
    const [x,y]=sector.center;
    formations[id]={center:[x,y],home:sector.home||{inf:[x-18,y+14],tank:[x+18,y-18]}};
  }
  for(const from of Object.keys(exercise.forces)){
    for(const to of places[from].targets){
      if(formations[to][from])continue;
      const [x,y]=position(to),[ox,oy]=position(from);
      const length=Math.hypot(ox-x,oy-y)||1,dx=(ox-x)/length,dy=(oy-y)/length;
      const room=exercise.shapes[to].formationScale??exercise.projection.detailScale;
      const side=Math.sign(-dy*(formations[from].home.inf[0]-ox)+dx*(formations[from].home.inf[1]-oy))||1;
      const path=bands[to]?.region;
      let fit=room;
      const offset=(along,across)=>[x+fit*(along*dx-across*dy),y+fit*(along*dy+across*dx)];
      // Keep the two approach lanes in departure order and use the available
      // frontage. On small islands the pair moves inward together.
      const arrivals=()=>({inf:offset(86,side*43),tank:offset(78,-side*43)});
      let seats=arrivals();
      while(path&&fit>.2&&Object.values(seats).some(p=>!path.isPointInFill(new DOMPoint(...p)))){
        fit*=.85;seats=arrivals();
      }
      formations[to][from]=seats;
      const key=from+'-'+to;
      frontLines[key]=[offset(44,32),offset(44,-32)];
      approaches[key]={};
      for(const type of types){
        const [a,b]=formations[from].home[type],[c,d]=seats[type];
        const bend=Math.min(length*.15,40*exercise.projection.detailScale)*(type==='inf'?side:-side);
        approaches[key][type]=[[a+(c-a)*.32-dy*bend,b+(d-b)*.32+dx*bend],
          [a+(c-a)*.72-dy*bend*.6,b+(d-b)*.72+dx*bend*.6]];
      }
    }
  }
}
// Pick supporting-counter seats once, inside the printed territory where space allows.
function supportingSeats(path,formation,required,detailScale){
  const [x,y]=formation.center,points=[];
  const reserved=Object.entries(formation).filter(([name])=>name!=='center').flatMap(([,pair])=>Object.values(pair));
  const xy=new DOMPoint();
  function inside(a,b){xy.x=a;xy.y=b;return path.isPointInFill(xy);}
  for(const spacing of [1,.70,.42]){
    for(let ring=0;ring<=9&&points.length<required;ring++){
      const count=Math.max(1,ring*8);
      for(let i=0;i<count&&points.length<required;i++){
        const angle=i/count*2*Math.PI+ring*.3;
        const a=x+Math.cos(angle)*ring*17*detailScale,b=y+Math.sin(angle)*ring*15*detailScale;
        if(!inside(a,b)||!inside(a-15*spacing*detailScale,b-9*spacing*detailScale)||!inside(a+15*spacing*detailScale,b+9*spacing*detailScale))continue;
        if(reserved.some(([u,v])=>Math.abs(a-u)<49*spacing*detailScale&&Math.abs(b-v)<38*spacing*detailScale))continue;
        if(points.some(([u,v])=>Math.abs(a-u)<40*spacing*detailScale&&Math.abs(b-v)<25*spacing*detailScale))continue;
        points.push([a,b]);
      }
    }
  }
  return points;
}
function buildControlBands(map,shapes,regions,sectors,washes){
  const defs=map.querySelector('defs'), layer=map.querySelector('#controlBands');
  for(const {ink,hatch,angle} of Object.values(ownerStyle)){
    const pattern=node('pattern',{id:hatch,patternUnits:'userSpaceOnUse',width:4.2,height:4.2,patternTransform:'rotate('+angle+')'});
    pattern.append(node('path',{d:'M2 0V4.2',stroke:ink,'stroke-width':.8}));
    defs.append(pattern);
  }
  const bands={};
  for(const [id,d] of Object.entries(shapes)){
    const href='#territory-'+id;
    defs.append(node('path',{id:href.slice(1),d}));
    const clip=node('clipPath',{id:'inside-'+id});
    clip.append(node('use',{href}));defs.append(clip);
    const band=node('g',{'clip-path':'url(#inside-'+id+')',fill:'none','stroke-linejoin':'round'});
    const maskId='wash-'+id;
    const wash=node('mask',{id:maskId,maskUnits:'objectBoundingBox',maskContentUnits:'objectBoundingBox',
      x:0,y:0,width:1,height:1,'mask-type':'alpha'});
    wash.append(node('image',{width:1,height:1,preserveAspectRatio:'none',
      href:'data:image/png;base64,'+washes[sectors?places[id].name:id]}));
    defs.append(wash);
    band.append(node('use',{href,fill:'currentColor',mask:'url(#'+maskId+')'}));
    let border=href;
    if(sectors){
      const d=sectors[id].frontier;
      border='#frontier-'+id;
      defs.append(node('path',{id:border.slice(1),d}));
      band.append(node('use',{href,
        stroke:'currentColor','stroke-width':'var(--inner)','stroke-opacity':.16}));
    }
    band.append(node('use',{href:border,stroke:'currentColor','stroke-width':'var(--outer)',opacity:.15}),
      node('use',{href:border,stroke:'currentColor','stroke-width':'var(--inner)',opacity:.29}),
      node('use',{href:border,'stroke-width':'var(--outer)',opacity:sectors ? .48 : .60}));
    layer.append(band);
    const region=node('path',{d,fill:'transparent','data-place':id});
    region.append(node('title',{}));regions.append(region);
    bands[id]={band,region};
  }
  for(const [from,{targets}] of Object.entries(places)){
    if(!shapes[from])continue;
    for(const to of targets){
      const clip=node('clipPath',{id:'route-'+from+'-'+to});
      clip.append(node('use',{href:'#territory-'+from}),node('use',{href:'#territory-'+to}));
      defs.append(clip);
    }
  }
  return bands;
}
function buildSeaZones(map,chart){
  const layer=map.querySelector('#seaZones'), numbers=node('g',{'pointer-events':'none'});
  const zones=new Map();
  for(const {number,label,d,neighbors,room,ruleRoom} of chart.zones){
    const area=node('path',{d,stroke:'none','fill-rule':'evenodd',fill:'transparent','data-sea':number,
      'aria-label':'Sea zone '+number});
    area.append(node('title',{},'Sea zone '+number));layer.append(area);
    const [x,y]=label;
    const mark=node('g',{transform:'translate('+x+' '+y+')'});
    // Short horizontal rules distinguish a zone number from a depth contour.
    mark.append(node('path',{d:'M-19 0h4m30 0h4',stroke:'#344f59','stroke-width':1.1}),
      node('text',{y:4.3,'text-anchor':'middle','font-family':'Arial, sans-serif','font-size':13.5,
        'font-weight':700,'letter-spacing':.65,fill:'#314e59',stroke:'#c5d5cd','stroke-width':2.2,
        'paint-order':'stroke'},number));
    numbers.append(mark);
    zones.set(String(number),{area,mark,x,y,neighbors,room,ruleRoom});
  }
  if(chart.globalDividers){
    layer.append(node('path',{d:chart.globalDividers,fill:'none',stroke:'#365664','stroke-width':1.3,'vector-effect':'non-scaling-stroke',opacity:.73,
      'stroke-dasharray':'6 3','pointer-events':'none'}));
  }
  layer.append(node('path',{d:chart.dividers,fill:'none',stroke:'#365664','stroke-width':1.3,
    'stroke-dasharray':'6 3','vector-effect':'non-scaling-stroke',opacity:.73,'pointer-events':'none'}),numbers);
  return zones;
}
const bound=(v,min,max)=>Math.min(max,Math.max(min,v));
// The downloadable HTML embeds the same sheets that the PWA caches on disk.
const embeddedSheets=null;
function terrainSheets(layout,extent){
  const layer=document.getElementById('worldTiles');
  const width=extent.width/layout.columns,height=extent.height/layout.rows;
  const bleedX=width*layout.bleed/layout.tileWidth,bleedY=height*layout.bleed/layout.tileHeight;
  const mounted=new Map();
  let previous='';
  return (view,vw,vh,scale)=>{
    const close=scale*window.devicePixelRatio>.54;
    const x0=Math.max(0,Math.floor((view.x-vw/2)/width)),y0=Math.max(0,Math.floor((view.y-vh/2)/height));
    const x1=Math.min(layout.columns-1,Math.floor((view.x+vw/2)/width)),y1=Math.min(layout.rows-1,Math.floor((view.y+vh/2)/height));
    const key=close?[x0,y0,x1,y1].join(','):'overview';
    if(key===previous)return;
    previous=key;
    const visible=new Set();
    if(close){
      for(let row=y0;row<=y1;row++){
        for(let col=x0;col<=x1;col++){
          const id=col+'-'+row;
          visible.add(id);
          if(mounted.has(id))continue;
          const href=embeddedSheets?.[row*layout.columns+col]||'./assets/world-tiles/'+id+'.webp';
          const image=node('image',{x:col*width-bleedX,y:row*height-bleedY,
            width:width+2*bleedX,height:height+2*bleedY,preserveAspectRatio:'none',href});
          mounted.set(id,image);
          layer.append(image);
        }
      }
    }
    for(const [id,image] of mounted){
      if(!visible.has(id)){image.remove();mounted.delete(id);}
    }
  };
}
export async function atlas(onPick,onView,initial,exercise) {
  const map=document.querySelector('#map'), forces=document.querySelector('#forces'), regions=document.querySelector('#regions'),routes=document.querySelector('#routes');
  const western=await (await fetch('./assets/territories.json')).json();
  const other=await (await fetch('./assets/fronts.json')).json();
  const shapes=Object.fromEntries(Object.keys(exercise.forces).filter(id=>!places[id].water).map(id=>[id,exercise.world?exercise.shapes[id].d:western[id]||other[id]]));
  let chart=await (await fetch('./assets/sea-zones.json')).json();
  if(exercise.world){
    const seas=Object.entries(exercise.shapes).filter(([id])=>places[id].water);
    chart={dividers:'',globalDividers:seas.map(([,sector])=>sector.dividers).join(''),zones:seas.map(([id,sector])=>({
      number:parseInt(places[id].name),d:sector.d,label:sector.numberAt||sector.center,room:sector.room,ruleRoom:sector.ruleRoom,
      neighbors:places[id].links.filter(n=>n.endsWith(' Sea Zone')).map(n=>parseInt(n))
    }))};
    const worldPlate=document.getElementById('worldPlate');worldPlate.removeAttribute('display');
    worldPlate.setAttribute('href',worldPlate.dataset.src);
    const engraving=document.getElementById('worldEngraving');engraving.setAttribute('href',engraving.dataset.src);
    document.getElementById('europeX').setAttribute('display','none');
  }
  const extent=exercise.world?{left:0,top:0,width:exercise.projection.width,height:exercise.projection.height}:{left:0,top:0,width:2006,height:1716};
  const drawSheets=exercise.world?terrainSheets(await (await fetch('./assets/world-terrain.json')).json(),extent):null;
  const detailScale=exercise.projection?.detailScale||1;
  const washes=await (await fetch('./assets/control-washes.json')).json();
  const bands=buildControlBands(map,shapes,regions,exercise.world?exercise.shapes:null,exercise.world?washes.world:washes.exercise);
  const zones=buildSeaZones(map,chart);
  if(exercise.world){
    worldSeats(exercise,bands);
    for(const [id,sector] of Object.entries(exercise.shapes)){
      const path=bands[id]?.region||zones.get(String(parseInt(places[id].name)))?.area;
      if(path&&sector.stacks)sector.slots=supportingSeats(path,formations[id],sector.stacks,detailScale);
    }
  }
  const control=map.querySelector('#controlBands'), intel=document.querySelector('#mapIntel');
  let inspectedPlace=null, inspectedSea=null, lastBattle=null, lastScale=0;
  function inspectSea(id){
    if(inspectedSea)zones.get(inspectedSea).area.setAttribute('fill','transparent');
    inspectedSea=id;
    if(id)zones.get(id).area.setAttribute('fill','#426d8133');
  }
  const labelGroup=document.querySelector('#labels'),towns=[];
  for(const [name,lon,lat,kind,boardX,boardY] of labels){
    const [x,y]=exercise.world?[boardX*extent.width/320,boardY*extent.height/146]:project(lon,lat);
    if(kind==='city')labelGroup.append(node('circle',{cx:x,cy:y,r:2.4*detailScale,fill:'#42463a'}));
    const caption=node('text',{x:kind==='city'?x+5*detailScale:x,y:kind==='city'?y-4*detailScale:y,'text-anchor':kind==='city'?'start':'middle',
      fill:kind==='water'?'#506b6c':'#535747','font-family':kind==='city'?'Arial, sans-serif':'Georgia,serif','font-weight':kind==='city'?600:400,'font-size':(kind==='city'?7.2:kind==='water'?15:13)*detailScale,'letter-spacing':(kind==='city'?0:kind==='water'?2:1.8)*detailScale,'font-style':kind==='water'?'italic':'normal',
      'paint-order':'stroke','stroke-width':1.8*detailScale,stroke:kind==='water'?'#bacbcc':'#dcd9c1'},name);
    labelGroup.append(caption);
    if(exercise.world&&kind==='city')towns.push({caption,x,y,width:name.length*4.6*detailScale});
  }
  const cityMarks=(exercise.cities||theaterVictoryCities).map(city=>{
    const [x,y]=city.point||project(city.lon,city.lat),capital=Boolean(city.capitalOf);
    const caption=city.name+' · Victory city'+(capital?' · Capital of '+city.capitalOf:'');
    const mark=node('g',{'data-victory-city':city.name,role:'img','aria-label':caption});
    const left=city.name==='Paris'||city.name==='Stalingrad';
    mark.append(node('title',{},caption),node('circle',{r:6.1,fill:'#f6efda',stroke:capital?'#84462e':'#526051','stroke-width':.9}),
      node('path',{d:capital?'M0 -5 1.4 -1.6 5 -1.5 2.1 1 3 4.4 0 2.7 -3 4.4 -2.1 1 -5 -1.5 -1.4 -1.6Z':'M0 -4.4 3.8 0 0 4.4 -3.8 0Z',
        fill:capital?'#85452d':'#465747'}));
    const name=node('text',{x:left?-8:8,y:3,'text-anchor':left?'end':'start',fill:'#443c30',
      'font-family':'Georgia,serif','font-size':9,'font-weight':700,stroke:'#f3ecd7','stroke-width':2,'paint-order':'stroke'},city.name);
    mark.append(name);labelGroup.append(mark);
    return {mark,name,x,y};
  });
  const detailPlate=map.querySelector('#detailPlate');
  const landLabels=buildLandLabels(map,labelGroup,exercise);
  const selection=map.querySelector('#selection'),reveal=map.querySelector('#pencil-stroke');
  reveal.setAttribute('d',pencilLine);
  const fronts=map.querySelector('#fronts'), frontMarks=new Map();
  let selectionKey='',routeKey='',layoutSeed,offsets;
  let routeStarts=new Map();
  function showSelection(key,at,tokenScale){
    if(key!==selectionKey){
      selection.replaceChildren();
      reveal.getAnimations().forEach(animation=>animation.cancel());
      if(key){
        selection.append(pencilMark());
        if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
          reveal.animate([{strokeDashoffset:1},{strokeDashoffset:0}],{duration:480,easing:'ease-out'});
      }
      selectionKey=key;
    }
    if(key)selection.setAttribute('transform','translate('+at.join(' ')+') scale('+tokenScale+')');
  }
  let game=null,focus=null,target=null,selectedType=null,selectedNation=null;
  let view=initial&&(!exercise.world||initial.projection===exercise.projection.id)&&[initial.x,initial.y,initial.z].every(Number.isFinite)?{...initial}:{...exercise.camera};
  // Store zoom in Western Front survey units even though the printed projection
  // has more map units per comparable view. Older saves used raw board units.
  const migrate=exercise.world&&view.projection===exercise.projection.id&&!view.surveyZoom;
  if(migrate)view.z*=detailScale;
  if(exercise.world)view.surveyZoom=true;
  const maxZoom=2,minZoom=exercise.world ? .025*detailScale : .15;
  view.z=bound(view.z,minZoom,maxZoom);
  if(initial&&(migrate||initial.z!==view.z))onView({...view});
  const pointers=new Map();let gesture=null;
  function metrics(){
    const w=map.clientWidth||1,h=map.clientHeight||1;
    const base=Math.min(w/650,h/480)/detailScale;
    const scale=Math.max(Math.min(w/extent.width,h/extent.height),base*view.z);
    return {w,h,scale,vw:w/scale,vh:h/scale,base};
  }
  function render(){
    const {vw,vh,scale}=metrics();
    if(!exercise.world){
      const display=scale*window.devicePixelRatio>2?'inline':'none';
      if(detailPlate.getAttribute('display')!==display)detailPlate.setAttribute('display',display);
    }
    view.x=extent.left+(vw>=extent.width?extent.width/2:bound(view.x-extent.left,vw/2,extent.width-vw/2));
    view.y=extent.top+(vh>=extent.height?extent.height/2:bound(view.y-extent.top,vh/2,extent.height-vh/2));
    drawSheets?.(view,vw,vh,scale);
    document.getElementById('zoomIn').disabled=view.z>=maxZoom;
    map.setAttribute('viewBox',[view.x-vw/2,view.y-vh/2,vw,vh].join(' '));
    document.querySelector('#scale').textContent=Math.round(view.z*100)+'%';
    let lon=view.x/34-13,lat=69-view.y/52;
    if(exercise.world){
      const {grid,columns,rows}=exercise.projection;
      const gx=bound(view.x/extent.width*(columns-1),0,columns-1),gy=bound(view.y/extent.height*(rows-1),0,rows-1);
      const i=Math.min(Math.floor(gx),columns-2),j=Math.min(Math.floor(gy),rows-2);
      const p=grid[j*columns+i],q=grid[j*columns+i+1],r=grid[(j+1)*columns+i],s=grid[(j+1)*columns+i+1];
      const blend=k=>(p[k]+(q[k]-p[k])*(gx-i))*(1-gy+j)+(r[k]+(s[k]-r[k])*(gx-i))*(gy-j);
      lon=((blend(0)+540)%360)-180;lat=blend(1);
      view.projection=exercise.projection.id;
      view.surveyZoom=true;
    }
    document.querySelector('#coordinates').textContent=Math.abs(lat).toFixed(1)+'° '+(lat<0?'S':'N')+'   '+Math.abs(lon).toFixed(1)+'° '+(lon<0?'W':'E');
    if(!exercise.world)for(const {text,size} of landLabels){
      text.style.display=view.z>=1.05 && size*scale>=9?'':'none';
    }
    if(scale!==lastScale){
      for(const {mark,name,x,y} of cityMarks){
        mark.setAttribute('transform','translate('+x+' '+y+') scale('+bound(1/scale,.52,3.5)+')');
        name.style.display=scale<.35?'none':'';
      }
      const width=bound(10/scale,3.2,16*detailScale);
      for(const {hatch,angle} of Object.values(ownerStyle)){
        document.getElementById(hatch).setAttribute('patternTransform','rotate('+angle+') scale('+bound(1/scale,.25,1.4*detailScale)+')');
      }
      control.style.setProperty('--outer',width+'px');
      control.style.setProperty('--inner',width*.48+'px');
      for(const {mark,x,y,room,ruleRoom} of zones.values()){
        const size=Math.min(1/scale,room);
        mark.setAttribute('transform','translate('+x+' '+y+') scale('+size+')');
        mark.firstChild.style.display=size>ruleRoom?'none':'';
        mark.style.display=size*scale<.65?'none':'';
      }
      lastScale=scale;
    }
    if(!game)return;
    for(const [id,{band,region}] of Object.entries(bands)){
      const owner=game.owners[id];
      if(band.dataset.owner===owner)continue;
      band.dataset.owner=owner;
      band.style.color=styleFor(owner).ink;
      band.lastChild.setAttribute('stroke','url(#'+styleFor(owner).hatch+')');
      region.firstChild.textContent=places[id].name+' · '+owner+' control';
    }
    const selectedLand=inspectedSea?null:(game.phase==='plan'?target||focus:inspectedPlace||game.active);
    const info=inspectedSea?'Sea zone '+inspectedSea+' · Adjacent '+zones.get(inspectedSea).neighbors.join(', '):
      bands[selectedLand]?places[selectedLand].name+' · '+game.owners[selectedLand]+' control':'';
    if(intel.textContent!==info)intel.textContent=info;
    forces.replaceChildren();
    for(const region of regions.children){
      const id=region.dataset.place;
      const legal=game.phase==='plan'&&places[focus]?.targets.includes(id);
      region.classList.toggle('selected-territory',id===selectedLand);
      region.setAttribute('fill',legal?'#d6b65728':'transparent');
      region.setAttribute('stroke',legal?'#895a31':'none');
      region.setAttribute('stroke-width','2');
    }
    const tacticalZoom=view.z;
    const compact=tacticalZoom<.66;
    // Taper counter size at the widest tactical scales; keep the interior seats stable
    // while panning, and tighten their spacing at close zoom.
    const tokenScale=Math.min(1/scale,1.2*detailScale);
    const spread=bound(1/(1.2*scale*detailScale),.66,1);
    const nextRouteKey=[scale,layoutSeed,game.phase,JSON.stringify(game.orders)].join('|');
    if(routeKey!==nextRouteKey){
      const nextStarts=new Map(),now=performance.now();
      routes.replaceChildren();
      for(const order of game.orders){
        for(const type of types.filter(t=>order.units[t]>0)){
          const key=order.from+'-'+order.to+'-'+type;
          const start=routeStarts.get(key)??(routeKey?now:-Infinity);
          nextStarts.set(key,start);
          const planned=game.phase==='plan';
          routes.append(attackArrow(order,type,spread,tokenScale,offsets,planned,planned?now-start:Infinity,detailScale));
        }
      }
      routeStarts=nextStarts;routeKey=nextRouteKey;
    }
    const occupied=[];
    function reserveStack([x,y],k,caption){
      if(!exercise.world)return;
      occupied.push([x-21*k,y-13*k,x+21*k,y+13*k]);
      if(caption){
        const half=(caption.length*3.4+2)*k;
        occupied.push([x-half,y+13*k,x+half,y+27*k]);
      }
    }
    const activeFronts=new Set();
    let selectedAt=null,selectionScale=tokenScale;
    for(const id of Object.keys(game.units)){
      const [x,y]=position(id),nation=game.owners[id],friendly=nation===exercise.attacker;
      if(exercise.world&&(Math.abs(x-view.x)>vw/2+180||Math.abs(y-view.y)>vh/2+180))continue;
      const units=game.phase==='plan'&&friendly?available(game,id):game.units[id];
      const groups=arrivals(game,id).filter(group=>types.some(type=>group.units[type]>0));
      for(const group of groups){
        const key=group.from+'-'+id;
        activeFronts.add(key);
        if(!frontMarks.has(key)){
          const mark=drawFront(group.from,id);
          fronts.append(mark.group);frontMarks.set(key,mark);
        }
        const mark=frontMarks.get(key),ink=mark.ink;
        updateFront(mark,group.units);
        const transform=frontTransform(id,group,spread,tokenScale);
        if(ink.getAttribute('transform')!==transform)ink.setAttribute('transform',transform);
      }
      if(compact){
        if(!exercise.world||game.pieces[id].some(row=>row[2]>0))forces.append(node('circle',{cx:x,cy:y,r:Math.min(7/scale,exercise.world?22:Infinity),fill:styleFor(nation).counter,stroke:'#f7f2df','stroke-width':exercise.world?Math.min(1.6/scale,4):1.6/scale,'data-place':id}));
        continue;
      }
      const detailed=tacticalZoom>=1.55;
      const homeRows=exercise.world?game.pieces[id].filter(row=>row[2]>0):types.filter(t=>units[t]).map(t=>[null,t,units[t]]);
      let extraIndex=0;
      for(const [power,type,n] of homeRows){
        const country=power?ownerNames[power]||power:nation;
        const primary=types.includes(type)&&country===nation;
        const free=primary&&friendly?units[type]:n;
        if(!free)continue;
        const selected=id===focus&&type===selectedType&&(!selectedNation||country===selectedNation);
        let at;
        if(primary)at=seat(id,'home',type,spread,offsets);
        else{
          const slots=exercise.shapes[id].slots;
          const point=slots?.[extraIndex]||[x+(extraIndex%3-1)*36*detailScale,y+(Math.floor(extraIndex/3)+1)*24*detailScale];
          at=[x+(point[0]-x)*spread,y+(point[1]-y)*spread];extraIndex++;
        }
        const stack=drawStack(game,forces,id,type,free,country,'home',at,primary?tokenScale:tokenScale*.80,detailed,selected,null,!primary);
        reserveStack(at,primary?tokenScale:tokenScale*.80,(primary||selected)&&detailed&&stack.lastChild.textContent);
        if(game.phase==='plan'&&(exercise.world||friendly&&primary)){
          stack.setAttribute('role','button');stack.setAttribute('tabindex','0');
          stack.setAttribute('aria-pressed',String(selected));
        }
        if(selected){selectedAt=at;selectionScale=primary?tokenScale:tokenScale*.80;}
      }
      for(const group of groups){
        for(const type of types){
          if(!group.units[type])continue;
          const at=seat(id,group.from,type,spread,offsets);
          const stack=drawStack(game,forces,id,type,group.units[type],exercise.attacker,'incoming',at,tokenScale,detailed,false,group.from);
          reserveStack(at,tokenScale,detailed&&stack.lastChild.textContent);
        }
      }
    }
    if(exercise.world){
      const visible=(x,y)=>Math.abs(x-view.x)<vw/2+75&&Math.abs(y-view.y)<vh/2+45;
      const clear=([l,t,r,b])=>!occupied.some(([a,c,d,e])=>l<d&&r>a&&t<e&&b>c);
      for(const {x,y} of cityMarks){
        const k=bound(1/scale,.52,3.5);
        occupied.push([x-8*k,y-8*k,x+8*k,y+8*k]);
      }
      for(const {caption,x,y,width} of towns){
        if(!visible(x,y))continue;
        let placed=false;
        for(const [side,dy] of [[1,-4],[-1,-4],[1,11],[-1,11]]){
          const edge=x+side*5*detailScale,base=y+dy*detailScale;
          const box=[side>0?edge:edge-width,base-8*detailScale,side>0?edge+width:edge,base+2*detailScale];
          if(!clear(box))continue;
          caption.setAttribute('x',edge);caption.setAttribute('y',base);
          caption.setAttribute('text-anchor',side>0?'start':'end');
          occupied.push(box);placed=true;break;
        }
        caption.style.display=placed&&tacticalZoom>=.8?'':'none';
      }
      for(const label of landLabels){
        const choice=tacticalZoom>=1.05&&label.candidates.find(c=>c.font*scale>=9&&visible(c.x,c.y)&&clear(c.box));
        label.text.style.display=choice?'':'none';
        if(!choice)continue;
        occupied.push(choice.box);
        if(label.choice===choice)continue;
        label.path.setAttribute('d',choice.curve);
        label.text.setAttribute('font-size',choice.font);
        label.text.firstChild.setAttribute('textLength',choice.inkWidth);
        label.choice=choice;
      }
    }
    for(const [key,mark] of frontMarks){
      if(!activeFronts.has(key)){mark.group.remove();frontMarks.delete(key);}
    }
    // The overlay survives frequent force-layer redraws, so pan or quantity changes
    // reposition the mark without restarting the pencil.
    showSelection(selectedAt?focus+'-'+selectedType+'-'+(selectedNation||''):'',selectedAt,selectionScale);
  }
  function zoom(factor,px=map.clientWidth/2,py=map.clientHeight/2) {
    const old=metrics();const wx=view.x+(px-old.w/2)/old.scale,wy=view.y+(py-old.h/2)/old.scale;
    view.z=bound(view.z*factor,minZoom,maxZoom);const next=metrics();
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
    let hit=e.target.closest('[data-place],[data-sea]')?.dataset;
    // At wider zoom the printed faces shrink. Give taps in the surrounding territory
    // a 44 px target, resolving shared space to the nearest counter of that territory.
    if(hit?.place&&!hit.unit){
      let nearest=Infinity;
      for(const stack of forces.querySelectorAll('g[data-unit]')){
        if(stack.dataset.place!==hit.place)continue;
        const {e:x,f:y}=stack.getScreenCTM(),dx=e.clientX-x,dy=e.clientY-y;
        const distance=dx*dx+dy*dy;
        if(Math.abs(dx)<=22&&Math.abs(dy)<=22&&distance<nearest){
          hit=stack.dataset;nearest=distance;
        }
      }
    }
    const v=basis();gesture={...v,firstX:v.x,firstY:v.y,moved:v.n>1,id:hit?.place,type:hit?.unit,nation:hit?.nation,origin:hit?.origin,sea:hit?.sea};
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
    const tapped=e.type==='pointerup'&&gesture&&!gesture.moved;
    const id=gesture?.id, sea=gesture?.sea;
    const type=gesture?.type,origin=gesture?.origin,nation=gesture?.nation;
    pointers.delete(e.pointerId);
    gesture=pointers.size?{...basis(),moved:true}:null;
    if(tapped){
      inspectedPlace=game.phase==='plan'?null:id||null;
      inspectSea(sea && sea!==inspectedSea ? sea : null);
      if(id){
        if(view.z<.66){[view.x,view.y]=position(id);view.z=exercise.world?maxZoom:1.25;}
        onPick(id,type,origin,nation);
      }
      if(!id&&sea&&exercise.world)onPick('world-'+sea+'-sea-zone');
      render();
    }
    onView({...view});
  }
  function activateStack(event){
    const stack=event.target.closest('[data-unit][role="button"]');
    if(!stack)return;
    event.preventDefault();
    onPick(stack.dataset.place,stack.dataset.unit,null,stack.dataset.nation);
    const panel=document.getElementById('panel');
    const next=document.getElementById('ordersPanel').hidden?document.getElementById('openPanel'):
      panel.querySelector('button:not(:disabled)')||forces.querySelector('[role="button"]');
    next?.focus();
  }
  forces.addEventListener('keydown',event=>{
    if(!event.repeat&&(event.key==='Enter'||event.key===' '))activateStack(event);
  });
  forces.addEventListener('click',event=>{if(event.detail===0)activateStack(event);});
  map.addEventListener('pointerup',end);map.addEventListener('pointercancel',end);
  map.addEventListener('wheel',e=>{e.preventDefault();const p=coords(e);zoom(Math.exp(-bound(e.deltaY,-240,240)*.002),p.x,p.y);onView({...view});},{passive:false});
  function button(id,fn){document.getElementById(id).onclick=()=>{fn();render();onView({...view});};}
  button('zoomIn',()=>zoom(1.38));button('zoomOut',()=>zoom(1/1.38));
  button('recenter',()=>{view={...exercise.camera};});
  button('overview',()=>{const m=metrics();view={x:extent.left+extent.width/2,y:extent.top+extent.height/2,z:Math.min(m.w/extent.width,m.h/extent.height)/m.base};});
  new ResizeObserver(render).observe(map);
  return (s,id,to,type,seed,nation)=>{
    if(seed!==layoutSeed){offsets=homeOffsets(seed);layoutSeed=seed;}
    if(s.active!==lastBattle){
      inspectedPlace=null;inspectSea(null);lastBattle=s.active;
    }
    if(exercise.world&&s.phase==='plan'&&id!==focus){
      const sea=places[id]?.water?String(parseInt(places[id].name)):null;
      if(sea!==inspectedSea)inspectSea(sea);
    }
    game=s;focus=id;target=to;selectedType=type;selectedNation=nation;render();
  };
}
