"""Reference-style HUD, centered movement, quarter-view picking and map edges."""
from playwright.sync_api import sync_playwright
import sys,math
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':900});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE);p.locator('#loading').wait_for(state='hidden');p.locator('#start-game').click();p.wait_for_timeout(80)
 p.evaluate('''()=>{window.centerSamples=[];window.centerCapture=true;function sample(){const s=__leaftale.snapshot(),v=__leaftale.view(),q=__leaftale.worldToScreen(s.player.x,s.player.y);centerSamples.push({x:q.x,y:q.y,w:v.size.width,h:v.size.height,z:v.zoom});if(centerCapture)requestAnimationFrame(sample);}requestAnimationFrame(sample);}''')
 start=p.evaluate('__leaftale.snapshot().player');target={'x':start['x']+3,'y':start['y']-3}
 q=p.evaluate('q=>__leaftale.worldToScreen(q.x,q.y)',target);p.mouse.click(q['x'],q['y'])
 p.wait_for_function('(q)=>Math.hypot(__leaftale.snapshot().player.x-q.x,__leaftale.snapshot().player.y-q.y)<.05',arg=target)
 samples=p.evaluate('()=>{centerCapture=false;return centerSamples;}')
 assert len(samples)>5 and all(abs(s['x']-s['w']/2)<.01 and abs(s['y']-s['h']/2-24*s['z'])<.01 for s in samples),samples
 print('PASS: real floor-click movement keeps the player centered on every sampled frame')
 result=p.evaluate('''async()=>{
  const {Renderer,loadArt}=await import('./renderer.js');const {World,createPlayer,stats}=await import('./core.js');const{NAVIGATION}=await import('./world-layout.js');
  await loadArt();const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-2000px;top:0;width:1024px;height:768px';document.body.append(canvas);
  const r=new Renderer(canvas,document.createElement('canvas')),results=[];
  for(const nav of Object.values(NAVIGATION)){
   const cells=[];for(let y=0;y<nav.rows;y++)for(let x=0;x<nav.cols;x++)if(nav.floor[y][x])cells.push([x,y]);
   const edge=[cells.toSorted((a,b)=>a[0]-b[0])[0],cells.toSorted((a,b)=>b[0]-a[0])[0],cells.toSorted((a,b)=>a[1]-b[1])[0],cells.toSorted((a,b)=>b[1]-a[1])[0]];
   for(const cell of edge){
    const raw=createPlayer('warden');Object.assign(raw,{map:nav.id,level:30,defeatedBosses:['m20'],...nav.worldAt(...cell)});raw.hp=stats(raw).maxHp;
    const world=new World(),hero=world.addPlayer(raw,'local'),s=world.snapshot('local');r.render(s,null,.016);
    const point=r.worldToScreen(s.player.x,s.player.y),back=r.screenToWorld(point.x,point.y);
    if(Math.abs(point.x-512)>.01||Math.abs(point.y-384-24*r.zoom)>.01||Math.hypot(back.x-s.player.x,back.y-s.player.y)>1e-8)throw Error(nav.id+' camera/picking mismatch');
    for(const [x,y] of [[2,2],[1000,2],[2,740],[1000,740]]){
     const pixels=r.scene.getContext('2d').getImageData(x,y,12,12).data;let blank=0;
     for(let i=0;i<pixels.length;i+=4)if(pixels[i]===32&&pixels[i+1]===60&&pixels[i+2]===47)blank++;
     if(blank>140)throw Error(nav.id+' blank exterior terrain');
    }
    results.push(nav.id);
   }
  }
  canvas.remove();return results.length;
 }''')
 assert result==40,result
 print('PASS: all ten maps keep centered cameras at four walkable extremes, with inverse picking and no blank terrain borders')
 for width,height in [(1920,1080),(1440,900),(1008,754),(768,600),(390,844),(320,740),(960,420)]:
  p.set_viewport_size({'width':width,'height':height});p.wait_for_timeout(100)
  boxes=p.evaluate('''()=>{
   const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   return{hp:box('.player-card'),map:box('.map-card'),xp:box('.experience'),skills:box('.bottom-dock'),menu:box('.field-menu'),scroll:document.documentElement.scrollWidth};
  }''')
  assert boxes['scroll']<=width and boxes['xp']['y']==0,boxes
  assert boxes['hp']['x']<10 and boxes['map']['right']<=width and boxes['map']['x']>=boxes['hp']['right'],boxes
  assert boxes['skills']['x']>width*.6 and boxes['skills']['h']>boxes['skills']['w'] and boxes['menu']['bottom']<=height,boxes
  assert not p.locator('#chat-toggle').is_visible() and not p.locator('#chat-box').is_visible()
  p.screenshot(path=f'/tmp/leaftale-quarter-hud-{width}x{height}.png')
 p.set_viewport_size({'width':1440,'height':900});p.keyboard.press('i');assert p.locator('#menu-panel').is_visible();p.keyboard.press('i');assert p.locator('#menu-panel').is_hidden()
 assert not errors,errors
 print('PASS: seven desktop/mobile viewport layouts show top XP, compact left status, right minimap, vertical skill slots and bottom menus; no chat window or runtime errors')
 b.close()
