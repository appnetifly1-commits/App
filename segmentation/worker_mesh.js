// worker_mesh.js
// Build a surface mesh from a binary voxel volume using "voxel face" extraction (blocky but robust).
// Output: Binary STL ArrayBuffer.

function postP(p, t){ postMessage({type:'mesh_progress', pct:p, text:t}); }

function u32(n){ const b=new Uint8Array(4); const dv=new DataView(b.buffer); dv.setUint32(0,n,true); return b; }
function f32(n){ const b=new Uint8Array(4); const dv=new DataView(b.buffer); dv.setFloat32(0,n,true); return b; }

function writeVec(dv, off, x,y,z){
  dv.setFloat32(off, x, true);
  dv.setFloat32(off+4, y, true);
  dv.setFloat32(off+8, z, true);
}

function normalForFace(dir){
  // 0:-X,1:+X,2:-Y,3:+Y,4:-Z,5:+Z
  switch(dir){
    case 0: return [-1,0,0];
    case 1: return [1,0,0];
    case 2: return [0,-1,0];
    case 3: return [0,1,0];
    case 4: return [0,0,-1];
    case 5: return [0,0,1];
  }
  return [0,0,0];
}

function idx(x,y,z,nx,ny){ return (z*ny + y)*nx + x; }

onmessage = (e)=>{
  const m = e.data;
  try{
    if(m.type !== 'build_mesh') return;

    const nx = m.nx|0, ny=m.ny|0, nz=m.nz|0;
    const vs = m.voxelSize || {x:1,y:1,z:1};
    const vol = new Uint8Array(m.vol);

    postP(0, 'Counting surface faces…');

    // First pass: count faces on boundary between filled and empty
    let faceCount = 0;
    for(let z=0; z<nz; z++){
      for(let y=0; y<ny; y++){
        for(let x=0; x<nx; x++){
          if(!vol[idx(x,y,z,nx,ny)]) continue;
          // neighbor empty or out => face
          if(x===0 || !vol[idx(x-1,y,z,nx,ny)]) faceCount++;
          if(x===nx-1 || !vol[idx(x+1,y,z,nx,ny)]) faceCount++;
          if(y===0 || !vol[idx(x,y-1,z,nx,ny)]) faceCount++;
          if(y===ny-1 || !vol[idx(x,y+1,z,nx,ny)]) faceCount++;
          if(z===0 || !vol[idx(x,y,z-1,nx,ny)]) faceCount++;
          if(z===nz-1 || !vol[idx(x,y,z+1,nx,ny)]) faceCount++;
        }
      }
      if(z % Math.max(1, Math.floor(nz/10)) === 0){
        postP(Math.round((z/nz)*20), `Counting… ${z}/${nz}`);
      }
    }

    const triCount = faceCount * 2;
    postP(20, `Allocating STL… faces=${faceCount}, tris=${triCount}`);

    // Binary STL: 80-byte header + 4-byte tri count + 50 bytes per tri
    const totalBytes = 80 + 4 + triCount * 50;
    const buf = new ArrayBuffer(totalBytes);
    const dv = new DataView(buf);

    // header
    const header = new TextEncoder().encode('RRZ Segmentation STL (voxel surface)');
    new Uint8Array(buf,0,80).set(header.slice(0,80));

    dv.setUint32(80, triCount, true);

    let off = 84;
    let written = 0;

    function addTri(nxv,nyv,nzv, ax,ay,az, bx,by,bz, cx,cy,cz){
      writeVec(dv, off, nxv,nyv,nzv); off += 12;
      writeVec(dv, off, ax,ay,az); off += 12;
      writeVec(dv, off, bx,by,bz); off += 12;
      writeVec(dv, off, cx,cy,cz); off += 12;
      dv.setUint16(off, 0, true); off += 2;
      written++;
    }

    // Second pass: emit faces as two triangles each
    postP(22, 'Building triangles…');

    for(let z=0; z<nz; z++){
      for(let y=0; y<ny; y++){
        for(let x=0; x<nx; x++){
          if(!vol[idx(x,y,z,nx,ny)]) continue;

          const x0 = x*vs.x, x1 = (x+1)*vs.x;
          const y0 = y*vs.y, y1 = (y+1)*vs.y;
          const z0 = z*vs.z, z1 = (z+1)*vs.z;

          // Each face: define quad vertices in CCW order looking from outside
          // -X
          if(x===0 || !vol[idx(x-1,y,z,nx,ny)]){
            const n = normalForFace(0);
            addTri(...n, x0,y0,z0, x0,y0,z1, x0,y1,z1);
            addTri(...n, x0,y0,z0, x0,y1,z1, x0,y1,z0);
          }
          // +X
          if(x===nx-1 || !vol[idx(x+1,y,z,nx,ny)]){
            const n = normalForFace(1);
            addTri(...n, x1,y0,z0, x1,y1,z1, x1,y0,z1);
            addTri(...n, x1,y0,z0, x1,y1,z0, x1,y1,z1);
          }
          // -Y
          if(y===0 || !vol[idx(x,y-1,z,nx,ny)]){
            const n = normalForFace(2);
            addTri(...n, x0,y0,z0, x1,y0,z1, x0,y0,z1);
            addTri(...n, x0,y0,z0, x1,y0,z0, x1,y0,z1);
          }
          // +Y
          if(y===ny-1 || !vol[idx(x,y+1,z,nx,ny)]){
            const n = normalForFace(3);
            addTri(...n, x0,y1,z0, x0,y1,z1, x1,y1,z1);
            addTri(...n, x0,y1,z0, x1,y1,z1, x1,y1,z0);
          }
          // -Z
          if(z===0 || !vol[idx(x,y,z-1,nx,ny)]){
            const n = normalForFace(4);
            addTri(...n, x0,y0,z0, x0,y1,z0, x1,y1,z0);
            addTri(...n, x0,y0,z0, x1,y1,z0, x1,y0,z0);
          }
          // +Z
          if(z===nz-1 || !vol[idx(x,y,z+1,nx,ny)]){
            const n = normalForFace(5);
            addTri(...n, x0,y0,z1, x1,y1,z1, x0,y1,z1);
            addTri(...n, x0,y0,z1, x1,y0,z1, x1,y1,z1);
          }
        }
      }
      if(z % Math.max(1, Math.floor(nz/10)) === 0){
        const pct = 22 + Math.round((z/nz)*75);
        postP(pct, `Building… ${z}/${nz}`);
      }
    }

    postP(99, 'Finalizing…');

    // Safety: written should equal triCount; if not, fix header to written
    if(written !== triCount){
      dv.setUint32(80, written, true);
    }

    postMessage({type:'mesh_result', stlBuffer: buf, triCount: written}, [buf]);
    postP(0, 'Idle');
  }catch(err){
    postMessage({type:'mesh_error', message: err?.message || String(err)});
  }
};
