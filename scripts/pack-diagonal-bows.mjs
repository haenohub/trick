// Crop and register the newly authored NE/NW bow poses. The source drawings
// supply the inward string and perspective; rotation only calibrates their aim.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decode,rgba,blit,png,sampleNearest} from './pack-pixel-art.mjs';
import {directionalRects} from './locomotion-grid.mjs';

const recipe=JSON.parse(await readFile('art/diagonal-bows-v32.json','utf8'));
const art=JSON.parse(await readFile('site/assets/manifest.json','utf8'));
const provenance=JSON.parse(await readFile('art/generated-assets.json','utf8'));
const file='appearance/registered-bow-diagonals-v32';
const atlas=rgba(768,recipe.sources.length*192),receipt=[];
const marked=(r,g,b,a,k)=>a>180&&(k==='grip'?r>235&&g<65&&b>210:k==='tip'?r<65&&g>230&&b>230:r>235&&g>235&&b<65);
function groups(im,r,kind){
 const points=new Set();
 for(let y=r.sy;y<r.sy+r.sh;y++)for(let x=r.sx;x<r.sx+r.sw;x++){
  const at=y*im.width+x;
  if(marked(...im.data.subarray(at*4,at*4+4),kind))points.add(at);
 }
 const out=[];
 while(points.size){
  const q=[points.values().next().value];points.delete(q[0]);
  for(let i=0;i<q.length;i++){
   const x=q[i]%im.width,y=Math.floor(q[i]/im.width);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy,at=ny*im.width+nx;
    if(nx>=r.sx&&nx<r.sx+r.sw&&ny>=r.sy&&ny<r.sy+r.sh&&points.delete(at))q.push(at);
   }
  }
  if(q.length>=4)out.push({x:q.reduce((s,p)=>s+p%im.width,0)/q.length,y:q.reduce((s,p)=>s+Math.floor(p/im.width),0)/q.length,pixels:q});
 }
 return out.sort((a,b)=>b.pixels.length-a.pixels.length);
}
function removeGuides(im,marks){
 const original=Buffer.from(im.data);
 for(const m of marks)for(const at of m.pixels){
  const x=at%im.width,y=Math.floor(at/im.width);let best;
  for(let dy=-18;dy<=18;dy++)for(let dx=-18;dx<=18;dx++){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=im.width||ny>=im.height)continue;
   const i=(ny*im.width+nx)*4,p=original.subarray(i,i+4);
   if(p[3]<220||['grip','tip','nock'].some(k=>marked(...p,k)))continue;
   const d=dx*dx+dy*dy;if(!best||d<best.d)best={i,d};
  }
  if(best&&best.d<170)original.copy(im.data,at*4,best.i,best.i+4);
  else im.data[at*4+3]=0;
 }
}
function solidPivot(frame,p){
 let best;
 for(let y=Math.round(p[1])-3;y<=Math.round(p[1])+3;y++)for(let x=Math.round(p[0])-3;x<=Math.round(p[0])+3;x++){
  if(x<4||x>=92||y<4||y>=92||!frame.data[(y*96+x)*4+3])continue;
  const d=Math.hypot(x-p[0],y-p[1]);if(!best||d<best.d)best={x,y,d};
 }
 if(!best)throw Error('Marker is not on the actual item: '+p);
 return[best.x,best.y];
}
if(recipe.sources.length!==9)throw Error('Every bow identity needs its own corrected original');
for(const [itemIndex,job]of recipe.sources.entries()){
 const source=decode(job.source),weapon=art.appearance.weapons[job.id];
 const cells=directionalRects(source,2,2,{cellsOnly:true}).flat();
 const rects=directionalRects(source,2,2,{minArea:.008,componentRatio:.003}).flat();
 const scale=84/Math.max(...rects.map(r=>Math.max(r.sw,r.sh)));
 for(let at=0;at<4;at++){
  const dir=at<2?1:7,draw=at%2===1,row=itemIndex*2+Number(draw),r=rects[at];
  const grip=groups(source,cells[at],'grip')[0];
  if(!grip)throw Error(`Missing grip ${job.id}:${at}`);
  const desired=dir*Math.PI/4,projection=p=>(p.x-grip.x)*Math.sin(desired)-(p.y-grip.y)*Math.cos(desired);
  // Blue gems can contain cyan pixels too. The authored arrow tip is beyond
  // the riser horizontally; an upper crystal must never become the aim axis.
  const tip=groups(source,cells[at],'tip').filter(p=>projection(p)>20&&(dir===1?p.x-grip.x:grip.x-p.x)>40).sort((a,b)=>b.pixels.length-a.pixels.length)[0];
  const nock=groups(source,cells[at],'nock').filter(p=>projection(p)<-20).sort((a,b)=>b.pixels.length-a.pixels.length)[0];
  if(!tip||!nock)throw Error(`Missing inward nock or outward arrowhead ${job.id}:${at}`);
  removeGuides(source,[grip,tip,nock]);
  const size=Math.ceil(96/scale),crop={sx:Math.floor(r.sx+r.sw/2-size/2),sy:Math.floor(r.sy+r.sh/2-size/2),sw:size,sh:size};
  const isolated=rgba(size,size),c=cells[at];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const sx=x+crop.sx,sy=y+crop.sy;
   if(sx<c.sx||sy<c.sy||sx>=c.sx+c.sw||sy>=c.sy+c.sh)continue;
   source.data.copy(isolated.data,(y*size+x)*4,(sy*source.width+sx)*4,(sy*source.width+sx+1)*4);
  }
  const frame=sampleNearest(isolated,{sx:0,sy:0,sw:size,sh:size},96,96);
  const map=p=>[(p.x-crop.sx)*96/size,(p.y-crop.sy)*96/size];
  const forwardAxis=Math.atan2(tip.x-grip.x,grip.y-tip.y);
  const angle=Math.atan2(Math.sin(desired-forwardAxis),Math.cos(desired-forwardAxis));
  const p={file,col:dir,row,size:96,scale:.8,angle,forwardAxis,grip:solidPivot(frame,map(grip)),tip:map(tip),nock:solidPivot(frame,map(nock))};
  blit(frame,atlas,dir*96,row*96);
  const tags=draw?['draw']:['carry','ready','windup','strike','follow','recover'];
  for(const tag of tags)weapon.poseSets[dir][tag]=structuredClone(p);
  receipt.push({id:job.id,dir,pose:draw?'draw':'relaxed',source:job.source,sourceRect:crop,sourceGrip:[grip.x,grip.y],sourceNock:[nock.x,nock.y],sourceTip:[tip.x,tip.y],grip:p.grip,nock:p.nock,tip:p.tip,angle,forwardAxis});
 }
 weapon.diagonalStringVersion=32;
}
const target=`site/assets/${file}.png`;await png(atlas,target);
if(!art.files.includes(file))art.files.push(file);
const record={id:file,target,source:recipe.sources[0].source,additionalSources:recipe.sources.slice(1).map(j=>j.source),tool:'image_gen',width:atlas.width,height:atlas.height,size:96,cols:8,rows:recipe.sources.length*2,directionVersion:32,sha256:createHash('sha256').update(await readFile(target)).digest('hex')};
const index=provenance.assets.findIndex(a=>a.id===file);
if(index<0)provenance.assets.push(record);else provenance.assets[index]=record;
await writeFile('art/diagonal-bows-v32-registration.json',JSON.stringify({version:32,views:receipt},null,2)+'\n');
await writeFile('art/generated-assets.json',JSON.stringify(provenance,null,2)+'\n');
await writeFile('site/assets/manifest.json',JSON.stringify(art,null,2)+'\n');
console.log('Packed 36 authored inward-string bow poses: 9 identities × NE/NW × relaxed/drawn');
