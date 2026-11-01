import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { animationSample, animationFrame, attackTimeline, STRIKE_DURATION, LocomotionClocks } from "../site/animation.js";
import { heldWeaponPose, heldWeaponTransform, drawPaperDoll } from "../site/avatar-draw.js";
import {equippedAppearance,starterEquipment} from "../site/equipment-appearance.js";
import {rgbaPixels} from "./png.mjs";

test("exposure sheets hold drawings for their authored duration, stop at the final one-shot pose and loop deterministically",()=>{
  const layout={animations:{idle:[0]},clips:{windup:{frames:[2,5,8],durationsMs:[90,80,50]},walk:{frames:[0,1,2,3],durationsMs:[120,40,120,40],duration:.32}}};
  assert.equal(animationFrame(layout,"windup",.089,0,.22),2);
  assert.equal(animationFrame(layout,"windup",.09,0,.22),5);
  assert.equal(animationFrame(layout,"windup",.17,0,.22),8);
  assert.equal(animationFrame(layout,"windup",9,0,.22),8);
  assert.ok(Math.abs(animationSample(layout,"windup",.05,0,.44).durationMs-180)<1e-8);
  assert.equal(animationFrame(layout,"walk",.119,0),0);
  assert.equal(animationFrame(layout,"walk",.12,0),1);
  assert.equal(animationFrame(layout,"walk",.32,0),0);
});

test("the actual release marker enters the second strike drawing exactly at the authoritative hit time",()=>{
  const layout={animations:{idle:[0]},clips:{attack:{frames:[3,4],durationsMs:[40,40],events:{1:["hit","release"]}}}};
  for(const cls of ["warden","mage","ranger","herbalist"]){
    const t=attackTimeline(10,cls);
    assert.equal(animationFrame(layout,"attack",t.hitAt-1e-6,t.strikeAt,STRIKE_DURATION),3);
    const hit=animationSample(layout,"attack",t.hitAt,t.strikeAt,STRIKE_DURATION);
    assert.equal(hit.frame,4);assert.ok(hit.events.includes("hit"));
  }
});

test("walking advances by actual projected world distance, stops with the actor and resets on a map warp",()=>{
  const c=new LocomotionClocks();
  const p={x:10,y:10,map:"sprout"};
  assert.equal(c.walkTime("hero",0,p,48,1.28),0);
  const first=c.walkTime("hero",.1,{...p,x:10.5,y:9.5},48,1.28);
  assert.ok(Math.abs(first-32/48*1.28)<1e-9);
  assert.equal(c.walkTime("hero",.2,{...p,x:10.5,y:9.5},48,1.28),first);
  assert.equal(c.walkTime("hero",.21,{...p,x:10.5,y:9.5},24,1.28),first,"changing heading/stride must preserve phase");
  assert.equal(c.walkTime("hero",.3,{...p,map:"coast"},48,1.28),0);
  c.stopWalk("hero");assert.equal(c.walkTime("hero",.4,p,48,1.28),0);
});

test("every live body drawing restores one logical canvas and ground from source registration, with an opaque foreground palm",async()=>{
  const art=JSON.parse(await readFile("site/assets/manifest.json","utf8"));
  for(const base of Object.values(art.appearance.bases)){
    const body=rgbaPixels(await readFile(`site/assets/${base.file}.png`)),hands=rgbaPixels(await readFile(`site/assets/${base.handFile}.png`));
    assert.deepEqual(base.frameRig.logicalSize,[96,96]);
    for(let d=0;d<8;d++)for(const f of [...base.animations.combo,...base.animations.walk,...base.animations.idle]){
      const rig=base.frameRig.frames[d][f],r=rig.registration;
      assert.ok(r&&rig.reviewed,`${base.file}:${d}:${f} lacks an original drawing`);
      assert.deepEqual(rig.trim,[0,0,96,96]);assert.deepEqual(rig.offset,[0,0]);
      for(let axis=0;axis<2;axis++)assert.ok(Math.abs(r.sourceGround[axis]*r.scale+r.offset[axis]-rig.ground[axis])<=.501);
      const [x,y]=rig.hand,at=((d*96+y)*body.width+f*96+x)*4+3;
      assert.ok(body.pixels[at]>0,`${base.file} hand is outside glove`);
      assert.ok(hands.pixels[at]>0,`${base.handFile} cannot cover the handle`);
    }
    assert.deepEqual(base.clips.attack.events[1],["release","hit"]);
    assert.equal(base.clips.combo.frames.length,8);
    for(let d=0;d<8;d++)for(const anim of ["idle","walk"]){
      const soles=base.animations[anim].map(f=>{
        let bottom=0;
        for(let y=0;y<96;y++)for(let x=0;x<96;x++)
          if(body.pixels[((d*96+y)*body.width+f*96+x)*4+3])bottom=y;
        if(d===0){
          const handX=base.frameRig.frames[d][f].hand[0];
          assert.ok(base.frameRig.classId==="ranger"?handX<48:handX>48,"north gait switched its holding hand");
        }
        return bottom;
      });
      assert.ok(Math.max(...soles)-Math.min(...soles)<=(anim==="idle"?3:5),`${base.file}:${d} registration lifted the whole actor`);
    }
  }
});

