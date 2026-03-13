/* Royal CBCT Segmentation (DICOM ZIP) — PWA
   Upload logic: copied/adapted from cbct.html (JSZip + daikon).
   Focus: Axial slice viewer + Auto/Manual masks.
*/

const $ = (id) => document.getElementById(id);

const state = {
  loaded:false,
  vol:null, // Float32Array (x*y*z)
  dims:{x:0,y:0,z:0},
  spacing:{x:1,y:1,z:1},
  meta:{ photometric:'MONOCHROME2' },
  z:0,

  showOverlay:true,
  tool:'brush',
  brushSize:18,
  maskAlpha:0.45,
  maskColor:'green',
  masks:new Map(), // key: zIndex -> ImageData (alpha channel)
  undo:[],
  worker:null,
  meshWorker:null,
  lastSTL:null,

  busy:false,

  wl:{ w:3000, l:800 },
};

const COLORS = { green:[40,255,140], red:[255,70,100], cyan:[70,255,255], yellow:[255,220,80] };

function setHUD(msg){ $('hud').textContent = msg; }
function setProg(p, msg){
  $('progBar').style.width = `${Math.max(0, Math.min(100, p))}%`;
  $('progText').textContent = msg || '';
}

function enableAfterLoad(ok){
  [
    'sliceRange','btnPrev','btnNext','btnExportMask','btnExportAll',
    'winW','winL','invert',
    'autoMode','autoPreset','thr','smooth','keepLargest','btnAuto','btnAutoAll',
    'toolBrush','toolEraser','brushSize','maskAlpha','maskColor','btnUndo','btnClearSlice','btnToggleOverlay','btnClearAll','ds','dsZ','btnBuildMesh','btnDownloadSTL'
  ].forEach(id => $(id).disabled = !ok);
}

function updateToolButtons(){
  $('toolBrush').classList.toggle('primary', state.tool === 'brush');
  $('toolEraser').classList.toggle('primary', state.tool === 'eraser');
}

function fitCanvasToWrap(){
  const wrap = document.querySelector('.canvasWrap');
  const rect = wrap.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const vc = $('viewCanvas');
  const mc = $('maskCanvas');
  vc.width = Math.floor(rect.width * dpr);
  vc.height= Math.floor(rect.height * dpr);
  mc.width = vc.width;
  mc.height= vc.height;
  render();
}
window.addEventListener('resize', fitCanvasToWrap);

function lut(v, w, l){
  const low = l - w/2;
  let t = (v - low) / w;
  t = Math.max(0, Math.min(1, t));
  return (t * 255) | 0;
}

function getIndex(x,y,z){
  const {x:sx, y:sy} = state.dims;
  return z*sx*sy + y*sx + x;
}

function getMaskForZ(z){
  return state.masks.get(z) || null;
}
function setMaskForZ(z, imgData){
  state.masks.set(z, imgData);
}
function ensureMaskForZ(z){
  let m = getMaskForZ(z);
  if(!m){
    const c = document.createElement('canvas');
    c.width = state.dims.x;
    c.height= state.dims.y;
    const ctx = c.getContext('2d');
    m = ctx.createImageData(c.width, c.height);
    setMaskForZ(z, m);
  }
  return m;
}

function pushUndo(){
  const m = getMaskForZ(state.z);
  if(!m) return;
  state.undo.push(new ImageData(new Uint8ClampedArray(m.data), m.width, m.height));
  if(state.undo.length > 20) state.undo.shift();
}

function undo(){
  const last = state.undo.pop();
  if(!last) return;
  setMaskForZ(state.z, last);
  render();
}

function clearSliceMask(){
  state.masks.delete(state.z);
  state.undo = [];
  render();
  updateMem();
}
function clearAllMasks(){
  state.masks.clear();
  state.undo = [];
  render();
  updateMem();
}

function drawContain(ctx, srcCanvas, w, h){
  const iw = srcCanvas.width, ih = srcCanvas.height;
  const s = Math.min(w/iw, h/ih);
  const dw = iw*s, dh = ih*s;
  const dx = (w - dw)/2, dy = (h - dh)/2;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcCanvas, dx, dy, dw, dh);
  return {dx,dy,dw,dh,s};
}

