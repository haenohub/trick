// Only crops, marker removal, uniform sampling and registration of image_gen art.
// Never synthesize a missing pose by rotating or interpolating another body.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { FRAME_EXPOSURES, WALK_DURATION } from "../site/animation.js";
import {directionalRects} from "./locomotion-grid.mjs";

const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
const records = JSON.parse(await readFile("art/generated-assets.json", "utf8"));
const planFile = "art/registered-motion-v31.json";
const plan = JSON.parse(await readFile(planFile, "utf8"));
const packedImages=new Map(),sourceRecords=new Map();
function workingImage(file){if(!packedImages.has(file))packedImages.set(file,decode("site/assets/"+file+".png"));return packedImages.get(file);}
const isMark = (r,g,b,a,type) => a > 110 && (type === "root"
  ? r < 110 && g > 140 && b > 140 && g-r > 60 && b-r > 60
  : r > 210 && g < 95 && b > 170);
function components(im, type) {
  const pending = new Set();
  for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)
    if(isMark(...im.data.subarray((y*im.width+x)*4,(y*im.width+x)*4+4),type))pending.add(y*im.width+x);
  const groups=[];
  while(pending.size){
    const first=pending.values().next().value,q=[first];pending.delete(first);
    for(let i=0;i<q.length;i++){
      const x=q[i]%im.width,y=Math.floor(q[i]/im.width);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy,at=ny*im.width+nx;
        if(nx>=0&&ny>=0&&nx<im.width&&ny<im.height&&pending.has(at)){pending.delete(at);q.push(at);}
      }
    }
    if(q.length>=(type==="hand"?1:3))groups.push({x:q.reduce((s,a)=>s+a%im.width,0)/q.length,y:q.reduce((s,a)=>s+Math.floor(a/im.width),0)/q.length,pixels:q});
  }
  return groups;
}
function crop(im,x,y,w,h){const out=rgba(w,h);for(let r=0;r<h;r++)im.data.copy(out.data,r*w*4,((y+r)*im.width+x)*4,((y+r)*im.width+x+w)*4);return out;}
function removeMarks(im, marks, root=false){
  const original=Buffer.from(im.data);
  for(const mark of marks)for(const at of mark.pixels){
    const x=at%im.width,y=Math.floor(at/im.width);
    if(root){im.data[at*4+3]=0;continue;}
    let nearest=null;
    for(let dy=-12;dy<=12;dy++)for(let dx=-12;dx<=12;dx++){
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=im.width||ny>=im.height)continue;
      const a=(ny*im.width+nx)*4,p=original.subarray(a,a+4);
      if(p[3]<180||isMark(...p,"hand")||isMark(...p,"root"))continue;
      const score=dx*dx+dy*dy;if(!nearest||score<nearest.score)nearest={a,score};
    }
    if(nearest)original.copy(im.data,at*4,nearest.a,nearest.a+4);else im.data[at*4+3]=0;
  }
}
function nearestSolid(im, point){
  let best=null;
  for(let y=Math.round(point[1])-4;y<=Math.round(point[1])+4;y++)for(let x=Math.round(point[0])-4;x<=Math.round(point[0])+4;x++){
    if(x<0||y<0||x>=96||y>=96||!im.data[(y*96+x)*4+3])continue;
    const d=Math.hypot(x-point[0],y-point[1]);if(!best||d<best.d)best={x,y,d};
  }
  if(!best)throw Error("Grip is not on the authored glove: "+point);
  return [best.x,best.y];
}
export function configureRig(base, id) {
  base.frameRig ||= { version:31, logicalSize:[96,96], ground:[48,92], frames:[] };
  for(let d=0;d<8;d++){
    base.frameRig.frames[d] ||= [];
    for(let f=0;f<32;f++){
      const a=base.anchors[d][f];
      base.frameRig.frames[d][f] = {...base.frameRig.frames[d][f],
        sourceSize:[96,96], trim:[0,0,96,96], offset:[0,0],
        ground:[48,92], hand:[...a.hand],
        pose:id==="ranger"&&[2,3].includes(f)?"draw":f===1||f===2?"windup":f===3||f===4?"strike":f===5?"follow":f===9?"recover":f<16?"ready":"carry",
        depth:[0,1,7].includes(d)||(id!=="ranger"&&[2,6].includes(d)&&[1,2].includes(f))?"behind":"front", handMask:true,
      };
    }
  }
  base.animations.recover=[5,9,6];
  base.animations.combo=[0,1,2,3,4,5,9,6];
  base.clips ||= {};
  for(const kind of ["windup","attack","recover","walk","idle"])
    base.clips[kind]={frames:[...base.animations[kind]],durationsMs:[...FRAME_EXPOSURES[kind]],loop:["walk","idle"].includes(kind),
      ...(kind==="attack"?{events:{1:["release","hit"]}}:{}),
      ...(kind==="walk"?{duration:WALK_DURATION,stridePx:48,stridePxByDirection:[24,36,48,36,24,36,48,36]}:kind==="idle"?{duration:1.44}:{})};
  base.clips.combo={frames:[...base.animations.combo],durationsMs:[90,80,50,40,40,60,90,110],loop:false};
  base.frameRig.classId=id;
}

