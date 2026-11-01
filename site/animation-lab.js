import { CLASSES, ITEMS } from "./data.js";
import { DIRECTIONS } from "./directions.js";
import { equippedAppearance, starterEquipment } from "./equipment-appearance.js";
import { drawPaperDoll, heldWeaponPose, heldWeaponTip } from "./avatar-draw.js";
import { attackTimeline, animationSample, STRIKE_DURATION, RECOVERY_DURATION, WALK_DURATION } from "./animation.js";
import { CombatAudio } from "./audio.js";

const $=id=>document.getElementById(id),canvas=$("stage"),ctx=canvas.getContext("2d");
const revision=new URL(import.meta.url).searchParams.get("v")||"local";
const art=await(await fetch("./assets/manifest.json",{cache:"no-store"})).json();
const images=new Map(),audio=new CombatAudio();
let actor="warden",appearance=null,dir=5,clock=0,playing=true,speed=1,last=performance.now(),sequence=[],total=1,index=0,request=0,lastCycle=-1,lastFrame=-1,hitCount=0;
const labels={windup:"준비",attack:"타격",recover:"마무리 · 회복",walk:"걷기",idle:"대기"};
$("actor").innerHTML=CLASSES.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
$("direction").innerHTML=DIRECTIONS.map((d,i)=>`<option value="${i}">${d.label}</option>`).join("");$("direction").value="5";
async function load(file){if(images.has(file))return;const im=new Image();im.src="./assets/"+file+".png?v="+revision;await im.decode();images.set(file,im);}
function buildSequence(){
  const layout=appearance.layout,anim=$("animation").value,t=attackTimeline(0,actor);
  const phases=anim==="combo"?["windup","attack","recover"]:[anim];
  sequence=[];let start=0;
  for(const phase of phases){
    const duration={windup:t.strikeAt,attack:STRIKE_DURATION,recover:RECOVERY_DURATION,walk:layout.clips?.walk?.duration||WALK_DURATION,idle:layout.clips?.idle?.duration||.72}[phase];
    const clip=layout.clips?.[phase],frames=clip?.frames||layout.animations[phase];
    const weights=clip?.durationsMs?.length===frames.length?clip.durationsMs:frames.map(()=>1),sum=weights.reduce((a,b)=>a+b,0);
    let phaseTime=0;
    for(let i=0;i<frames.length;i++){
      const span=duration*weights[i]/sum;
      sequence.push({frame:frames[i],phase,start,end:start+span,phaseStart:start-phaseTime,phaseDuration:duration,durationMs:span*1000,events:clip?.events?.[i]||((phase==="attack"&&i===1)?["hit"]:[])});
      phaseTime+=span;start+=span;
    }
  }
  total=start;clock=0;lastCycle=lastFrame=-1;hitCount=0;
  $("timeline").innerHTML=sequence.map((s,i)=>`<button data-frame="${i}" aria-label="${i+1}번 프레임 · ${labels[s.phase]} · ${Math.round(s.durationMs)}밀리초" aria-pressed="false">${i+1}<br>${Math.round(s.durationMs)}ms</button>`).join("");
}
async function choose(resetWeapon=true){
  const token=++request;$("status").textContent="원본을 읽는 중…";document.querySelector(".stage").setAttribute("aria-busy","true");
  actor=$("actor").value;
  if(resetWeapon)$("weapon").innerHTML=Object.values(ITEMS).filter(i=>i.slot==="weapon"&&i.classId===actor).sort((a,b)=>a.level-b.level).map(i=>`<option value="${i.id}">Lv.${i.level} · ${i.name}</option>`).join("");
  const gear={...starterEquipment(actor),weapon:$("weapon").value},next=equippedAppearance(art,actor,gear);
  const files=new Set(next.layers.flatMap(l=>[l.file,...(l.poseSets||[]).flatMap(set=>Object.values(set).map(p=>p.file))]));
  await Promise.all([...files].map(load));if(token!==request)return;
  appearance=next;buildSequence();document.querySelector(".stage").setAttribute("aria-busy","false");
}
function pause(){playing=false;$("play").textContent="재생";$("play").setAttribute("aria-pressed","false");}
function selectFrame(i){pause();index=(i+sequence.length)%sequence.length;clock=sequence[index].start+1e-7;draw();}
function current(){const at=clock%total;return sequence.find(s=>at<s.end-1e-9)||sequence.at(-1);}
function draw(){
  if(!appearance||!sequence.length)return;
  const s=current();index=sequence.indexOf(s);const zoom=Number($("zoom").value),at=clock%total;
  ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
  const center={x:450,y:440},left=center.x-48*zoom,top=center.y-92*zoom;
  const distance=$("animation").value==="walk"?clock/total*(appearance.layout.clips?.walk?.stridePxByDirection?.[dir]||appearance.layout.clips?.walk?.stridePx||48)*zoom:0;
  const ax=Math.sin(dir*Math.PI/4),ay=-Math.cos(dir*Math.PI/4);
  ctx.save();ctx.translate(center.x-distance*ax%96,center.y-distance*ay%48);ctx.strokeStyle="#567778";ctx.lineWidth=1;
  for(let row=-18;row<18;row++)for(let col=-18;col<18;col++){
    const x=(col-row)*48,y=(col+row)*24;ctx.beginPath();ctx.moveTo(x,y-24);ctx.lineTo(x+48,y);ctx.lineTo(x,y+24);ctx.lineTo(x-48,y);ctx.closePath();ctx.stroke();
  }ctx.restore();
  const motion={anim:s.phase,time:at,start:s.phaseStart,duration:s.phaseDuration,flipX:$("flip").checked,debug:$("debug").checked};
  drawPaperDoll(ctx,appearance,images,s.frame,dir,left,top,zoom,motion);
  const w=appearance.layers.find(l=>l.held),p=w?heldWeaponPose(appearance.layout,w,s.frame,dir,motion):null;
  if($("trail").checked&&w){
    ctx.beginPath();ctx.strokeStyle="#c8ddad";ctx.lineWidth=1;
    for(let i=0;i<=index;i++){const tip=heldWeaponTip(appearance.layout,w,sequence[i].frame,dir,motion);if(!tip)continue;const x=left+tip[0]*zoom,y=top+tip[1]*zoom;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
  }
  $("pose-label").textContent=DIRECTIONS[dir].id+" · "+labels[s.phase];
  $("frame-label").textContent=`${index+1} / ${sequence.length} · 셀 ${s.frame}`;
  $("duration-label").textContent=s.durationMs.toFixed(1)+" ms";
  $("order-label").textContent=(p?.depth||([0,1,7].includes(dir)?"behind":"front"))==="behind"?"무기 → 몸 → 손":"몸 → 무기 → 손";
  $("status").textContent=`${playing?"재생 중":"정지"} · ${speed}배속 · ${appearance.layout.frameRig?"고정 논리 캔버스 96×96":"기존 원본"}${p?` · 손 (${p.hand.join(", ")})` : ""}`;
  const cycle=Math.floor(clock/total);
  if(playing&&(cycle!==lastCycle||index!==lastFrame)){
    if(s.events.includes("hit")){hitCount++;if($("audio").checked)audio.play("hit");}
    lastCycle=cycle;lastFrame=index;
  }
  $("events").textContent=`현재 표식: ${s.events.join(" · ")||"없음"} · 이번 재생 타격 ${hitCount}회`;
  for(const b of $("timeline").querySelectorAll("button"))b.setAttribute("aria-pressed",String(Number(b.dataset.frame)===index));
}
$("actor").onchange=()=>choose();$("weapon").onchange=()=>choose(false);
$("direction").onchange=()=>{dir=Number($("direction").value);draw();};
$("animation").onchange=()=>{if(appearance)buildSequence();draw();};
$("speed").onchange=()=>{speed=Number($("speed").value);};
$("play").onclick=()=>{playing=!playing;$("play").textContent=playing?"일시정지":"재생";$("play").setAttribute("aria-pressed",String(playing));};
$("prev").onclick=()=>selectFrame(index-1);$("next").onclick=()=>selectFrame(index+1);
$("restart").onclick=()=>{clock=0;lastCycle=lastFrame=-1;hitCount=0;draw();};
$("timeline").onclick=e=>{const b=e.target.closest("[data-frame]");if(b)selectFrame(Number(b.dataset.frame));};
$("audio").onchange=()=>{if($("audio").checked)audio.unlock();};
for(const id of ["debug","flip","trail","zoom"])$(id).onchange=draw;
function tick(now){const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;if(playing&&appearance)clock+=dt*speed;draw();requestAnimationFrame(tick);}
window.__animationLab={
  setFrame:selectFrame,setTime(seconds){clock=Math.max(0,seconds);pause();draw();},
  setPlaying(value){if(playing!==value)$("play").click();},
  snapshot(){const s=current(),weapon=appearance?.layers.find(l=>l.held),pose=weapon&&heldWeaponPose(appearance.layout,weapon,s.frame,dir,{anim:s.phase});return{actor,dir,clock,playing,speed,index,...s,hand:pose?.hand,grip:pose?.grip,angle:pose?.angle,depth:pose?.depth,ground:appearance?.layout.frameRig?.ground,sequence};},
};
await choose();requestAnimationFrame(tick);
