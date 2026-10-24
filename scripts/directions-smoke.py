"""Check all directional artwork and real compass-facing mouse movement."""
from playwright.sync_api import sync_playwright
import sys, math
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
 print('PASS: mobile gallery fits and keeps whole-number pixel scaling for 32/48/64px')
 # Recreate a fresh save for each route, then use only actual floor clicks.
 page.goto(BASE);page.locator('#loading').wait_for(state='hidden')
 for row in range(8):
  page.evaluate("""async()=>{const {createPlayer}=await import('./core.js');const p=createPlayer();const {NAVIGATION}=await import('./world-layout.js');Object.assign(p,NAVIGATION.village.worldAt(7,7));localStorage.setItem('leaftale:save:v1',JSON.stringify(p));}""")
  page.reload();page.locator('#loading').wait_for(state='hidden');page.locator('#continue-game').click();page.wait_for_timeout(120)
  box=page.locator('#world').bounding_box()
  angle=row*math.pi/4
  point=page.evaluate('()=>{const p=__leaftale.snapshot().player;return __leaftale.worldToScreen(p.x,p.y)}');page.mouse.click(box['x']+point['x']+math.sin(angle)*48,box['y']+point['y']-math.cos(angle)*48)
  page.wait_for_function('(row)=>__leaftale.snapshot().player.dir===row',arg=row,timeout=2500)
 print('PASS: eight real floor clicks face N/NE/E/SE/S/SW/W/NW')
 assert not errors,errors
 browser.close()