// Referenced pose records are shared by frames, but are fixed data: no runtime
// interpolation, trig animation, axis-dependent squashing or independent clock.
for(const weapon of Object.values(art.appearance.weapons)){
  if(weapon.poseRigVersion===31)continue;
  weapon.poseSets=Array.from({length:8},(_,dir)=>{
    const axis=weapon.kind==="bow"?weapon.forwardAxes?.[dir]??weapon.axes[dir]:weapon.axes[dir];
    const source={file:weapon.file,col:dir,row:weapon.index,grip:[...weapon.grips[dir]],tip:weapon.tips?.[dir],size:96,scale:.8};
    const desired=weapon.kind==="staff"?0:dir*Math.PI/4;
    const activeAngle=desired-axis;
    const carryAngle=(dir>=5?-1:1)*.12-(weapon.axes[dir]||0);
    return Object.fromEntries(["carry","ready","windup","strike","follow","recover"].map(tag=>[tag,{...source,angle:tag==="carry"?carryAngle:activeAngle}]));
  });
  weapon.poseRigVersion=31;
}

for(const job of plan.sources.filter(j=>["pilot","direction"].includes(j.kind))){
  const defaultSource=decode(job.source),attackSource=job.attackSource?decode(job.attackSource):null,base=art.appearance.bases[job.id];
  const body=workingImage(base.file),hands=workingImage(base.handFile);
  if(!base.legacyGroundVersion){
    for(let d=0;d<8;d++)for(const f of [7,15]){
      for(const image of [body,hands]){
        const old=crop(image,f*96,d*96,96,96),shifted=rgba(96,96);
        for(let y=0;y<92;y++)old.data.copy(shifted.data,(y+4)*96*4,y*96*4,(y+1)*96*4);
        blit(shifted,image,f*96,d*96);
      }
      base.anchors[d][f].hand[1]+=4;base.anchors[d][f].feet=[48,92];
    }
    base.legacyGroundVersion=31;
  }
  configureRig(base,job.id);
  const cellRects=directionalRects(defaultSource,4,job.gridRows||6,{cellsOnly:true}).flat();
  const attackRects=attackSource?directionalRects(attackSource,4,6,{cellsOnly:true}).flat():null;
  const registeredSource=job.armedSource?decode(job.armedSource):null;
  const mappings=[],combat=[0,1,2,3,4,5,9,6];
  let previousHand=null;
  const dir=job.dir??5;
  for(let at=0;at<24;at++){
    const alternate=attackSource&&at>=8&&at<16,source=alternate?attackSource:defaultSource;
    const sourcePath=alternate?job.attackSource:job.source;
    if(at%8===0)previousHand=null;
    const logicalAt=job.combatOrder&&at>=8&&at<16?8+job.combatOrder[at-8]:at;
    const sourceAt=job.gridRows===5&&logicalAt>=20?16+logicalAt%4:logicalAt;
    const rect=(alternate?attackRects:cellRects)[sourceAt],{sx,sy,sw:cw,sh:ch}=rect,cell=crop(source,sx,sy,cw,ch);
    const roots=components(cell,"root");
    const allPalms=components(cell,"hand");
    const palms=allPalms.filter(p=>(at>=8&&at<16)||p.y>ch*.3);
    const manualPalm=job.handOverrides?.[at];
    if(manualPalm)palms.splice(0,palms.length,{x:manualPalm[0]-sx,y:manualPalm[1]-sy,pixels:[]});
    const rootCandidates=registeredSource&&!alternate?components(crop(registeredSource,sx,sy,cw,ch),"root"):roots;
    const measuredRoot=rootCandidates.filter(p=>p.y>ch*.73&&p.pixels.length<900).sort((a,b)=>Math.hypot(a.x-cw/2,(a.y-ch*.94)*.6)-Math.hypot(b.x-cw/2,(b.y-ch*.94)*.6))[0];
    const root=measuredRoot||(job.groundOverrides?.[at]
      ?{x:job.groundOverrides[at][0]-sx,y:job.groundOverrides[at][1]-sy,pixels:[]}
      :job.canonicalGround?{x:cw/2,y:ch*.94,pixels:[]}:null);
    if(!root||!palms.length)throw Error(`Missing authored registration ${job.id}:${dir} cell ${at}: root=${!!root}, palm=${palms.length}`);
    const sidePalms=job.palmSide?palms.filter(p=>job.palmSide==="right"?p.x>cw/2:p.x<cw/2):palms;
    if(!sidePalms.length)throw Error(`Wrong hand marker ${job.id}:${dir} cell ${at}`);
    const palm=job.id==="warden"&&at>=9&&at<=10&&[2,6].includes(dir)
      ?palms.sort((a,b)=>dir===2?a.x-b.x:b.x-a.x)[0]
      :sidePalms.sort((a,b)=>previousHand?Math.hypot(a.x-previousHand.x,a.y-previousHand.y)-Math.hypot(b.x-previousHand.x,b.y-previousHand.y):a.x-b.x)[0];
    previousHand=palm;
    const visibleRoot=roots.filter(p=>Math.hypot(p.x-root.x,p.y-root.y)<24);
    removeMarks(cell,visibleRoot,true);removeMarks(cell,palms);
    const ratio=88/(source.width/4),offset=[Math.round(48-root.x*ratio),Math.round(92-root.y*ratio)];
    const sampleW=Math.round(cw*ratio),sampleH=Math.round(ch*ratio);
    const sampled=sampleNearest(cell,{sx:0,sy:0,sw:cw,sh:ch},sampleW,sampleH),frame=rgba(96,96);
    for(let y=0;y<sampleH;y++)for(let x=0;x<sampleW;x++){
      const tx=x+offset[0],ty=y+offset[1];if(tx<4||ty<4||tx>=92||ty>=92)continue;
      sampled.data.copy(frame.data,(ty*96+tx)*4,(y*sampleW+x)*4,(y*sampleW+x+1)*4);
    }
    const hand=nearestSolid(frame,[palm.x*ratio+offset[0],palm.y*ratio+offset[1]]);
    const target=at<8?16+at:at<16?combat[at-8]:24+at-16;
    for(let y=0;y<96;y++){
      body.data.fill(0,((dir*96+y)*body.width+target*96)*4,((dir*96+y)*body.width+(target+1)*96)*4);
      hands.data.fill(0,((dir*96+y)*hands.width+target*96)*4,((dir*96+y)*hands.width+(target+1)*96)*4);
    }
    blit(frame,body,target*96,dir*96);
    // Foreground glove pixels are copied from the authored drawing, never drawn
    // as a new circle. They can cover a handle even when the shaft is in front.
    const mask=rgba(96,96);
    for(let y=hand[1]-3;y<=hand[1]+3;y++)for(let x=hand[0]-3;x<=hand[0]+3;x++){
      if(x<0||y<0||x>=96||y>=96)continue;
      frame.data.copy(mask.data,(y*96+x)*4,(y*96+x)*4,(y*96+x+1)*4);
    }
    blit(mask,hands,target*96,dir*96);
    Object.assign(base.anchors[dir][target],{hand,feet:[48,92],measured:true,calibration:manualPalm?"visible-palm":"authored-palm-marker"});
    Object.assign(base.frameRig.frames[dir][target],{hand,registration:{source:sourcePath,sourceRect:[sx,sy,cw,ch],sourceGround:[root.x,root.y],groundMethod:measuredRoot?"marker":"logical-canvas-guide",scale:ratio,offset},reviewed:true});
    mappings.push({target,dir,hand,sourceRect:[sx,sy,cw,ch],sourceGround:[root.x,root.y],scale:ratio,offset});
  }
  // The final recovery drawing is exactly the authored ready drawing, so the
  // loop closes without an art discontinuity or runtime tween.
  const ready=crop(body,0,dir*96,96,96),readyHand=crop(hands,0,dir*96,96,96);
  blit(ready,body,6*96,dir*96);blit(readyHand,hands,6*96,dir*96);
  base.anchors[dir][6]=structuredClone(base.anchors[dir][0]);
  base.frameRig.frames[dir][6]=structuredClone(base.frameRig.frames[dir][0]);
  for(const file of [base.file,base.handFile]){
    if(!sourceRecords.has(file))sourceRecords.set(file,new Set());
    sourceRecords.get(file).add(job.source);
    if(job.attackSource)sourceRecords.get(file).add(job.attackSource);
  }
  job.mapping=mappings;job.sha256=createHash("sha256").update(await readFile(job.source)).digest("hex");
}
for(const [file,image]of packedImages){
  // Physical atlas padding is shared by every frame, including legacy hurt
  // and death slots. Sampling stays uniform for the whole original sheet.
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)
    if(x%96<4||y%96<4||x%96>=92||y%96>=92)image.data[(y*image.width+x)*4+3]=0;
  await png(image,"site/assets/"+file+".png");
  const rec=records.assets.find(a=>a.id===file);
  rec.additionalSources=[...new Set([...(rec.additionalSources||[]),...sourceRecords.get(file)])];
  rec.sha256=createHash("sha256").update(await readFile("site/assets/"+file+".png")).digest("hex");
  rec.registeredMotionVersion=31;
}
for(const [id,base]of Object.entries(art.appearance.bases)){
  const body=packedImages.get(base.file);if(!body)continue;
  for(const [animation,first]of [["walk",16],["idle",24]]){
    const file=`locomotion/${id}-${animation}`,image=rgba(768,768);
    for(let d=0;d<8;d++)for(let f=0;f<8;f++)blit(crop(body,(first+f)*96,d*96,96,96),image,f*96,d*96);
    await png(image,"site/assets/"+file+".png");
    const rec=records.assets.find(a=>a.id===file);
    rec.additionalSources=[...new Set([...(rec.additionalSources||[]),...sourceRecords.get(base.file)])];
    rec.sha256=createHash("sha256").update(await readFile("site/assets/"+file+".png")).digest("hex");
    rec.registeredMotionVersion=31;
    const clip=art.characterLayouts[id].clips[animation];
    clip.durationsMs=[...base.clips[animation].durationsMs];clip.duration=base.clips[animation].duration;
  }
}
await writeFile("site/assets/manifest.json",JSON.stringify(art,null,2)+"\n");
await writeFile("art/generated-assets.json",JSON.stringify(records,null,2)+"\n");
await writeFile(planFile,JSON.stringify(plan,null,2)+"\n");
console.log("Packed registered body/hand/locomotion atlases without per-frame silhouette scaling");
