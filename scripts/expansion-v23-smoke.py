"""Real skill input, delayed arrow rain, visible leap and the seven-rank equipment ladder."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 for cls,key,kind in [('ranger','w','arrow-rain'),('warden','e','leaf-landing')]:
  p=b.new_page(viewport={'width':1440,'height':900});p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
  p.evaluate('''async cls=>{const{createPlayer}=await import('./core.js'),{NAVIGATION}=await import('./world-layout.js');const raw=createPlayer(cls);Object.assign(raw,{map:'sprout',level:30,...NAVIGATION.sprout.worldAt(8,10)});delete raw.allocationVersion;delete raw.allocated;raw.inventory[cls==='ranger'?'bowlv30':'spearlv30']=1;localStorage.setItem('leaftale:save:v1',JSON.stringify(raw));}''',cls)
  p.reload();p.locator('#loading').wait_for(state='hidden')
  p.evaluate('''async()=>{const rev=document.querySelector('meta[name=leaftale-revision]').content,{World}=await import('./core.js?v='+rev),add=World.prototype.addPlayer;
   World.prototype.addPlayer=function(...args){const p=add.apply(this,args);this.rng=()=>.5;const mobs=this.map(p.map).mobs;for(const m of mobs){m.hp=0;m.respawn=Infinity;}Object.assign(mobs[0],{x:p.x+4,y:p.y,homeX:p.x+4,homeY:p.y,hp:1000000,maxHp:1000000,ai:'idle'});return p;};World.prototype.updateMob=function(){};
   window.skillDraws=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(im.src?.includes('skills/'))skillDraws.push(args);return draw.call(this,im,...args);};
  }''')
  p.locator('#continue-game').click();p.wait_for_timeout(150)
  start=p.evaluate('__leaftale.snapshot().player');assert start['stats']['range']==(11.25 if cls=='ranger' else 1.9)
  goal=p.evaluate('''()=>{const m=__leaftale.snapshot().mobs.find(m=>m.hp>0),q=__leaftale.worldToScreen(m.x,m.y);return{x:m.x,y:m.y,sx:q.x,sy:q.y,uid:m.uid};}''')
  p.evaluate('''()=>{window.samples=[];window.capture=true;function tick(){const s=__leaftale.snapshot();samples.push({time:s.time,x:s.player.x,y:s.player.y,action:s.player.action,hp:s.mobs.find(m=>m.hp>0)?.hp,effects:s.effects});if(capture)requestAnimationFrame(tick);}tick();}''')
  p.keyboard.press(key);p.mouse.click(goal['sx'],goal['sy']);p.wait_for_function('__leaftale.snapshot().player.action?.kind==="skill"')
  action=p.evaluate('__leaftale.snapshot().player.action')
  assert p.evaluate('__leaftale.snapshot().mobs.find(m=>m.hp>0).hp')==1000000
  if cls=='warden':
   p.wait_for_function('(t)=>__leaftale.snapshot().time>=t',arg=action['leap']['start']+.15)
   p.screenshot(path='/tmp/v23-leap-flight.png')
  p.wait_for_function('(kind)=>__leaftale.snapshot().effects.some(e=>e.kind===kind)',arg=kind)
  if cls=='ranger':p.wait_for_function('()=>{const s=__leaftale.snapshot(),e=s.effects.find(e=>e.kind==="arrow-rain");return e&&s.time-e.started>=.67;}')
  else:p.wait_for_timeout(100)
  p.screenshot(path='/tmp/v23-'+kind+'.png')
  effect=p.evaluate('(kind)=>__leaftale.snapshot().effects.find(e=>e.kind===kind)',kind)
  p.wait_for_function('(t)=>__leaftale.snapshot().time>t',arg=effect['started']+1.02 if cls=='ranger' else action['endAt']+.02)
  data=p.evaluate('()=>{capture=false;return samples;}')
  first=next(s for s in data if s['hp']<1000000)
  if cls=='ranger':
   assert first['time']>=effect['started']+.55-.025
   values=set(s['hp'] for s in data if effect['started']+.50<s['time']<effect['started']+1.0)
   assert len(values)==4,values
   assert abs(p.evaluate('__leaftale.snapshot().player.x')-start['x'])<.01
   assert '화살비' in p.locator('#skillbar').inner_text() and '옆구르기' not in p.locator('#skillbar').inner_text()
  else:
   assert first['time']>=action['hitAt']-.025
   assert any(start['x']+.2<s['x']<goal['x']-.2 for s in data)
   assert abs(p.evaluate('__leaftale.snapshot().player.x')-goal['x'])<.05
  assert p.evaluate('skillDraws.length')>0
  assert p.evaluate('skillDraws.every(a=>a[0]>=0&&a[1]>=0&&a[0]+a[2]<=1536&&a[1]+a[3]<=640&&a[2]===128&&a[3]===128)')
  p.keyboard.press('a');p.mouse.click(30,700);p.keyboard.press('i')
  item='bowlv30' if cls=='ranger' else 'spearlv30'
  p.locator('[data-inventory-item='+item+']').hover();p.locator('#item-tooltip [data-action=equip]').click()
  assert p.evaluate('__leaftale.snapshot().player.equipment.weapon')==item
  p.keyboard.press('i');p.wait_for_timeout(100);p.screenshot(path='/tmp/v23-'+cls+'-level30.png')
  p.goto(BASE+'bestiary.html#items')
  p.locator('[data-catalogue=items]').click();assert p.locator('#result-count').inner_text()=='204종'
  print('PASS: '+cls+' real skill input, delayed/landing damage, native effect crops, level30 equipment and 204-item catalogue',flush=True)
  p.close()
 assert not errors,errors
 b.close()