function buildSliceCanvasZ(z){
  const {x:sx, y:sy} = state.dims;
  const c = document.createElement('canvas');
  c.width = sx; c.height = sy;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(sx, sy);
  const d = img.data;

  const ww = state.wl.w, ll = state.wl.l;
  const invSel = $('invert').value;
  const invAuto = (state.meta.photometric === 'MONOCHROME1');
  const doInv = (invSel === 'auto') ? invAuto : (invSel === '1');

  for(let y=0; y<sy; y++){
    for(let x=0; x<sx; x++){
      const v = state.vol[getIndex(x,y,z)];
      let g = lut(v, ww, ll);
      if(doInv) g = 255 - g;
      const off = (y*sx + x) * 4;
      d[off] = g; d[off+1]=g; d[off+2]=g; d[off+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  return c;
}

function render(){
  const vc = $('viewCanvas');
  const mc = $('maskCanvas');
  const vctx = vc.getContext('2d');
  const mctx = mc.getContext('2d');
  const w = vc.width, h = vc.height;

  vctx.clearRect(0,0,w,h);
  mctx.clearRect(0,0,w,h);

  if(!state.loaded) return;

  const sliceCanvas = buildSliceCanvasZ(state.z);
  const fit = drawContain(vctx, sliceCanvas, w, h);

  if(state.showOverlay){
    const mask = getMaskForZ(state.z);
    if(mask){
      const tmp = document.createElement('canvas');
      tmp.width = mask.width; tmp.height = mask.height;
      const tctx = tmp.getContext('2d');
      tctx.putImageData(mask,0,0);
      const img = tctx.getImageData(0,0,tmp.width,tmp.height);
      const d = img.data;
      const [r,g,b] = COLORS[state.maskColor] || COLORS.green;
      for(let i=0;i<d.length;i+=4){
        const a = d[i+3];
        if(a){
          d[i]=r; d[i+1]=g; d[i+2]=b;
          d[i+3]=Math.round(255*state.maskAlpha);
        } else d[i+3]=0;
      }
      tctx.putImageData(img,0,0);
      mctx.imageSmoothingEnabled = false;
      mctx.drawImage(tmp, fit.dx, fit.dy, fit.dw, fit.dh);
    }
  }

  $('sliceIdx').textContent = String(state.z+1);
  $('sliceTotal').textContent = String(state.dims.z);
  $('dimsTxt').textContent = `${state.dims.x}×${state.dims.y}×${state.dims.z}`;
}

function canvasToSliceCoords(evt){
  const mc = $('maskCanvas');
  const rect = mc.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const x = (evt.clientX - rect.left) * dpr;
  const y = (evt.clientY - rect.top) * dpr;

  const w = mc.width, h = mc.height;
  const iw = state.dims.x, ih = state.dims.y;
  const s = Math.min(w/iw, h/ih);
  const dw = iw*s, dh = ih*s;
  const dx = (w - dw)/2, dy = (h - dh)/2;

  if(x < dx || x > dx+dw || y < dy || y > dy+dh) return null;
  const ix = Math.floor((x - dx) / s);
  const iy = Math.floor((y - dy) / s);
  return {ix,iy};
}

function paintAt(ix, iy, radius, value){
  const m = ensureMaskForZ(state.z);
  const w = m.width, h = m.height, data = m.data;
  const r2 = radius*radius;
  const x0 = Math.max(0, ix-radius), x1 = Math.min(w-1, ix+radius);
  const y0 = Math.max(0, iy-radius), y1 = Math.min(h-1, iy+radius);
  for(let y=y0;y<=y1;y++){
    const dy=y-iy;
    for(let x=x0;x<=x1;x++){
      const dx=x-ix;
      if(dx*dx+dy*dy<=r2) data[(y*w+x)*4+3] = value;
    }
  }
}

let drawing=false;
function onDown(e){
  if(!state.loaded) return;
  const p = canvasToSliceCoords(e);
  if(!p) return;
  drawing=true;
  pushUndo();
  const v = (state.tool==='eraser') ? 0 : 255;
  paintAt(p.ix,p.iy,Math.max(1,Math.round(state.brushSize)),v);
  render(); updateMem();
}
function onMove(e){
  if(!drawing) return;
  const p = canvasToSliceCoords(e);
  if(!p) return;
  const v = (state.tool==='eraser') ? 0 : 255;
  paintAt(p.ix,p.iy,Math.max(1,Math.round(state.brushSize)),v);
  render(); updateMem();
}
function onUp(){ drawing=false; }

function wireCanvas(){
  const mc = $('maskCanvas');
  mc.addEventListener('pointerdown', onDown);
  mc.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  mc.addEventListener('pointerleave', onUp);
}

function downloadBlob(blob, filename){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function exportMaskPNG(){
  const mask = getMaskForZ(state.z);
  if(!mask) return;
  const c = document.createElement('canvas');
  c.width = mask.width; c.height = mask.height;
  const ctx = c.getContext('2d');

  const out = ctx.createImageData(mask.width, mask.height);
  const d = out.data, m = mask.data;
  for(let i=0;i<d.length;i+=4){
    const a = m[i+3];
    d[i]=a; d[i+1]=a; d[i+2]=a; d[i+3]=255;
  }
  ctx.putImageData(out,0,0);
  c.toBlob((blob)=> downloadBlob(blob, `z${String(state.z).padStart(4,'0')}_mask.png`), 'image/png');
}

async function exportAllMasksZIP(){
  if(typeof JSZip === 'undefined'){ alert('JSZip not available. Add vendor/jszip.min.js'); return; }
  const zip = new JSZip();
  for(const [z, mask] of state.masks.entries()){
    const c = document.createElement('canvas');
    c.width = mask.width; c.height = mask.height;
    const ctx = c.getContext('2d');
    const out = ctx.createImageData(mask.width, mask.height);
    const d = out.data, m = mask.data;
    for(let i=0;i<d.length;i+=4){
      const a=m[i+3];
      d[i]=a; d[i+1]=a; d[i+2]=a; d[i+3]=255;
    }
    ctx.putImageData(out,0,0);
    const blob = await new Promise(r=>c.toBlob(r,'image/png'));
    zip.file(`z${String(z).padStart(4,'0')}_mask.png`, blob);
  }
  setProg(5,'Building ZIP…');
  const out = await zip.generateAsync({type:'blob'});
  setProg(0,'Idle');
  downloadBlob(out, 'cbct_masks.zip');
}

function stepZ(delta){
  if(!state.loaded) return;
  state.z = Math.max(0, Math.min(state.dims.z-1, state.z + delta));
  $('sliceRange').value = String(state.z);
  state.undo = [];
  render();
}

function updateMem(){ $('memInfo').textContent = state.masks.size ? `Masks: ${state.masks.size}` : ''; }

function syncAutoDefaults(){
  const mode = $('autoMode').value;
  const preset = $('autoPreset').value;
  let thr = 140, smooth = 2, keep = 1;
  if(mode === 'bone'){ thr = 120; smooth=2; keep=0; }
  if(preset === 'fast'){ smooth = 1; }
  if(preset === 'high'){ smooth = 3; }
  $('thr').value = String(thr);
  $('smooth').value = String(smooth);
  $('keepLargest').value = String(keep);
}

function ensureWorker(){
  if(state.worker) return state.worker;
  state.worker = new Worker('worker_auto.js');
  state.worker.onmessage = (ev)=>{
    const msg = ev.data;
    if(msg.type === 'progress') setProg(msg.pct, msg.text);
    if(msg.type === 'result'){
      const alpha = new Uint8ClampedArray(msg.alphaMask);
      const img = new ImageData(msg.width, msg.height);
      for(let i=0,j=0;i<img.data.length;i+=4,j++) img.data[i+3] = alpha[j];
      const z = msg.zIndex|0;
      state.masks.set(z, img);
      updateMem();
      if(z === state.z) render();
      // HUD feedback
      const frac = (msg.onCount && msg.width && msg.height) ? (msg.onCount/(msg.width*msg.height)) : 0;
      if(msg.onCount === 0){
        setHUD('Auto done لكن الماسك فاضي 😅 جرّب تقلّل Threshold أو غيّر Window/Level.');
      } else {
        setHUD(`Auto mask ✅ (thr=${msg.usedThr}, pixels=${msg.onCount}, ${(frac*100).toFixed(2)}%)`);
      }

    }
    if(msg.type === 'done'){ state.busy=false; setProg(0,'Idle'); setHUD('Auto segmentation done ✅'); }
    if(msg.type === 'error'){ state.busy=false; setProg(0,'Idle'); setHUD('Auto failed: '+msg.message); }
  };
  return state.worker;
}

function sliceToGrayU8(z){
  const {x:sx, y:sy} = state.dims;
  const ww = state.wl.w, ll = state.wl.l;
  const invSel = $('invert').value;
  const invAuto = (state.meta.photometric === 'MONOCHROME1');
  const doInv = (invSel === 'auto') ? invAuto : (invSel === '1');

  const g = new Uint8Array(sx*sy);
  let idx = 0;
  for(let y=0;y<sy;y++){
    for(let x=0;x<sx;x++){
      const v = state.vol[getIndex(x,y,z)];
      let p = lut(v, ww, ll);
      if(doInv) p = 255 - p;
      g[idx++] = p;
    }
  }
  return g;
}

async function runAuto(allSlices){
  if(!state.loaded || state.busy) return;
  state.busy = true;
  setHUD('Auto segmentation running…');
  const w = ensureWorker();

  const mode = $('autoMode').value;
  const thr = Number($('thr').value);
  const smooth = Number($('smooth').value);
  const keepLargest = Number($('keepLargest').value) === 1;

  const indices = allSlices ? [...Array(state.dims.z).keys()] : [state.z];

  w.postMessage({ type:'start', total: indices.length });

  for(let k=0;k<indices.length;k++){
    const z = indices[k];
    const gray = sliceToGrayU8(z);
    w.postMessage({
      type:'job',
      jobIndex: k+1,
      total: indices.length,
      zIndex: z,
      mode, thr, smooth, keepLargest,
      width: state.dims.x,
      height: state.dims.y,
      gray: gray.buffer
    }, [gray.buffer]);
    await new Promise(r=>setTimeout(r, 0));
  }
  w.postMessage({ type:'finish' });
}

// ===============================
// DICOM ZIP LOADER (from cbct.html)
// ===============================
async function doLoadZip(fileObj){
  if(!fileObj) return;
  if(typeof JSZip === 'undefined' || typeof daikon === 'undefined'){
    throw new Error('Missing JSZip/daikon. Add vendor libs or use internet once for CDN load.');
  }

  setProg(0,'Unzipping…');
  setHUD('Unzipping…');

  const zip = await JSZip.loadAsync(fileObj);
  const imgs = [];
  for(let k in zip.files){
    if(!zip.files[k].dir && !k.includes('__MAC')){
      try{
        const buf = await zip.files[k].async('arraybuffer');
        const img = daikon.Series.parseImage(new DataView(buf));
        if(img && img.hasPixelData && img.hasPixelData() && img.getImagePosition && img.getImagePosition()){
          imgs.push(img);
        }
      }catch(e){}
    }
  }
  if(!imgs.length) throw new Error('No valid DICOM images found (Check position data).');

  setProg(10,'Ordering slices…');
  setHUD('Ordering slices…');
  imgs.sort((a,b)=> a.getImagePosition()[2] - b.getImagePosition()[2]);

  const ref = imgs[0];
  state.meta.photometric = (ref.getPhotometricInterpretation ? ref.getPhotometricInterpretation() : 'MONOCHROME2') || 'MONOCHROME2';

  state.dims = { x: ref.getCols(), y: ref.getRows(), z: imgs.length };

  const sp = ref.getPixelSpacing ? ref.getPixelSpacing() : [1,1];
  let zSp = (ref.getSliceThickness && ref.getSliceThickness()) || 1;
  if(imgs.length > 1){
    const pos0 = imgs[0].getImagePosition();
    const pos1 = imgs[1].getImagePosition();
    if(pos0 && pos1) zSp = Math.abs(pos1[2] - pos0[2]);
  }
  state.spacing = { x: sp[1] || 1, y: sp[0] || 1, z: zSp || 1 };

  // Build volume
  setProg(20,'Building volume…');
  setHUD('Building 3D volume…');
  const N = state.dims.x * state.dims.y * state.dims.z;
  state.vol = new Float32Array(N);

  for(let i=0;i<imgs.length;i++){
    const arr = imgs[i].getInterpretedData(false,false); // Float32-ish
    state.vol.set(arr, i*state.dims.x*state.dims.y);
    if(i % 40 === 0){
      const pct = 20 + Math.round((i/imgs.length)*70);
      setProg(pct, `Building volume… ${i}/${imgs.length}`);
    }
  }

  state.z = Math.floor(state.dims.z/2);

  // UI enable
  $('sliceRange').min = '0';
  $('sliceRange').max = String(Math.max(0, state.dims.z-1));
  $('sliceRange').value = String(state.z);

  $('winW').value = String(state.wl.w);
  $('winL').value = String(state.wl.l);

  state.masks.clear();
  state.undo = [];
  state.loaded = true;

  enableAfterLoad(true);
  updateMem();

  setProg(0,'Idle');
  setHUD('Ready ✅ Scroll slices / segment now.');
  fitCanvasToWrap();
  render();
}


function ensureMeshWorker(){
  if(state.meshWorker) return state.meshWorker;
  state.meshWorker = new Worker('worker_mesh.js');
  state.meshWorker.onmessage = (ev)=>{
    const m = ev.data;
    if(m.type === 'mesh_progress'){
      setProg(m.pct, m.text);
      return;
    }
    if(m.type === 'mesh_result'){
      state.lastSTL = m.stlBuffer;
      $('btnDownloadSTL').disabled = false;
      setProg(0,'Idle');
      setHUD(`3D Mesh ready ✅ (triangles=${m.triCount})`);
      return;
    }
    if(m.type === 'mesh_error'){
      setProg(0,'Idle');
      setHUD('3D build failed: ' + m.message);
      return;
    }
  };
  return state.meshWorker;
}

// Build a downsampled binary volume from painted masks (alpha channel)
function buildDownsampledVolume(dsXY, dsZ){
  const sx = state.dims.x, sy = state.dims.y, sz = state.dims.z;
  const nx = Math.max(1, Math.floor(sx / dsXY));
  const ny = Math.max(1, Math.floor(sy / dsXY));
  const nz = Math.max(1, Math.floor(sz / dsZ));

  const vol = new Uint8Array(nx * ny * nz);

  // For each output voxel, check if any painted pixel exists in the corresponding block (fast "any" pooling).
  // Missing masks => treated as empty.
  for(let z=0; z<nz; z++){
    const z0 = z*dsZ;
    const z1 = Math.min(sz, z0 + dsZ);
    for(let y=0; y<ny; y++){
      const y0 = y*dsXY;
      const y1 = Math.min(sy, y0 + dsXY);
      for(let x=0; x<nx; x++){
        const x0 = x*dsXY;
        const x1 = Math.min(sx, x0 + dsXY);

        let on = 0;
        for(let zz=z0; zz<z1 && !on; zz++){
          const mask = state.masks.get(zz);
          if(!mask) continue;
          const md = mask.data;
          const mw = mask.width; // should equal sx
          for(let yy=y0; yy<y1 && !on; yy++){
            let row = (yy*mw + x0) * 4;
            for(let xx=x0; xx<x1; xx++){
              if(md[row+3]){ on=1; break; }
              row += 4;
            }
          }
        }

        vol[(z*ny + y)*nx + x] = on ? 1 : 0;
      }
    }
    if(z % Math.max(1, Math.floor(nz/10)) === 0){
      const pct = Math.round((z/nz)*60);
      setProg(pct, `Building volume… ${z}/${nz}`);
    }
  }

  setProg(60, 'Building volume… done');
  return {vol, nx, ny, nz};
}

async function build3DMesh(){
  if(state.masks.size === 0){
    setHUD('ارسم ماسك بالفرشة الأول على slices 🙂');
    return;
  }
  const dsXY = Number($('ds').value);
  const dsZ  = Number($('dsZ').value);

  setHUD('Building 3D mesh…');
  setProg(0,'Preparing…');
  $('btnBuildMesh').disabled = true;
  $('btnDownloadSTL').disabled = true;
  state.lastSTL = null;

  // Build downsampled volume in main (keeps worker simple)
  const {vol, nx, ny, nz} = buildDownsampledVolume(dsXY, dsZ);

  const mw = ensureMeshWorker();
  // Transfer volume buffer
  mw.postMessage({
    type:'build_mesh',
    nx, ny, nz,
    voxelSize: {x: state.spacing.x*dsXY, y: state.spacing.y*dsXY, z: state.spacing.z*dsZ},
    vol: vol.buffer
  }, [vol.buffer]);

  // Re-enable build button once dispatched (worker will update)
  setTimeout(()=>{ $('btnBuildMesh').disabled = false; }, 300);
}

function downloadSTL(){
  if(!state.lastSTL) return;
  downloadBlob(new Blob([state.lastSTL], {type:'model/stl'}), 'segmentation.stl');
}


function bindUI(){
  enableAfterLoad(false);
  updateToolButtons();
  syncAutoDefaults();

  $('zipInput').addEventListener('change', async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    try{
      enableAfterLoad(false);
      await doLoadZip(f);
    }catch(err){
      console.error(err);
      setProg(0,'Idle');
      setHUD('Failed: ' + (err?.message || err));
    }
  });

  $('sliceRange').addEventListener('input', (e)=>{
    state.z = Number(e.target.value);
    state.undo = [];
    render();
  });

  $('btnPrev').addEventListener('click', ()=>stepZ(-1));
  $('btnNext').addEventListener('click', ()=>stepZ(+1));

  document.querySelector('.canvasWrap').addEventListener('wheel', (e)=>{
    if(!state.loaded) return;
    e.preventDefault();
    stepZ(e.deltaY > 0 ? 1 : -1);
  }, {passive:false});

  $('winW').addEventListener('input', (e)=>{ state.wl.w = Number(e.target.value); render(); });
  $('winL').addEventListener('input', (e)=>{ state.wl.l = Number(e.target.value); render(); });
  $('invert').addEventListener('change', ()=>render());

  $('toolBrush').addEventListener('click', ()=>{ state.tool='brush'; updateToolButtons(); });
  $('toolEraser').addEventListener('click', ()=>{ state.tool='eraser'; updateToolButtons(); });

  $('brushSize').addEventListener('input', e=> state.brushSize = Number(e.target.value));
  $('maskAlpha').addEventListener('input', e=> { state.maskAlpha = Number(e.target.value)/100; render(); });
  $('maskColor').addEventListener('change', e=> { state.maskColor = e.target.value; render(); });

  $('btnUndo').addEventListener('click', ()=>undo());
  $('btnClearSlice').addEventListener('click', ()=>clearSliceMask());
  $('btnClearAll').addEventListener('click', ()=>{ if(confirm('Clear ALL masks?')) clearAllMasks(); });

  $('btnToggleOverlay').addEventListener('click', ()=>{ state.showOverlay = !state.showOverlay; render(); });

  $('btnExportMask').addEventListener('click', exportMaskPNG);
  $('btnExportAll').addEventListener('click', exportAllMasksZIP);

  $('btnBuildMesh').addEventListener('click', build3DMesh);
  $('btnDownloadSTL').addEventListener('click', downloadSTL);

  $('btnAuto').addEventListener('click', ()=>runAuto(false));
  $('btnAutoAll').addEventListener('click', ()=>runAuto(true));

  $('autoMode').addEventListener('change', syncAutoDefaults);
  $('autoPreset').addEventListener('change', syncAutoDefaults);

  // help
  $('btnHelp').addEventListener('click', ()=> $('helpDlg').showModal());
  $('btnCloseHelp').addEventListener('click', ()=> $('helpDlg').close());

  // shortcuts
  window.addEventListener('keydown', (e)=>{
    if (e.target && ['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
    if(e.key==='b'||e.key==='B'){ state.tool='brush'; updateToolButtons(); }
    if(e.key==='e'||e.key==='E'){ state.tool='eraser'; updateToolButtons(); }
    if(e.key==='['){ state.brushSize = Math.max(1, state.brushSize-2); $('brushSize').value = state.brushSize; }
    if(e.key===']'){ state.brushSize = Math.min(80, state.brushSize+2); $('brushSize').value = state.brushSize; }
    if(e.key==='u'||e.key==='U'){ undo(); }
    if(e.key==='ArrowLeft'){ stepZ(-1); }
    if(e.key==='ArrowRight'){ stepZ(+1); }
  });
}

function init(){
  bindUI();
  wireCanvas();
  fitCanvasToWrap();
  setHUD('Load a DICOM ZIP to start.');
}

init();
