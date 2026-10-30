"""Fullscreen, Escape, equipped status, double click, diagonal input and mobile tracking."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 p=b.new_page(viewport={'width':1440,'height':900});p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
 for w,h in [(1440,900),(1366,768),(390,844),(360,640),(320,568),(844,390)]:
  p.set_viewport_size({'width':w,'height':h});p.wait_for_timeout(70)
  assert p.locator('#lobby').evaluate('e=>e.scrollHeight<=e.clientHeight+1'),(w,h)
  box=p.locator('#start-game').bounding_box();assert box['y']+box['height']<=h+1,(w,h,box)
 p.set_viewport_size({'width':1440,'height':900})
 p.evaluate('''async()=>{const{createPlayer}=await import('./core.js');const raw=createPlayer();raw.level=30;delete raw.allocationVersion;delete raw.allocated;raw.inventory.spearlv5=1;localStorage.setItem('leaftale:save:v1',JSON.stringify(raw));}''')
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#start-fullscreen').check();p.locator('#continue-game').click()
 p.wait_for_function('document.fullscreenElement?.id==="game-shell"')
 assert abs(p.evaluate('__leaftale.view().zoom')-(1.21/1.2))<1e-10
 p.keyboard.press('Escape');assert p.locator('#menu-panel').get_attribute('data-panel')=='settings';assert p.locator('#panel-title').inner_text()
 p.locator('[data-fullscreen]').uncheck();p.wait_for_function('!document.fullscreenElement');p.locator('[data-fullscreen]').check();p.wait_for_function('!!document.fullscreenElement')
 p.keyboard.press('Escape');p.keyboard.press('i');p.locator('[data-inventory-item=spearlv5]').dblclick()
 assert p.evaluate('__leaftale.snapshot().player.equipment.weapon')=='spearlv5'
 p.keyboard.press('i');p.keyboard.press('v');assert p.locator('#panel-title').inner_text()=='캐릭터 상태';assert p.locator('[data-equipment-slot]').count()==5
 assert '새순' in p.locator('[data-equipment-slot=weapon]').inner_text();p.screenshot(path='/tmp/v25-status-equipped.png')
 for w in [390,320]:
  p.set_viewport_size({'width':w,'height':844});assert p.locator('#panel-body').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),w
 p.set_viewport_size({'width':1440,'height':900});p.keyboard.press('Escape');assert p.locator('#menu-panel').get_attribute('data-panel')=='settings'
 print('PASS: fitted lobby, 10% world zoom, actual fullscreen launch/settings, Escape, double-click equip and five-slot status at desktop/320px',flush=True)
 p.close()
 for cls in ['warden','herbalist','ranger']:
  p=b.new_page(viewport={'width':1440,'height':900});p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
  p.evaluate('''async cls=>{const{createPlayer}=await import('./core.js'),{NAVIGATION}=await import('./world-layout.js'),raw=createPlayer(cls);Object.assign(raw,{level:30,map:cls==='ranger'?'sprout':'village',...NAVIGATION[cls==='ranger'?'sprout':'village'].worldAt(8,10)});delete raw.allocationVersion;delete raw.allocated;localStorage.setItem('leaftale:save:v1',JSON.stringify(raw));}''',cls)
  p.reload();p.locator('#loading').wait_for(state='hidden')
  p.evaluate('''async()=>{const rev=document.querySelector('meta[name=leaftale-revision]').content,{World}=await import('./core.js?v='+rev),add=World.prototype.addPlayer;
   World.prototype.addPlayer=function(...args){const p=add.apply(this,args);window.testWorld=this;this.rng=()=>.5;if(p.classId==='ranger'){for(const m of this.map(p.map).mobs){m.hp=0;m.respawn=Infinity;}const m=this.map(p.map).mobs[0];Object.assign(m,{x:p.x+3,y:p.y,homeX:p.x+3,homeY:p.y,hp:1e7,maxHp:1e7});}return p;};World.prototype.updateMob=function(){};
   window.walkDraws=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(im.src?.includes('/appearance/base/')&&args[0]>=16*96&&args[0]<24*96)walkDraws.push({file:im.src,args});return draw.call(this,im,...args);};
  }''')
  p.locator('#continue-game').click();p.wait_for_timeout(150)
  if cls!='ranger':
   p.evaluate('''async()=>{const{NAVIGATION}=await import('./world-layout.js'),{blocked}=await import('./core.js'),{clearSight}=await import('./combat.js'),{facingVector}=await import('./directions.js'),{NPCS}=await import('./data.js');const hero=testWorld.players.get('local'),nav=NAVIGATION[hero.map];for(let r=3;r<nav.rows-3;r++)for(let c=3;c<nav.cols-3;c++){const a=nav.worldAt(c,r);if(blocked(hero.map,a.x,a.y))continue;const goals=[1,3,5,7].map(d=>{const v=facingVector(d);return{x:a.x+v.x*6,y:a.y+v.y*6};});if(goals.every(g=>clearSight(hero.map,a,g,(m,x,y)=>!blocked(m,x,y))&&NPCS.filter(n=>n.map===hero.map).every(n=>Math.hypot(n.x-g.x,n.y-g.y)>3))){window.testAnchor=a;return;}}throw Error('no clear diagonal fixture');}''')
   for d in [1,3,5,7]:
    p.evaluate('''()=>{const hero=testWorld.players.get('local');testWorld.stopCombat(hero,false);Object.assign(hero,testAnchor);window.walkDraws=[];}''');p.wait_for_timeout(350)
    goal=p.evaluate('''async d=>{const{facingVector}=await import('./directions.js');const s=__leaftale.snapshot().player,v=facingVector(d),x=s.x+v.x*6,y=s.y+v.y*6,q=__leaftale.worldToScreen(x,y);return{x,y,sx:q.x,sy:q.y};}''',d)
    p.mouse.click(goal['sx'],goal['sy']);p.wait_for_function('(d)=>__leaftale.snapshot().player.dir===d&&__leaftale.snapshot().player.anim==="walk"',arg=d)
    p.wait_for_function('(d)=>walkDraws.some(a=>a.args[1]===d*96)',arg=d)
    p.wait_for_timeout(130);p.screenshot(path='/tmp/v25-'+cls+'-walk-'+str(d)+'.png')
    p.wait_for_function('(g)=>{const s=__leaftale.snapshot().player;return Math.hypot(g.x-s.x,g.y-s.y)<.05;}',arg=goal)
   print('PASS: '+cls+' actual diagonal floor clicks draw NE/SE/SW/NW walking rows',flush=True)
  else:
   start=p.evaluate('__leaftale.snapshot().player')
   goal=p.evaluate('''()=>{const m=__leaftale.snapshot().mobs.find(m=>m.hp>0),q=__leaftale.worldToScreen(m.x,m.y);return{x:q.x,y:q.y-25*__leaftale.view().zoom};}''')
   p.keyboard.press('e');p.mouse.click(goal['x'],goal['y']);p.wait_for_function('__leaftale.snapshot().player.trackingRemaining>0')
   p.evaluate('''()=>{window.shots=new Map();window.capture=true;function record(){const s=__leaftale.snapshot();for(const e of s.effects.filter(e=>e.kind==='arrow-shot'&&e.mobile))shots.set(e.id,{time:s.time,anim:s.player.anim,x:s.player.x,y:s.player.y});if(capture)requestAnimationFrame(record);}record();}''')
   for n in range(14):
    q=p.evaluate('''g=>__leaftale.worldToScreen(g.x,g.y)''',{'x':start['x']+(6 if n%2==0 else -4),'y':start['y']+1})
    p.mouse.click(q['x'],q['y']);p.wait_for_timeout(160)
   samples=p.evaluate('()=>{capture=false;return[...shots.values()];}');assert len(samples)>=2,samples
   assert any(s['anim']=='walk' for s in samples),samples
   assert p.evaluate('__leaftale.snapshot().mobs.find(m=>m.hp>0).hp')<1e7
   p.screenshot(path='/tmp/v25-ranger-moving-fire.png');p.keyboard.press('a');p.mouse.click(30,700)
   assert p.evaluate('__leaftale.snapshot().player.trackingTarget')is None
   print('PASS: marked enemy receives real arrows while repeated floor clicks keep moving; A + floor cancels tracking fire',flush=True)
  p.close()
 assert not errors,errors;b.close()
