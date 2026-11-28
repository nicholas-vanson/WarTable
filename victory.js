import {politicalPowers} from './politics.js';
export const globalCities=[
    ['London','United Kingdom',-.12,51.51,'United Kingdom'],['Paris','France',2.35,48.86,'France'],
    ['Berlin','Germany',13.41,52.52,'Germany'],['Rome','Southern Italy',12.5,41.9,'Italy'],['Moscow','Russia',37.62,55.75,'Soviet Union'],
    ['Warsaw','Poland',21.01,52.23],['Leningrad','Novgorod',30.32,59.94],['Stalingrad','Volgograd',44.51,48.71],
    ['Cairo','Egypt',31.24,30.04],['Ottawa','Ontario',-75.7,45.42],['Washington','Eastern United States',-77.04,38.9,'United States'],
    ['San Francisco','Western United States',-122.42,37.77],['Honolulu','Hawaiian Islands',-157.86,21.3],
    ['Tokyo','Japan',139.69,35.68,'Japan'],['Shanghai','Kiangsu',121.47,31.23],['Hong Kong','Kwangtung',114.17,22.32],
    ['Manila','Philippines',120.98,14.6],['Calcutta','India',88.36,22.57,'UK Pacific'],['Sydney','New South Wales',151.21,-33.87,'ANZAC']
  ];
const pacificCities=new Set(['San Francisco','Honolulu','Tokyo','Shanghai','Hong Kong','Manila','Calcutta','Sydney']);
const axisCapitals=['Berlin','Rome','Tokyo'],alliedCapitals=['London','Paris','Moscow','Washington'];
export function victorySide(p){
  if(['Germans','Italians','Japanese'].includes(p))return 'Axis';
  if(p==='UK_Pacific'||p==='Dutch'||Object.hasOwn(politicalPowers,p))return 'Allies';
  return null;
}
export function victoryStatus(match){
  const held=(side,names)=>globalCities.filter(([city,region])=>names(city)&&victorySide(match.board[region]?.owner)===side).map(([city])=>city);
  const axisHome=held('Axis',c=>axisCapitals.includes(c));
  return [
    {key:'europe',name:'Europe',side:'Axis',need:8,cities:held('Axis',c=>!pacificCities.has(c)),capitals:axisHome},
    {key:'pacific',name:'Pacific',side:'Axis',need:6,cities:held('Axis',c=>pacificCities.has(c)),capitals:axisHome},
    {key:'capitals',name:'Axis capitals',side:'Allies',need:3,cities:held('Allies',c=>axisCapitals.includes(c)),capitals:held('Allies',c=>alliedCapitals.includes(c))}
  ];
}
// Only the acting side can gain city control in its turn. Check every handoff,
// including the one immediately before the capturing power's next briefing.
export function checkVictoryHandoff(match,nextPower,nextRound){
  const holds={...match.victoryHolds};
  for(const goal of victoryStatus(match)){
    if(goal.cities.length<goal.need){delete holds[goal.key];continue;}
    if(!holds[goal.key]&&victorySide(match.power)===goal.side)holds[goal.key]={power:match.power,round:match.round};
    const since=holds[goal.key];
    if(since&&since.power===nextPower&&nextRound>since.round&&goal.capitals.length){
      match.victory={...goal,since,round:nextRound};break;
    }
  }
  match.victoryHolds=holds;
}
