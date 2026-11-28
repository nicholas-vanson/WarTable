export const ordersPanelKey='wartable.orders-panel.v1';
export const motionKey='wartable.motion.v1';

export function reducedMotion(){
  try{if(localStorage.getItem(motionKey)==='reduce')return true;}catch{}
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const mapPreferencesChanged='wartable-map-preferences';
const mapPrefsKey='wartable.map-preferences.v1';
const mapOptions={
  terrain:['auto','overview'],labels:['auto','hidden'],side:['right','left'],
  zoom:['standard','fine','large'],wheel:['zoom','pan']
};

export function readMapPreferences(){
  let stored;
  try{stored=JSON.parse(localStorage.getItem(mapPrefsKey));}catch{}
  return Object.fromEntries(Object.entries(mapOptions).map(([key,options])=>
    [key,options.includes(stored?.[key])?stored[key]:options[0]]));
}
export function saveMapPreference(key,value){
  if(!Object.hasOwn(mapOptions,key)||!mapOptions[key].includes(value))throw Error('Unknown map preference');
  localStorage.setItem(mapPrefsKey,JSON.stringify({...readMapPreferences(),[key]:value}));
  window.dispatchEvent(new Event(mapPreferencesChanged));
}
