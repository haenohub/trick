from browser_combat import confirm_attack
"""Check the welcome screen, physical key bindings, icon bag and combined guide."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import sys,json
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':900},accept_downloads=True);p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
 for w,h in [(1440,900),(1366,768),(2044,768),(390,844),(360,640),(320,568),(844,390)]:
  p.set_viewport_size({'width':w,'height':h});p.wait_for_timeout(60)
  assert p.locator('#lobby').evaluate('e=>e.scrollHeight<=e.clientHeight+1'),(w,h)
  for selector in ['#class-select','#class-description','#adventurer-name','#start-game','.lobby-footer']:
   rect=p.locator(selector).bounding_box();assert rect['y']>=0 and rect['y']+rect['height']<=h+1,(w,h,selector,rect)
 p.screenshot(path='/tmp/leaftale-welcome-fitted.png')
 p.set_viewport_size({'width':1440,'height':900});p.locator('#start-game').click()
 for key in ['i','c','b','m','l','k','h','o','p']:
  p.keyboard.press(key);assert p.locator('#menu-panel').is_visible(),key
  p.keyboard.press(key);assert p.locator('#menu-panel').is_hidden(),key
 p.keyboard.press('i');assert p.locator('.inventory-grid .item-card').count()==0
 slots=p.locator('.inventory-slot');assert slots.count()>5
 positions=[slots.nth(i).bounding_box() for i in range(6)]
 assert all(abs(r['y']-positions[0]['y'])<1 for r in positions[:5]);assert positions[5]['y']>positions[0]['y']
 slots.first.hover();assert p.locator('#item-tooltip').is_visible();assert p.locator('#item-tooltip h3').inner_text()
 p.locator('[data-inventory-item=salve]').hover();p.locator('#item-tooltip [data-action=potion]').click()
 assert p.evaluate('__leaftale.snapshot().player.inventory.salve')==4
 p.keyboard.press('i');assert p.locator('#item-tooltip').is_hidden()
 print('PASS: seven viewport sizes fit the welcome page, nine panel hotkeys toggle, five-column icon bag and actionable hover details')
 p.keyboard.press('p');assert p.locator('.keycap').count()>60
 p.locator('[data-rebind=skill0]').first.click();p.keyboard.press('w');assert '사용 중' in p.locator('#binding-status').inner_text()
 p.keyboard.press('z');assert 'Z' in p.locator('#binding-status').inner_text();p.keyboard.press('p')
 assert p.locator('#skillbar [data-slot="0"] kbd').inner_text()=='Z'
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click()
 assert p.locator('#skillbar [data-slot="0"] kbd').inner_text()=='Z'
 p.keyboard.press('p');p.locator('[data-reset-bindings]').click();p.keyboard.press('p')
 assert p.locator('#skillbar [data-slot] kbd').all_inner_texts()==['Q','W','E','R']
 p.locator('[data-panel=settings]').click();p.locator('[data-special=title]').click()
 p.evaluate('''async()=>{const{World,createPlayer,stats}=await import('./core.js');const{NAVIGATION}=await import('./world-layout.js');const raw=createPlayer('mage');Object.assign(raw,{level:30,map:'sprout',...NAVIGATION.sprout.spawn});raw.hp=stats(raw).maxHp;const world=new World(),q=world.addPlayer(raw),m=world.map('sprout').mobs[0];raw.x=m.x-.9;raw.y=m.y;delete raw.allocationVersion;delete raw.allocated;localStorage.setItem('leaftale:save:v1',JSON.stringify(raw));}''')
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click();p.keyboard.press('Tab');confirm_attack(p,'q')
 p.wait_for_function('__leaftale.snapshot().drops.length>=4')
 count=p.evaluate('__leaftale.snapshot().drops.length');p.keyboard.press('Space')
 p.wait_for_function('__leaftale.snapshot().player.lootNotices.length===1');assert p.evaluate('__leaftale.snapshot().drops.length')==count-1
 # This checks separate taps; the independent rate tests cover the exact
 # 200ms boundary. A frame can award loot just before the key timer expires.
 p.wait_for_timeout(220);p.keyboard.press('Space');p.wait_for_function('__leaftale.snapshot().player.lootNotices.length===2')
 before=p.evaluate('__leaftale.snapshot().player.inventory.salve');p.keyboard.press('t');assert p.evaluate('__leaftale.snapshot().player.inventory.salve')==before-1
 p.keyboard.press('k');p.locator('[data-catalogue=items]').click();assert p.locator('.item-entry').count()==204;p.keyboard.press('k')
 print('PASS: keyboard-shaped settings, conflict rejection, persisted remapping, QWER labels, Q skill, one pickup per Space press, T potion and in-game item guide')
 p.goto(BASE+'bestiary.html');assert '리프테일 도감' in p.title()
 p.locator('[data-catalogue=items]').click();assert p.locator('#result-count').inner_text()=='204종'
 p.locator('#search').fill('소금꽃 해독제');assert p.locator('.item-guide-card').count()==1;assert '마을 상점' in p.locator('.item-guide-card').inner_text()
 p.locator('#search').fill('');p.locator('#item-type').select_option('equipment');p.locator('#item-class').select_option('mage')
 assert p.locator('.item-guide-card').count()>0
 p.locator('#reset').click();p.locator('#item-type').select_option('trophy');p.locator('#search').fill('콩잎')
 assert p.locator('.item-guide-card').count()==1;assert p.locator('.item-drop-chance').inner_text()=='60%'
 p.locator('#reset').click();p.evaluate("dispatchEvent(new Event('beforeprint'))");assert p.locator('.item-guide-card').count()==204;p.evaluate("dispatchEvent(new Event('afterprint'))")
 p.wait_for_function("document.querySelector('canvas[data-drop]').dataset.loaded==='true'")
 p.screenshot(path='/tmp/leaftale-combined-item-guide.png',full_page=True)
 with p.expect_download() as info:p.locator('#download').click()
 exported=Path('/tmp/leaftale-guide-items.html');info.value.save_as(exported)
 assert info.value.suggested_filename=='리프테일-도감.html'
 offline=b.new_context(offline=True);q=offline.new_page();q.on('pageerror',lambda e:errors.append(str(e)))
 url='http://127.0.0.1:8093/downloaded-guide.html';q.route(url,lambda route:route.fulfill(body=exported.read_text(),content_type='text/html'));q.goto(url+'#items')
 assert q.locator('#result-count').inner_text()=='204종';q.locator('#search').fill('소금꽃 해독제');assert q.locator('.item-guide-card').count()==1
 p.goto(BASE+'bestiary.html#items');p.set_viewport_size({'width':320,'height':844});p.wait_for_timeout(100)
 assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS: 204-item catalogue, class/type filters, live drop chances, 204-entry print, renamed HTML export, offline item lore and 320px layout')
 b.close()
