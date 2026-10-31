"""Every native effect frame through the real renderer, plus short impact playback."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 p=b.new_page(viewport={'width':1200,'height':1540});p.on('pageerror',lambda e:errors.append(str(e)))
 p.route(BASE+'fx-audit.html',lambda r:r.fulfill(body='<html><body style="margin:0;background:#142d29"><canvas id="film" width="1200" height="1540"></canvas></body></html>',content_type='text/html'))
 p.goto(BASE+'fx-audit.html')
 result=p.evaluate('''async()=>{
  const {Renderer,loadArt}=await import('./renderer.js'),{SKILL_VISUALS}=await import('./skill-visuals.js'),{HIT_FRAMES}=await import('./skill-effects.js');
  await loadArt();const art=await(await fetch('./assets/manifest.json')).json();
  const canvas=document.querySelector('#film'),r=new Renderer(canvas,document.createElement('canvas')),ctx=canvas.getContext('2d');r.ctx=ctx;r.zoom=1;r.worldToScreen=(x,y)=>({x:300+32*(x-y),y:300+16*(x+y)});
  const calls=[],old=ctx.drawImage.bind(ctx);ctx.drawImage=(im,...a)=>{calls.push({file:im.src,width:im.width,height:im.height,a});old(im,...a);};
  const state={time:0,player:{id:'local',x:1,y:1},peers:[]};
  let frames=0;
  for(const [key,v] of Object.entries(SKILL_VISUALS))for(const z of [.8,1.21/1.2,1.5]){
   r.zoom=z;const a=art.skillApplication[key],e={key,owner:'local',x:3,y:3,fromX:1,fromY:1,radius:3,started:0,until:v.duration};
   for(let f=0;f<a.anchors.length;f++){state.time=(f+.5)/a.anchors.length*v.duration;r.skillEffect(e,state);frames++;}
  }
  for(const key of ['warden-0','ranger-0','hawk','ranger-4'])for(let dir=0;dir<8;dir++){
   const v=SKILL_VISUALS[key],theta=dir*Math.PI/4,e={key,x:1+4*Math.cos(theta),y:1+4*Math.sin(theta),fromX:1,fromY:1,started:0,until:v.duration};state.time=v.duration*.5;r.skillEffect(e,state);
  }
  if(calls.length!==frames+32)throw Error('missing effect draw');
  for(const d of calls){const[sx,sy,sw,sh,x,y,w,h]=d.a;if(sw!==128||sh!==128||sx%128||sy%128||sx<0||sy<0||sx+sw>d.width||sy+sh>d.height)throw Error('neighboring native cell leaked');if(w!==h||w>384||w%64||![x,y,w,h].every(Number.isInteger))throw Error('unstable pixel scale or stretched effect');}
  const impacts={};r.zoom=1;
  for(const cls of Object.keys(HIT_FRAMES)){
   const before=calls.length,e={classId:cls,x:3,y:3,started:0,until:.1};
   for(let f=0;f<3;f++){state.time=(f+.5)/30;r.attackImpact(e,state);}
   state.time=.1;r.attackImpact(e,state);
   const selected=calls.slice(before);if(selected.length!==3||selected.some((d,i)=>d.a[0]/128!==HIT_FRAMES[cls][i]||d.a[6]!==64||d.a[7]!==64))throw Error('long or large hit effect');impacts[cls]=selected.map(d=>d.a[0]/128);
  }
  // Exercise the actual enemy-impact branch in the complete scene renderer.
  const {World,createPlayer}=await import('./core.js'),world=new World(),hero=world.addPlayer(createPlayer()),snapshot=world.snapshot(hero.id);
  const contact=new Renderer(document.createElement('canvas'),document.createElement('canvas')),enemyFrames=[],original=contact.fx.bind(contact);contact.canvas.style.width='800px';contact.canvas.style.height='600px';document.body.append(contact.canvas);
  contact.fx=(...a)=>{if(a[0]===0&&a[4]===64&&a[5]===64)enemyFrames.push(a[1]);original(...a);};
  for(let f=0;f<4;f++){snapshot.time=f===3?.1:(f+.5)/30;snapshot.effects=[{kind:'enemy',id:1,x:hero.x,y:hero.y,started:0,until:.1}];contact.render(snapshot,null,0);}
  contact.canvas.remove();if(enemyFrames.join(',')!=='2,3,4')throw Error('enemy impact did not stop after three short frames: '+enemyFrames);
  window.audit={r,ctx,art,SKILL_VISUALS,state};return{skills:28,nativeFrames:frames,headings:32,impacts,enemyFrames};
 }''')
 print('PASS: '+str(result)+'; bounded native crops, equal width/height and stable half-pixel-grid scales',flush=True)
 for cls in ['warden','mage','ranger','herbalist']:
  p.evaluate('''cls=>{const {r,ctx,art,SKILL_VISUALS,state}=audit;r.zoom=1;ctx.fillStyle='#142d29';ctx.fillRect(0,0,1200,1540);ctx.font='14px sans-serif';
   const entries=Object.entries(SKILL_VISUALS).filter(([k,v])=>v.classId===cls);
   for(const [row,[key,v]] of entries.entries())for(let col=0;col<5;col++){
    const cx=col*240+120,cy=row*220+175;r.worldToScreen=(x,y)=>({x:cx+32*((x-3)-(y-3)),y:cy+16*((x-3)+(y-3))});
    ctx.strokeStyle='#7d9798';ctx.strokeRect(col*240,row*220,240,220);ctx.fillStyle='#edecd2';ctx.fillText(v.name+' · '+(col+1),col*240+8,row*220+18);
    ctx.strokeStyle='#ed7997';ctx.beginPath();ctx.moveTo(cx-7,cy);ctx.lineTo(cx+7,cy);ctx.moveTo(cx,cy-7);ctx.lineTo(cx,cy+7);ctx.stroke();
    const e={key,owner:'local',x:3,y:3,fromX:2,fromY:3,radius:3,started:0,until:v.duration};state.player={id:'local',x:3,y:3};state.time=v.duration*[.12,.3,.48,.66,.84][col];r.skillEffect(e,state);
   }
  }''',cls)
  p.screenshot(path='/tmp/v29-'+cls+'-effects.png')
 assert not errors,errors;b.close()
