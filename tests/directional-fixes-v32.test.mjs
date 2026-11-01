import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rgbaPixels} from './png.mjs';
import {heldWeaponPose,heldWeaponTransform} from '../site/avatar-draw.js';

const readArt=async()=>JSON.parse(await readFile('site/assets/manifest.json','utf8'));
function cell(im,col,row){
 const pixels=[];let minY=96,maxY=-1;
 for(let y=0;y<96;y++)for(let x=0;x<96;x++){
  const at=((row*96+y)*im.width+col*96+x)*4;
  pixels.push(...im.pixels.subarray(at,at+4));
  if(im.pixels[at+3]){minY=Math.min(y,minY);maxY=Math.max(y,maxY);}
 }
 return {pixels,minY,maxY,area:pixels.filter((_,i)=>i%4===3&&pixels[i]>0).length};
}

test('herbalist NW finishing drawings retain the complete body and ground; clipped source idle rows are excluded',async()=>{
 const art=await readArt(),base=art.appearance.bases.herbalist;
 const im=rgbaPixels(await readFile(`site/assets/${base.file}.png`));
 const ready=cell(im,0,7);
 for(const f of [4,5,9]){
  const rig=base.frameRig.frames[7][f],drawing=cell(im,f,7),r=rig.registration;
  assert.equal(r.groundMethod,'marker','a guessed ground must not hide a truncated original');
  assert.ok(r.sourceRect[1]+r.sourceRect[3]>1090,'the fourth source row includes the boots and ground cross');
  assert.ok(drawing.maxY>=88&&drawing.maxY-drawing.minY>=75,'the complete silhouette reaches its planted feet');
  assert.ok(drawing.area>=ready.area*.9,'the finishing body cannot lose its lower half');
  assert.ok(drawing.minY>=10,'the preceding row must not leak above the hat');
  assert.ok(rig.hand[1]<80,'the hand cannot be registered to a cut-off foot');
 }
 for(let i=0;i<4;i++){
  assert.deepEqual(cell(im,24+i,7).pixels,cell(im,28+i,7).pixels,'hold the four complete authored idle drawings');
  assert.ok(cell(im,24+i,7).maxY-cell(im,24+i,7).minY>=75);
 }
});

test('all nine bows use inward strings in both NE/NW poses and keep their actual grip on the shared palm',async()=>{
 const art=await readArt(),base=art.appearance.bases.ranger,cache=new Map();let count=0;
 for(const [id,w]of Object.entries(art.appearance.weapons)){
  if(w.kind!=='bow')continue;
  count++;assert.equal(w.diagonalStringVersion,32,id);
  for(const dir of [1,7])for(const f of [...base.animations.combo,16,24]){
   const p=heldWeaponPose(base,w,f,dir),desired=dir*Math.PI/4;
   assert.equal(p.file,'appearance/registered-bow-diagonals-v32');
   assert.ok(p.nock&&Number.isFinite(p.forwardAxis));
   if(!cache.has(p.file))cache.set(p.file,rgbaPixels(await readFile(`site/assets/${p.file}.png`)));
   const im=cache.get(p.file),t=heldWeaponTransform(p,13,-27,2.5);
   assert.ok(Math.hypot(...t.point(p.grip).map((v,i)=>v-t.hand[i]))<1e-9);
   const ahead=point=>{const q=t.point(point);return(q[0]-t.hand[0])*Math.sin(desired)-(q[1]-t.hand[1])*Math.cos(desired);};
   assert.ok(ahead(p.nock)<-4,`${id}:${dir}:${f}: string nock belongs behind the grip, toward the body`);
   assert.ok(ahead(p.tip)>4,`${id}:${dir}:${f}: arrow points outward`);
   assert.ok(Math.cos(p.angle+p.forwardAxis-desired)>.9999);
   for(const point of [p.grip,p.nock]){
    const [x,y]=point.map(Math.round);
    assert.ok(im.pixels[((p.row*96+y)*im.width+p.col*96+x)*4+3],`${id} attachment guide floats outside its artwork`);
   }
  }
 }
 assert.equal(count,9);
});
