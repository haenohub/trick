"""Verify pixel sizes on actual canvas calls and the rebuilt illustrated bestiary."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE);page.locator('#loading').wait_for(state='hidden')
 calls=page.evaluate('''async()=>{const {Renderer,loadArt}=await import('./renderer.js');await loadArt();const calls=[];let cx=0,cy=0;const r=new Renderer(document.createElement('canvas'),document.createElement('canvas'));r.ctx={save(){},restore(){},translate(x,y){cx=x;cy=y;},scale(){},rotate(){},drawImage(image,sx,sy,sw,sh,dx,dy,dw,dh){calls.push({file:image.src,sw,sh,dw,dh,cx,cy});}};r.item('fiber',50,50,28);r.item('trophy40',50,50,34);r.fx(7,0,50,50,35,25);r.fx(2,0,50,50,115,70);r.fx(4,0,50,50,300,160);r.fx(3,0,0,0,300,42);for(const id of ['m1','m5','m40','warden','npc:guide'])r.sprite(id,50,50,'walk',4,1,0);return calls;}''')
 assert len(calls)>=10
 for call in calls:assert call['dw']==call['sw']*2 and call['dh']==call['sh']*2,call
 line=[call for call in calls if call['cy']==0]
 assert len(line)>1 and max(c['cx'] for c in line)-min(c['cx'] for c in line)+64==300
 print('PASS: monsters, player, NPC, items, trophies and effects all render one source pixel as two screen pixels, including old fractional requests')
 page.locator('#start-game').click();page.keyboard.press('k')
 for region in ['0','1']:
  page.locator('[data-filter="'+region+'"]').click()
  assert page.evaluate("[...document.querySelectorAll('.monster-preview')].every(c=>c.width===parseFloat(c.style.width)&&c.height===parseFloat(c.style.height)&&[64,96,128].includes(c.width))")
 page.screenshot(path='/tmp/leaftale-pastel-ingame-codex.png',full_page=True)
 page.set_viewport_size({'width':375,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.locator('details').first.locator('summary').click()
 assert page.locator('.drop-row .item-icon').first.evaluate('(e)=>e.getBoundingClientRect().width')==32
 page.set_viewport_size({'width':1440,'height':900})
 print('PASS: in-game codex uses consistent 2x monster sizes and uncropped 32px item icons on mobile')
 page.goto(BASE+'bestiary.html')
 page.wait_for_function("document.querySelectorAll('canvas[data-drop][data-loaded=true]').length===document.querySelectorAll('canvas[data-drop]').length&&document.querySelectorAll('canvas[data-drop]').length>0")
 assert page.locator('canvas[data-drop]').count()>=40
 assert page.evaluate("[...document.querySelectorAll('canvas[data-drop]')].every(c=>c.width===32&&c.getBoundingClientRect().width===32&&c.getContext('2d').imageSmoothingEnabled===false)")
 page.screenshot(path='/tmp/leaftale-pastel-bestiary.png',full_page=True)
 for width in [320,375,768]:
  page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(100)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 print('PASS: bestiary uses the repainted portraits and native 2x item icons, with no mobile overflow')
 assert not errors,errors
 b.close()
