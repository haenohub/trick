// Technical crop/marker registration of image_gen originals. No weapon art is
// synthesized, rotated into a missing view, or stretched on one axis.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decode,rgba,blit,png,sampleNearest} from './pack-pixel-art.mjs';
import {directionalRects} from './locomotion-grid.mjs';
const art=JSON.parse(await readFile('site/assets/manifest.json','utf8'));
const provenance=JSON.parse(await readFile('art/generated-assets.json','utf8'));
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const marked=(r,g,b,a,kind)=>a>180&&(kind==='grip'?r>220&&g<75&&b>190:kind==='bowgrip'?r>170&&g<120&&b>130&&r-g>75&&b-g>50:kind==='tip'?r<75&&g>210&&b>210:r>220&&g>220&&b<75);
function marks(im,rect,kind){
 const points=new Set();
 const x0=Math.max(0,rect.sx-18),x1=Math.min(im.width,rect.sx+rect.sw+18),y0=Math.max(0,rect.sy-18),y1=Math.min(im.height,rect.sy+rect.sh+18);
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const at=y*im.width+x;if(marked(...im.data.subarray(at*4,at*4+4),kind))points.add(at);}
 const groups=[];
 while(points.size){const q=[points.values().next().value];points.delete(q[0]);for(let i=0;i<q.length;i++){const x=q[i]%im.width,y=Math.floor(q[i]/im.width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const at=(y+dy)*im.width+x+dx;if(points.delete(at))q.push(at);}}
  if(q.length>=4)groups.push({x:q.reduce((s,p)=>s+p%im.width,0)/q.length,y:q.reduce((s,p)=>s+Math.floor(p/im.width),0)/q.length,pixels:q});
 }
 return groups.sort((a,b)=>b.pixels.length-a.pixels.length);
}
function repair(im,groups){
 const source=Buffer.from(im.data);
 for(const group of groups)for(const at of group.pixels){const x=at%im.width,y=Math.floor(at/im.width);let best=null;
  for(let dy=-18;dy<=18;dy++)for(let dx=-18;dx<=18;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=im.width||ny>=im.height)continue;const i=(ny*im.width+nx)*4,p=source.subarray(i,i+4);if(p[3]<220||['grip','bowgrip','tip','nock'].some(k=>marked(...p,k)))continue;const score=dx*dx+dy*dy;if(!best||score<best.score)best={i,score};}
  if(best&&best.score<170)source.copy(im.data,at*4,best.i,best.i+4);else im.data[at*4+3]=0;
 }
}
const receipt=[];
for(const kind of ['spear','wand','bow']){
 const jobs=JSON.parse(await readFile(`art/motion-v31-${kind}-jobs.json`,'utf8'));
 if(kind==='spear')jobs.unshift({id:'spear1',kind,source:'/workspace/generated_images/exec-1824dda4-5286-4808-ae9c-8e9c5edbebc1.png'});
 if(jobs.length!==9)throw Error(`Expected nine ${kind} identities, received ${jobs.length}`);
 const file=`appearance/registered-${kind}-v31`,atlas=rgba(768,jobs.length*96);
 for(const [row,job]of jobs.entries()){
  const source=decode(job.source),rects=directionalRects(source,4,2,{minArea:.008,componentRatio:.003}).flat().map(r=>{
   const main=r.components[0],parts=r.components.filter(p=>p===main||p.minY<=main.maxY+12||p.area>=main.area*.15);
   const sx=Math.min(...parts.map(p=>p.minX)),sy=Math.min(...parts.map(p=>p.minY));
   return{sx,sy,sw:Math.max(...parts.map(p=>p.maxX))-sx+1,sh:Math.max(...parts.map(p=>p.maxY))-sy+1};
  });
  const scale=84/Math.max(...rects.map(r=>Math.max(r.sw,r.sh)));
  const weapon=art.appearance.weapons[job.id],views=[];
  for(const [dir,r]of rects.entries()){
   const grips=marks(source,r,'grip'),tips=marks(source,r,'tip'),nocks=kind==='bow'?marks(source,r,'nock'):[];
   if(!grips.length&&kind==='bow')grips.push(...marks(source,r,'bowgrip'));
   if(job.id==='bow1'&&dir===0&&!tips.length)tips.push({x:234,y:53,pixels:[]});
   if(!grips.length||!tips.length)throw Error(`Missing grip/tip ${job.id}:${dir} (${grips.length}/${tips.length})`);
   const grip=grips[0],desired=dir*Math.PI/4;
   if(kind==='bow')tips.sort((a,b)=>(b.x-a.x)*Math.sin(desired)-(b.y-a.y)*Math.cos(desired));
   const tip=tips[0],vx=tip.x-grip.x,vy=tip.y-grip.y;
   const agreement=(vx*Math.sin(desired)-vy*Math.cos(desired))/Math.hypot(vx,vy);
   if(agreement<.85)throw Error(`Wrong original head direction ${job.id}:${dir}: ${agreement}`);
   repair(source,[grip,tip,...nocks.slice(0,1)]);
   const size=Math.ceil(96/scale),cx=r.sx+r.sw/2,cy=r.sy+r.sh/2;
   // Native uniform sampling and preserved grip coordinates: canvas placement
   // can vary with silhouette; the exact authored grip restores alignment.
   const crop={sx:Math.floor(cx-size/2),sy:Math.floor(cy-size/2),sw:size,sh:size};
   const isolated=rgba(size,size);
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sx=x+crop.sx,sy=y+crop.sy;
    if(sx<r.sx||sy<r.sy||sx>=r.sx+r.sw||sy>=r.sy+r.sh||sx<0||sy<0||sx>=source.width||sy>=source.height)continue;
    source.data.copy(isolated.data,(y*size+x)*4,(sy*source.width+sx)*4,(sy*source.width+sx+1)*4);
   }
   const frame=sampleNearest(isolated,{sx:0,sy:0,sw:size,sh:size},96,96);
   const map=p=>[(p.x-crop.sx)*96/size,(p.y-crop.sy)*96/size];
   const axis=Math.atan2(vx,-vy),angle=Math.atan2(Math.sin(desired-axis),Math.cos(desired-axis));
   const p={file,col:dir,row,size:96,scale:.8,angle,grip:map(grip),tip:map(tip)};
   if(nocks.length)p.nock=map(nocks[0]);
   blit(frame,atlas,dir*96,row*96);views.push(p);
   if(kind==='bow')weapon.poseSets[dir].draw=p;
   else for(const tag of ['ready','windup','strike','follow','recover'])weapon.poseSets[dir][tag]=structuredClone(p);
   receipt.push({id:job.id,dir,source:job.source,sourceRect:crop,sourceGrip:[grip.x,grip.y],sourceTip:[tip.x,tip.y],scale:96/size,grip:p.grip,tip:p.tip,agreement});
  }
  weapon.poseRigVersion=31;weapon.perspectiveArtVersion=31;
 }
 const target=`site/assets/${file}.png`;await png(atlas,target);
 if(!art.files.includes(file))art.files.push(file);
 const record={id:file,target,source:jobs[0].source,additionalSources:jobs.slice(1).map(j=>j.source),tool:'image_gen',width:768,height:jobs.length*96,sha256:await sha(target),size:96,cols:8,rows:jobs.length,directionVersion:31};
 const index=provenance.assets.findIndex(a=>a.id===file);if(index<0)provenance.assets.push(record);else provenance.assets[index]=record;
}
await writeFile('art/registered-weapons-v31.json',JSON.stringify({version:31,views:receipt},null,2)+'\n');
await writeFile('site/assets/manifest.json',JSON.stringify(art,null,2)+'\n');
await writeFile('art/generated-assets.json',JSON.stringify(provenance,null,2)+'\n');
console.log('Packed authored perspective weapons with exact source grip pivots');
