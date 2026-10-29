from playwright.sync_api import sync_playwright
import sys,math
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 for cls,kind in [('ranger','arrow-shot'),('mage','starfall')]:
  context=b.new_context(viewport={'width':1440,'height':900});p=context.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
  p.evaluate('''async cls=>{const{World,createPlayer,stats}=await import('./core.js');const raw=createPlayer(cls);Object.assign(raw,{map:'sprout',level:30});delete raw.allocationVersion;delete raw.allocated;const w=new World(),q=w.addPlayer(raw),m=w.map('sprout').mobs[0];raw.x=m.x-2;raw.y=m.y;raw.hp=stats(q).maxHp;localStorage.setItem('leaftale:save:v1',JSON.stringify(raw));}''',cls)
  p.reload();p.locator('#loading').wait_for(state='hidden')
  p.evaluate('''async()=>{const rev=document.querySelector('meta[name=leaftale-revision]').content;const{World}=await import('./core.js?v='+rev);World.prototype.updateMob=function(){};window.canvasTexts=[];const f=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){canvasTexts.push(String(t));return f.call(this,t,...a);};}''')
  p.locator('#continue-game').click();p.wait_for_timeout(200)
  assert abs(p.evaluate('__leaftale.view().zoom')-1.1/1.2)<1e-8
  target=p.evaluate('''()=>{const s=__leaftale.snapshot(),m=s.mobs.filter(m=>m.hp>0).sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];const q=__leaftale.worldToScreen(m.x,m.y);return{id:m.uid,hp:m.hp,x:q.x,y:q.y-34*__leaftale.view().zoom};}''')
  p.mouse.click(target['x'],target['y']);p.wait_for_timeout(120)
  assert p.evaluate('(id)=>__leaftale.snapshot().mobs.find(m=>m.uid===id).hp',target['id'])==target['hp']
  p.locator('#skillbar [data-action=attack]').click();assert 'aiming' in (p.locator('#world').get_attribute('class')or'');assert p.evaluate('__leaftale.snapshot().player.action') is None;assert p.locator('#world').evaluate('(e)=>getComputedStyle(e).cursor')=='crosshair'
  p.keyboard.press('Escape');assert 'aiming' not in (p.locator('#world').get_attribute('class')or'')
  p.keyboard.press('a');p.mouse.click(30,700);assert 'aiming' not in (p.locator('#world').get_attribute('class')or'');assert p.evaluate('__leaftale.snapshot().player.combatTarget') is None;p.keyboard.press('a')
  p.evaluate('''id=>{window.samples=[];window.recording=true;function f(){const s=__leaftale.snapshot(),m=s.mobs.find(m=>m.uid===id);samples.push({time:s.time,hp:m?.hp??0,effects:s.effects.filter(e=>['arrow-shot','starfall'].includes(e.kind))});if(recording)requestAnimationFrame(f);}requestAnimationFrame(f); }''',target['id'])
  p.mouse.click(target['x'],target['y']);p.wait_for_function('(kind)=>__leaftale.snapshot().effects.some(e=>e.kind===kind)',arg=kind)
  p.screenshot(path='/tmp/target-'+cls+'-flight.png');p.wait_for_timeout(800)
  samples=p.evaluate('()=>{recording=false;return samples;}');effect=next(e for s in samples for e in s['effects'] if e['kind']==kind)
  hit=next(s for s in samples if s['hp']<target['hp']);assert hit['time']>=effect['hitAt']-.025,(kind,effect,hit)
  assert p.evaluate('()=>canvasTexts.every(t=>!/^×\\d/.test(t)&&!/^\\d+ 리프$/.test(t))')
  if cls=='mage':
   focus=p.evaluate('__leaftale.snapshot().player.focus');p.keyboard.press('w');p.wait_for_timeout(100);assert p.evaluate('__leaftale.snapshot().player.focus')>=focus
   q=p.evaluate('()=>{const p=__leaftale.snapshot().player;return __leaftale.worldToScreen(p.x,p.y);}')
   p.mouse.move(q['x'],q['y']);p.wait_for_timeout(80);p.screenshot(path='/tmp/ground-target-preview.png');p.mouse.click(q['x'],q['y'])
   p.wait_for_function('__leaftale.snapshot().effects.some(e=>e.kind==="magic")');assert p.evaluate('__leaftale.snapshot().player.focus')<focus
   p.keyboard.press('e');p.mouse.click(q['x'],q['y'],button='right');assert 'aiming' not in (p.locator('#world').get_attribute('class')or'')
  context.close()
 assert not errors,errors
 print('PASS: enemy clicks only select; A/QWER arm before confirmation; Esc/right-click cancel; empty-floor area casting and previews; arrow/starfall damage lands at impact; no ground-loot labels; +10% zoom')
 b.close()
