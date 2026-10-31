"""Collapsed recipe details and 204 genuine 64px item crops in the live UI."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 p=b.new_page(viewport={'width':1440,'height':1000});p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE+'bestiary.html#crafting')
 for page in range(1,6):
  if page>1:p.locator(f'#pagination [data-page="{page}"]').first.click()
  assert p.locator('.craft-details[open]').count()==0
  for card in p.locator('.craft-card').all():
   assert card.locator('.craft-flow').is_visible()
   assert not card.locator('.craft-effects').is_visible()
   summary=card.locator('.craft-details > summary');summary.focus();summary.press('Enter')
   assert card.locator('.craft-effects').is_visible()
   assert card.locator('.craft-sources').is_visible()
   assert summary.inner_text()=='상세정보 접기'
   summary.press('Space');assert not card.locator('.craft-effects').is_visible()
 p.locator('#search').fill('도토리 속빵')
 p.wait_for_function("[...document.querySelectorAll('canvas[data-drop]')].every(c=>c.dataset.loaded==='true')")
 assert p.locator('.recipe-node canvas').evaluate_all('cs=>cs.every(c=>c.width===64&&c.height===64&&c.getBoundingClientRect().width===64&&!c.getContext("2d").imageSmoothingEnabled)')
 p.screenshot(path='/tmp/v27-codex-compact.png',full_page=True)
 p.locator('.craft-details > summary').click();p.screenshot(path='/tmp/v27-codex-detailed.png',full_page=True)
 for width in [768,390,320]:
  p.set_viewport_size({'width':width,'height':844})
  assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  p.locator('.craft-details > summary').click();assert not p.locator('.craft-effects').is_visible()
  p.locator('.craft-details > summary').click();assert p.locator('.craft-effects').is_visible()
 print('PASS: all 40 recipes default to icons only; native details support Enter/Space, complete effects/sources, 64px canvas and 320px layout',flush=True)

 p.set_viewport_size({'width':1440,'height':900});p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
 crops=p.evaluate('''async()=>{const{Renderer,loadArt}=await import('./renderer.js'),{ITEMS}=await import('./data.js');await loadArt();const r=new Renderer(document.createElement('canvas'),document.createElement('canvas')),calls=[];r.dpr=1;r.ctx={save(){},restore(){},translate(){},scale(){},drawImage(im,...a){calls.push({file:im.src,w:im.width,h:im.height,a});}};for(const i of Object.values(ITEMS))r.item(i.id,100,100);return{calls,zoom:r.zoom};}''')
 assert len(crops['calls'])==204
 for c in crops['calls']:
  sx,sy,sw,sh,dx,dy,dw,dh=c['a'];assert sw==64 and sh==64,c
  assert sx%64==0 and sy%64==0 and sx+sw<=c['w'] and sy+sh<=c['h'],c
  assert abs(dw-32*crops['zoom'])<=1 and abs(dh-32*crops['zoom'])<=1,c
  assert '/icons-v27/' in c['file'],c
 p.evaluate('''async()=>{const{createPlayer}=await import('./core.js'),{ITEMS}=await import('./data.js');const raw=createPlayer();raw.level=30;delete raw.allocated;delete raw.allocationVersion;for(const id of Object.keys(ITEMS))raw.inventory[id]=3;localStorage.setItem('leaftale:save:v1',JSON.stringify(raw));}''')
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click();p.keyboard.press('k');p.locator('[data-catalogue=crafting]').click()
 assert p.locator('.craft-guide-card').count()==40
 assert p.locator('.craft-details[open]').count()==0
 first=p.locator('[data-recipe-id=acornbread]');assert not first.locator('.craft-details-body').is_visible()
 first.locator('.craft-details > summary').focus();first.locator('.craft-details > summary').press('Enter');assert first.locator('.craft-details-body').is_visible()
 assert first.locator('.recipe-node .item-icon').evaluate_all('''async es=>{const a=await(await fetch('./assets/manifest.json')).json();return es.every(e=>{const l=a.itemOverrides[e.closest('[data-guide-item]').dataset.guideItem];return e.getBoundingClientRect().width===64&&getComputedStyle(e).backgroundSize===`${l.cols*64}px ${l.rows*64}px`;});}''')
 p.screenshot(path='/tmp/v27-ingame-recipe.png')
 for width in [390,320]:
  p.set_viewport_size({'width':width,'height':844});assert p.locator('#panel-body').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),width
 p.set_viewport_size({'width':1440,'height':900});p.keyboard.press('k');p.keyboard.press('i')
 assert p.locator('[data-inventory-item]').count()==204
 assert p.locator('[data-inventory-item] .item-icon').evaluate_all('es=>es.every(e=>e.getBoundingClientRect().width===32&&getComputedStyle(e).backgroundImage.includes("icons-v27"))')
 assert len(p.locator('.inventory-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns.split(" ")'))==5
 p.screenshot(path='/tmp/v27-inventory-icons.png')
 assert not errors,errors
 print('PASS: all 204 real renderer crops are 64px with unchanged ground footprint; in-game details, 64px recipe icons, 32px five-column bag and 320px panel',flush=True)
 b.close()
