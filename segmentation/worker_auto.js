function postProgress(pct,text){ postMessage({type:'progress',pct,text}); }
function countOn(mask){ let c=0; for(let i=0;i<mask.length;i++) if(mask[i]) c++; return c; }
function adaptiveThreshold(gray,w,h,thr,targetMinFrac,targetMaxFrac){
  const n=w*h;
  let t=thr;
  let mask=null;
  for(let iter=0; iter<7; iter++){
    mask=thresholdMask(gray,w,h,t);
    const c=countOn(mask);
    const frac=c/n;
    if(frac<targetMinFrac){ t=Math.max(0, t-15); continue; }
    if(frac>targetMaxFrac){ t=Math.min(255, t+15); continue; }
    return {mask, t, c};
  }
  const c=countOn(mask);
  return {mask, t, c};
}
function thresholdMask(gray,w,h,thr){
  const m=new Uint8Array(w*h);
  for(let i=0;i<m.length;i++) m[i]=gray[i]>=thr?255:0;
  return m;
}
function boxDilate(src,w,h,r){
  if(r<=0) return src;
  const dst=new Uint8Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    let on=0;
    const y0=Math.max(0,y-r), y1=Math.min(h-1,y+r);
    const x0=Math.max(0,x-r), x1=Math.min(w-1,x+r);
    for(let yy=y0; yy<=y1 && !on; yy++){
      const row=yy*w;
      for(let xx=x0; xx<=x1; xx++) if(src[row+xx]){on=1;break;}
    }
    dst[y*w+x]=on?255:0;
  }
  return dst;
}
function boxErode(src,w,h,r){
  if(r<=0) return src;
  const dst=new Uint8Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    let ok=1;
    const y0=Math.max(0,y-r), y1=Math.min(h-1,y+r);
    const x0=Math.max(0,x-r), x1=Math.min(w-1,x+r);
    for(let yy=y0; yy<=y1 && ok; yy++){
      const row=yy*w;
      for(let xx=x0; xx<=x1; xx++) if(!src[row+xx]){ok=0;break;}
    }
    dst[y*w+x]=ok?255:0;
  }
  return dst;
}
function keepLargestCC(mask,w,h){
  const n=w*h, vis=new Uint8Array(n);
  const q=new Int32Array(n);
  let best=-1,bestSize=0;
  function bfs(start){
    let qh=0,qt=0; q[qt++]=start; vis[start]=1; let size=0;
    while(qh<qt){
      const i=q[qh++]; size++;
      const x=i%w, y=(i/w)|0;
      if(x>0){const j=i-1; if(!vis[j]&&mask[j]){vis[j]=1;q[qt++]=j;}}
      if(x<w-1){const j=i+1; if(!vis[j]&&mask[j]){vis[j]=1;q[qt++]=j;}}
      if(y>0){const j=i-w; if(!vis[j]&&mask[j]){vis[j]=1;q[qt++]=j;}}
      if(y<h-1){const j=i+w; if(!vis[j]&&mask[j]){vis[j]=1;q[qt++]=j;}}
    }
    return size;
  }
  for(let i=0;i<n;i++) if(mask[i]&&!vis[i]){
    const s=bfs(i); if(s>bestSize){bestSize=s; best=i;}
  }
  if(best<0) return mask;
  vis.fill(0);
  const out=new Uint8Array(n);
  let qh=0,qt=0; q[qt++]=best; vis[best]=1; out[best]=255;
  while(qh<qt){
    const i=q[qh++]; const x=i%w, y=(i/w)|0;
    if(x>0){const j=i-1; if(!vis[j]&&mask[j]){vis[j]=1;out[j]=255;q[qt++]=j;}}
    if(x<w-1){const j=i+1; if(!vis[j]&&mask[j]){vis[j]=1;out[j]=255;q[qt++]=j;}}
    if(y>0){const j=i-w; if(!vis[j]&&mask[j]){vis[j]=1;out[j]=255;q[qt++]=j;}}
    if(y<h-1){const j=i+w; if(!vis[j]&&mask[j]){vis[j]=1;out[j]=255;q[qt++]=j;}}
  }
  return out;
}
function invertIfNeeded(gray,w,h){
  let sum=0,n=w*h;
  for(let i=0;i<n;i+=20) sum+=gray[i];
  const avg=sum/Math.ceil(n/20);
  if(avg>180){ const out=new Uint8Array(n); for(let i=0;i<n;i++) out[i]=255-gray[i]; return out; }
  return gray;
}
let total=0,done=0;
onmessage=(e)=>{
  const m=e.data;
  try{
    if(m.type==='start'){ total=m.total||0; done=0; postProgress(0,'Auto: preparing…'); return; }
    if(m.type==='job'){
      const {jobIndex,total:tt,zIndex,mode,thr,smooth,keepLargest,width,height}=m;
      const gray=new Uint8Array(m.gray);
      postProgress(Math.round((jobIndex-1)/tt*100),`Auto: ${jobIndex}/${tt}`);
      const g2=invertIfNeeded(gray,width,height);
      let t=thr; if(mode==='bone') t=Math.max(0,Math.min(255,thr-20));
      // adaptive threshold to avoid empty masks
const targets = (mode==='bone') ? {min:0.01, max:0.65} : {min:0.002, max:0.35};
const at = adaptiveThreshold(g2,width,height,t,targets.min,targets.max);
let mask = at.mask;
let usedThr = at.t;
let onCount = at.c;
      const r=Math.max(0,Math.min(5,smooth));
      if(r){
        mask=boxDilate(mask,width,height,r);
        mask=boxErode(mask,width,height,r);
        const r2=Math.max(1,r-1);
        mask=boxErode(mask,width,height,r2);
        mask=boxDilate(mask,width,height,r2);
      }
      if(keepLargest) mask=keepLargestCC(mask,width,height);
      done++;
      postMessage({type:'result',zIndex, width, height, alphaMask: mask.buffer, usedThr, onCount}, [mask.buffer]);
      postProgress(Math.round(done/tt*100),`Auto: ${done}/${tt} done`);
      return;
    }
    if(m.type==='finish'){ postMessage({type:'done'}); return; }
  }catch(err){
    postMessage({type:'error',message:err?.message||String(err)});
  }
};