test("all 27 replacement weapon pose sets have isolated native cells and pivots on actual source pixels",async()=>{
  const art=JSON.parse(await readFile("site/assets/manifest.json","utf8"));
  const cache=new Map();let count=0;
  for(const w of Object.values(art.appearance.weapons)){
    if(!["spear","wand","bow"].includes(w.kind))continue;
    count++;assert.equal(w.perspectiveArtVersion,31);
    for(let d=0;d<8;d++){
      const p=w.poseSets[d][w.kind==="bow"?"draw":"strike"];
      if(!cache.has(p.file))cache.set(p.file,rgbaPixels(await readFile(`site/assets/${p.file}.png`)));
      const im=cache.get(p.file),x=Math.round(p.grip[0]),y=Math.round(p.grip[1]);
      assert.ok(im.pixels[((p.row*96+y)*im.width+p.col*96+x)*4+3],`${p.file}:${p.row}:${d} grip floats off item`);
      for(let sy=0;sy<96;sy++)for(let sx=0;sx<96;sx++){
        const a=im.pixels[((p.row*96+sy)*im.width+p.col*96+sx)*4+3];
        assert.ok(a===0||a===255);
        if(sx<4||sy<4||sx>=92||sy>=92)assert.equal(a,0,`${p.file} neighboring cell leak`);
      }
    }
  }
  assert.equal(count,27);
});

test("the renderer follows per-frame back/body/front/foreground-hand occlusion",async()=>{
  const art=JSON.parse(await readFile("site/assets/manifest.json","utf8"));
  const a=equippedAppearance(art,"warden",starterEquipment("warden")),w=a.layers.find(l=>l.held);
  const files=[...new Set(a.layers.flatMap(l=>[l.file,...(l.poseSets||[]).flatMap(s=>Object.values(s).map(p=>p.file))]))];
  for(const [frame,behind]of [[1,true],[4,false]]){
    const calls=[],ctx={save(){},restore(){},translate(){},rotate(){},drawImage(file){calls.push(file);}};
    drawPaperDoll(ctx,a,new Map(files.map(f=>[f,f])),frame,2,10,20,1.5);
    const weaponFile=heldWeaponPose(a.layout,w,frame,2).file;
    assert.deepEqual(calls,behind?[weaponFile,a.layout.file,a.layout.handFile]:[a.layout.file,weaponFile,a.layout.handFile]);
  }
});

test("a registered body frame cannot independently tween its weapon; grip and palm share one affine transform at every scale",async()=>{
  const art=JSON.parse(await readFile("site/assets/manifest.json","utf8"));
  const base=art.appearance.bases.warden,w=art.appearance.weapons.spear1;
  for(let d=0;d<8;d++)for(let f=0;f<32;f++){
    const start=heldWeaponPose(base,w,f,d,{anim:"windup",time:0,start:0,duration:1});
    const end=heldWeaponPose(base,w,f,d,{anim:"windup",time:.99,start:0,duration:1});
    assert.deepEqual(start,end,"weapon moved while the authored body frame was held");
    for(const scale of [.7,1,1.5,2.25,3]){
      const t=heldWeaponTransform(start,13.25,-71.5,scale),actual=t.point(start.grip);
      assert.ok(Math.hypot(actual[0]-t.hand[0],actual[1]-t.hand[1])<1e-10);
      const mirror=x=>2*13.25+96*scale-x;
      assert.ok(Math.abs(mirror(actual[0])-mirror(t.hand[0]))<1e-10);
      assert.equal(start.weaponScale,.8,"perspective must come from artwork, not a moving squash");
    }
  }
});
