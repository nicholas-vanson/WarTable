export const ordersPanelKey='wartable.orders-panel.v1';
export const motionKey='wartable.motion.v1';

export function reducedMotion(){
  try{if(localStorage.getItem(motionKey)==='reduce')return true;}catch{}
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
