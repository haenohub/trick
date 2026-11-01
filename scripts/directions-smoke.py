"""Check all directional artwork and real compass-facing mouse movement."""
from playwright.sync_api import sync_playwright
import sys, math, json
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE+'directions.html')
 page.wait_for_function("document.querySelector('#status').textContent.startsWith('8방향')")
 ids=page.evaluate('__directions.data.actors.map(a=>a.id)')
 assert len(ids)==72
 for actor in ids:
  page.locator('[data-actor="'+actor+'"]').click()
  page.wait_for_function("id=>__directions.selected===id && document.querySelector('#status').textContent.startsWith('8방향')",arg=actor)
  page.wait_for_timeout(45)
  assert page.evaluate("new Set([...document.querySelectorAll('.views canvas')].map(c=>c.toDataURL())).size")==8,actor
 print('PASS: all 72 actors show eight distinct views, 576 views total')
 for kind,count in [('character',4),('npc',8),('monster',60),('all',72)]:
  page.locator('[data-kind="'+kind+'"]').click()
  assert page.locator('[data-actor]').count()==count
 page.locator('#search').fill('콩잎')
 assert page.locator('[data-actor]').count()==1
 page.locator('[data-actor=m1]').click();page.locator('#search').fill('')
 for row in range(8):
  page.locator('[data-heading="'+str(row)+'"]').click()
  assert page.evaluate('__directions.heading')==row
 page.locator('#next').click();assert page.evaluate('__directions.heading')==0
 page.locator('#previous').click();assert page.evaluate('__directions.heading')==7
 page.locator('#animation').select_option('walk');samples=[]
 for _ in range(4):
  page.wait_for_timeout(160);samples.append(page.locator('#hero').evaluate('(c)=>c.toDataURL()'))
 assert len(set(samples))>=2
 page.locator('#play').click();assert page.locator('#play').get_attribute('aria-pressed')=='false'
 with page.expect_download() as info:page.locator('#view-download').click()
 assert info.value.suggested_filename=='m1-NW.png'
 page.locator('[data-actor=m40]').click();page.wait_for_function("document.querySelector('#status').textContent.startsWith('8방향')")
 page.screenshot(path='/tmp/leaftale-eight-directions-dragon.png',full_page=True)
 print('PASS: filters, search, eight direction buttons, wraparound, animation, pause and native PNG download')
 mobile=browser.new_page(viewport={'width':375,'height':844},is_mobile=True,has_touch=True)
 mobile.on('pageerror',lambda e:errors.append(str(e)))
 mobile.goto(BASE+'directions.html');mobile.wait_for_function("document.querySelector('#status').textContent.startsWith('8방향')")
 for actor in ['m1','warden','m40']:
  mobile.locator('[data-actor="'+actor+'"]').click();mobile.wait_for_function("document.querySelector('#status').textContent.startsWith('8방향')")
  assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'),actor
  assert mobile.evaluate("[...document.querySelectorAll('.views canvas')].every(c=>Number.isInteger(parseFloat(c.style.width)/c.width))"),actor
 mobile.screenshot(path='/tmp/leaftale-eight-directions-mobile.png',full_page=True)
 print('PASS: mobile gallery fits and keeps whole-number pixel scaling for 64/96/128px')
 # Use a genuinely fresh context per route: reloading the running game invokes
 # its save handler and would overwrite a seed written before reload. Choose an
 # open patch so a compass floor click cannot select the nearby village NPC.
 page.goto(BASE);page.locator('#loading').wait_for(state='hidden')
 seed=page.evaluate("""async()=>{
  const{createPlayer}=await import('./core.js'),{NAVIGATION,NPC_POSITIONS,isWalkable}=await import('./world-layout.js'),{NPCS}=await import('./data.js'),{unproject}=await import('./view-projection.js'),{clearSight}=await import('./combat.js');
  const nav=NAVIGATION.village,p=createPlayer(),npcs=NPCS.filter(n=>n.map==='village').map(n=>NPC_POSITIONS[n.id]||n);
  for(let r=3;r<nav.rows-3;r++)for(let c=3;c<nav.cols-3;c++){
   const start=nav.worldAt(c,r),goals=Array.from({length:8},(_,d)=>{const a=d*Math.PI/4,v=unproject(Math.sin(a)*48,-Math.cos(a)*48);return{x:start.x+v.x,y:start.y+v.y}});
   if(isWalkable('village',start.x,start.y)&&goals.every(g=>isWalkable('village',g.x,g.y)&&clearSight('village',start,g,isWalkable)&&npcs.every(n=>Math.hypot(n.x-g.x,n.y-g.y)>3)))return Object.assign(p,start);
  }throw Error('no unobstructed eight-heading floor patch');
 }""")
 for row in range(8):
  route=browser.new_page(viewport={'width':1440,'height':1000})
  route.on('pageerror',lambda e:errors.append(str(e)))
  route.add_init_script("localStorage.setItem('leaftale:save:v1',"+json.dumps(json.dumps(seed))+")")
  route.goto(BASE);route.locator('#loading').wait_for(state='hidden');route.locator('#continue-game').click();route.wait_for_timeout(120)
  box=route.locator('#world').bounding_box()
  angle=row*math.pi/4
  point=route.evaluate('()=>{const p=__leaftale.snapshot().player;return __leaftale.worldToScreen(p.x,p.y)}');route.mouse.click(box['x']+point['x']+math.sin(angle)*48,box['y']+point['y']-math.cos(angle)*48)
  route.wait_for_function('(row)=>__leaftale.snapshot().player.dir===row',arg=row,timeout=2500)
  route.close()
 print('PASS: eight real floor clicks face N/NE/E/SE/S/SW/W/NW')
 assert not errors,errors
 browser.close()
