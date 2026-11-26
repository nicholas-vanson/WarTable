// Complete-link grouping keeps a chain of close neighbors from swallowing a distant front.
export function nearbyGroups(items,distance,limit){
  const groups=[];
  for(const item of items){
    let nearest=null,best=Infinity;
    for(const group of groups){
      const farthest=Math.max(...group.map(other=>distance(item,other)));
      if(farthest<=limit&&farthest<best){nearest=group;best=farthest;}
    }
    if(nearest)nearest.push(item);else groups.push([item]);
  }
  return groups;
}
export function meanPoint(points){
  const [x,y]=points.reduce(([x,y],p)=>[x+p[0],y+p[1]],[0,0]);
  return [x/points.length,y/points.length];
}
export const pointGap=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

// Measure separation along the final stretch of the original curves, before counters
// snap to their rows. Crossing paths and arrows pointing back out get separate heads.
export function approachGap(a,b){
  if(a.loop||b.loop)return Infinity;
  const dot=a.direction[0]*b.direction[0]+a.direction[1]*b.direction[1];
  if(dot<.53)return Infinity;
  return Math.max(pointGap(a.tip,b.tip),pointGap(a.upstream,b.upstream)*.8);
}

// Use one counter-sized grid per nearby set of entrances. Keep occupied cells open
// for the garrison, even where a narrow coast leaves only part of a row available.
export function frontGrid(entrances,obstacles,k,inside,bounds){
  const seats=new Map(),fronts=new Map(),width=44*k,height=28*k;
  const occupied=obstacles.slice();
  const ordered=[...entrances].sort((a,b)=>a.from.localeCompare(b.from));
  const groups=nearbyGroups(ordered,(a,b)=>pointGap(a.center,b.center),83*k);
  for(const group of groups){
    const slots=group.flatMap(g=>g.slots);
    const center=meanPoint(slots.map(s=>s.point));
    const cols=Math.ceil(Math.sqrt(slots.length*.78)),rows=Math.ceil(slots.length/cols);
    const taken=([x,y])=>bounds&&(x<20*k||x>bounds.width-20*k||y<12*k||y>bounds.height-12*k)||occupied.some(([u,v])=>Math.abs(x-u)<42*k&&Math.abs(y-v)<26*k);
    const point=(col,row)=>[center[0]+(col-(cols-1)/2)*width,center[1]+(row-(rows-1)/2)*height];
    let cells=null,best=Infinity;
    // Slide the entire formation first. A half-cell offset often clears a
    // garrison while keeping all arriving stacks in a compact rectangle.
    for(let row=-4;row<=4;row++)for(let col=-4;col<=4;col++){
      let cost=(col*col+row*row)*.25;
      if(cost>=best)continue;
      const block=[];
      for(let i=0;i<slots.length;i++){
        const p=point(i%cols+col/2,Math.floor(i/cols)+row/2);
        if(!taken(p))block.push(p);
      }
      const missing=slots.length-block.length;
      cost+=missing*.75;
      if(cost>=best||missing>Math.floor(slots.length/3))continue;
      if(missing){
        const extra=[];
        for(let y=-1;y<=rows;y++)for(let x=-1;x<=cols;x++){
          if(x>=0&&x<cols&&y>=0&&y*cols+x<slots.length)continue;
          const p=point(x+col/2,y+row/2);
          if(!taken(p))extra.push({p,dist:pointGap(p,center)/height+(inside(p)?0:2)});
        }
        if(extra.length<missing)continue;
        block.push(...extra.sort((a,b)=>a.dist-b.dist).slice(0,missing).map(c=>c.p));
      }
      cost+=block.filter(p=>!inside(p)).length*.65;
      if(cost<best){best=cost;cells=block;}
    }
    if(!cells){
      const free=[];
      for(let ring=0;free.length<slots.length;ring++){
        for(let row=-ring;row<rows+ring;row++)for(let col=-ring;col<cols+ring;col++){
          if(Math.max(0,-col,col-cols+1,-row,row-rows+1)!==ring)continue;
          const p=point(col,row);
          if(!taken(p))free.push({p,cost:pointGap(center,p)/height+(inside(p)?0:2)});
        }
      }
      cells=free.sort((a,b)=>a.cost-b.cost).slice(0,slots.length).map(c=>c.p);
    }
    occupied.push(...cells);
    // Preserve the ordering across each frontage, including the last, partial row.
    const byX=(a,b)=>a[0]-b[0]||a[1]-b[1];
    cells.sort(byX);
    const pending=slots.slice().sort((a,b)=>byX(a.point,b.point));
    for(let i=0;i<cells.length;){
      let stop=i+1;
      while(stop<cells.length&&cells[stop][0]===cells[i][0])stop++;
      const column=pending.slice(i,stop).sort((a,b)=>a.point[1]-b.point[1]);
      column.forEach((slot,j)=>{
        seats.set(slot.key,cells[i+j]);fronts.set(slot.key,cells);
      });
      i=stop;
    }
  }
  return {seats,fronts};
}
