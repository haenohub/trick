"""Real A input, observed combat phases, dynamic map UI and complete VFX cells."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':900});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
 p.evaluate('''async()=>{const{World,createPlayer,stats}=await import('./core.js');const{NAVIGATION}=await import('./world-layout.js');const raw=createPlayer('warden');Object.assign(raw,{level:30,map:'sprout',...NAVIGATION.sprout.spawn});raw.hp=stats(raw).maxHp;const w=new World(),q=w.addPlayer(raw),m=w.map('sprout').mobs[0];raw.x=m.x-.7;raw.y=m.y;delete raw.allocationVersion;delete raw.allocated;localStorage.setItem('leaftale:save:v1',JSON.stringify(raw));}''')
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click();p.wait_for_timeout(100)
 assert p.locator('#skillbar [data-action=attack] kbd').inner_text()=='A'
 p.evaluate('''()=>{window.motionSamples=[];window.captureMotion=true;function sample(){const s=__leaftale.snapshot();motionSamples.push({time:s.time,anim:s.player.anim,hp:s.mobs.reduce((n,m)=>n+m.hp,0)});if(captureMotion)requestAnimationFrame(sample);}requestAnimationFrame(sample);}''')
 p.keyboard.press('Tab');p.keyboard.press('a');p.wait_for_timeout(750)
 samples=p.evaluate('()=>{captureMotion=false;return motionSamples;}')
 assert any(s['anim']=='windup' for s in samples),samples
 assert any(s['anim']=='attack' for s in samples),samples
 assert any(s['anim']=='recover' for s in samples),samples
 windup=next(s for s in samples if s['anim']=='windup')
 hit=next(s for s in samples if s['hp']<windup['hp'])
 assert hit['time']-windup['time']>.18,(windup,hit)
 assert hit['anim']=='attack',(windup,hit)
 p.screenshot(path='/tmp/leaftale-motion-live-combat.png')
 p.keyboard.press('m');assert '채집 군락' in p.locator('#panel-body').inner_text();assert '함께 서식하는 생물' in p.locator('#panel-body').inner_text();p.keyboard.press('m')
 p.keyboard.press('p');assert 'Space' in p.locator('[data-rebind=pickup]').first.inner_text();p.keyboard.press('p')
 fx=p.evaluate('''async()=>{const{Renderer,loadArt}=await import('./renderer.js');await loadArt();const calls=[],r=new Renderer(document.createElement('canvas'),document.createElement('canvas'));r.dpr=1;r.ctx={save(){},restore(){},translate(){},scale(){},rotate(){},drawImage(image,sx,sy,sw,sh){calls.push({sx,sy,sw,sh,w:image.width,h:image.height});}};r.fx(7,15,0,0,64,64);r.fx(8,15,0,0,64,64);return calls;}''')
 assert len(fx)==2 and all(c['sx']==c['sw']*15 and c['w']==c['sw']*16 and c['h']==c['sh']*9 for c in fx),fx
 p.goto(BASE+'directions.html');p.wait_for_function("document.querySelector('#status').textContent.startsWith('8방향')")
 p.locator('#animation').select_option('combo');frames=[]
 for i in range(4):p.wait_for_timeout(100);frames.append(p.locator('#hero').evaluate('(c)=>c.toDataURL()'))
 assert len(set(frames))>=3
 assert not errors,errors
 print('PASS: A input visibly prepares, strikes and recovers; damage lands during strike; Space mapping, gathering/mixed habitats UI, all sixteen VFX cells and gallery attack chains work')
 b.close()
