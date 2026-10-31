"""Actual crafting guide navigation, all forty icon recipes and in-game crafting."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 p=b.new_page(viewport={'width':1440,'height':1000},accept_downloads=True);p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE+'bestiary.html#crafting')
 assert p.locator('#result-count').inner_text()=='40종'
 data=p.evaluate("JSON.parse(document.querySelector('#bestiary-data').textContent)")
 expected={i['id'] for i in data['items'] if i.get('craftGuide')};seen=set()
 for page in range(1,6):
  if page>1:p.locator(f'#pagination [data-page="{page}"]').first.click()
  p.wait_for_function("[...document.querySelectorAll('canvas[data-drop]')].every(e=>e.dataset.loaded==='true')")
  rows=p.locator('.craft-card').evaluate_all('''cards=>cards.map(e=>({id:e.dataset.recipeId,nodes:[...e.querySelectorAll('.recipe-node')].map(n=>({id:n.dataset.itemLink,name:n.querySelector('.recipe-name').textContent,count:n.querySelector('.recipe-quantity').textContent,alpha:[...n.querySelector('canvas').getContext('2d').getImageData(0,0,n.querySelector('canvas').width,n.querySelector('canvas').height).data].filter((v,i)=>i%4===3&&v>0).length}))}))''')
  for row in rows:
   seen.add(row['id']);item=next(i for i in data['items'] if i['id']==row['id'])
   assert [n['id'] for n in row['nodes']]==list(item['recipe'])+[row['id']]
   assert all(n['alpha']>30 and n['name'] for n in row['nodes']),row
 assert seen==expected
 p.locator('#search').fill('도토리 속빵');card=p.locator('.craft-card')
 assert card.locator('.recipe-name').all_inner_texts()==['금 간 도토리투구','씨앗 고운가루','숲꽃 벌꿀','도토리 속빵']
 assert card.locator('.recipe-quantity').all_inner_texts()==['×1','×2','×1','×1 완성']
 p.locator('#search').blur();p.screenshot(path='/tmp/v26-craft-guide-desktop.png',full_page=True)
 card.locator('[data-item-link=trophy6]').click();assert p.locator('.item-guide-card').count()==1
 assert '도토리투구 다람쥐' in p.locator('.item-guide-card').inner_text()
 p.locator('[data-catalogue=crafting]').click();p.locator('#search').fill('도토리 속빵');p.locator('.craft-details > summary').click()
 p.locator('[data-monster-link=m6]').first.click();assert p.locator('.monster-card').get_attribute('data-id')=='m6'
 assert '60%' in p.locator('tr[data-item=trophy6]').inner_text()
 p.locator('[data-catalogue=crafting]').click();p.locator('#craft-source').select_option('only');assert p.locator('#result-count').inner_text()=='10종'
 p.locator('#craft-category').select_option('enhancement');assert int(p.locator('#result-count').inner_text()[:-1])<10
 p.locator('#reset').click();p.evaluate("dispatchEvent(new Event('beforeprint'))");assert p.locator('.craft-card').count()==40
 p.evaluate("dispatchEvent(new Event('afterprint'))");assert p.locator('.craft-card').count()==8
 with p.expect_download() as download:p.locator('#download').click()
 saved=Path('/tmp/leaftale-crafting-guide.html');download.value.save_as(saved)
 offline=b.new_context(offline=True);q=offline.new_page();q.on('pageerror',lambda e:errors.append(str(e)))
 url='http://127.0.0.1:8093/offline-crafting.html';q.route(url,lambda route:route.fulfill(body=saved.read_text(),content_type='text/html'))
 q.goto(url,wait_until='domcontentloaded');assert q.locator('#result-count').inner_text()=='40종'
 q.locator('#search').fill('별숨 용린비약');assert '제작 전용' in q.locator('.craft-card').inner_text();assert '뿌리해룡의 숨비늘' in q.locator('.craft-card').inner_text()
 offline.close()
 for width in [768,390,320]:
  p.set_viewport_size({'width':width,'height':844});p.locator('#search').fill('별숨 용린비약')
  assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  assert p.locator('.craft-card').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),width
  if width==390:p.screenshot(path='/tmp/v26-craft-guide-mobile.png',full_page=True)
 print('PASS: all forty icon equations and quantities, trophy/item navigation, ten craft-only filters, print, HTML export, offline text and 320/390/768px guide',flush=True)

 p.set_viewport_size({'width':1440,'height':900});p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
 p.evaluate('''async()=>{const{createPlayer}=await import('./core.js'),{ITEMS}=await import('./data.js');const raw=createPlayer();raw.level=30;raw.gold=10000;delete raw.allocated;delete raw.allocationVersion;for(const i of Object.values(ITEMS).filter(i=>i.craftGuide))for(const[id,n]of Object.entries(i.recipe))raw.inventory[id]=100;localStorage.setItem('leaftale:save:v1',JSON.stringify(raw));}''')
 p.reload();p.locator('#loading').wait_for(state='hidden')
 p.evaluate('''async()=>{const rev=document.querySelector('meta[name=leaftale-revision]').content,{World}=await import('./core.js?v='+rev),add=World.prototype.addPlayer;World.prototype.addPlayer=function(...args){const p=add.apply(this,args);window.craftWorld=this;return p;};}''')
 p.locator('#continue-game').click();p.keyboard.press('k');p.locator('[data-catalogue=crafting]').click()
 assert p.locator('.craft-guide-card').count()==40
 before=p.evaluate('__leaftale.snapshot().player.inventory');gold=p.evaluate('__leaftale.snapshot().player.gold')
 p.locator('[data-recipe-id=acornbread] [data-action=craft]').click()
 p.wait_for_function('(n)=>(__leaftale.snapshot().player.inventory.acornbread||0)===n+1',arg=before.get('acornbread',0))
 after=p.evaluate('__leaftale.snapshot().player.inventory')
 for id,n in next(i for i in data['items'] if i['id']=='acornbread')['recipe'].items():assert after[id]==before[id]-n
 assert p.evaluate('__leaftale.snapshot().player.gold')==gold-2
 p.locator('[data-recipe-id=acornbread] [data-guide-item=trophy6]').click();assert p.locator('[data-guide-entry=trophy6]').is_visible()
 p.locator('[data-catalogue=crafting]').click();p.keyboard.press('k');p.keyboard.press('k');assert p.locator('.craft-guide-card').count()==40
 p.locator('[data-filter=only]').click();assert p.locator('.craft-guide-card').count()==10
 p.locator('[data-recipe-id=starbreath] [data-action=craft]').click();p.wait_for_function('(__leaftale.snapshot().player.inventory.starbreath||0)>0')
 p.screenshot(path='/tmp/v26-craft-game.png')
 for width in [390,320]:
  p.set_viewport_size({'width':width,'height':844});assert p.locator('#panel-body').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),width
 p.set_viewport_size({'width':1440,'height':900});p.keyboard.press('k');p.keyboard.press('i')
 p.locator('[data-inventory-item=starbreath]').click();p.locator('#item-tooltip [data-action=potion]').click()
 p.wait_for_function('__leaftale.snapshot().player.consumableBuffs.some(b=>b.item==="starbreath")')
 p.keyboard.press('i')
 p.evaluate('''async()=>{const{NPCS}=await import('./data.js'),p=craftWorld.players.get('local'),n=NPCS.find(n=>n.map===p.map);Object.assign(p,{x:n.x+.5,y:n.y+.5});}''')
 p.wait_for_timeout(100);p.keyboard.press('f');assert p.locator('#menu-panel').get_attribute('data-panel').startswith('npc:')
 assert p.locator('[data-action=buy]').count()==34
 for item in [i for i in data['items'] if i.get('craftOnly')]:assert p.locator(f'[data-action=buy][data-item={item["id"]}]').count()==0
 assert not errors,errors
 print('PASS: in-game forty-recipe tab, real trophy consumption and result, exact fee, ingredient focus, reopen, 320px panel, actual ultimate-potion use and shop exclusion of all ten craft-only items',flush=True)
 b.close()
