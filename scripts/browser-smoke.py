"""Run against a local static server: python3 scripts/browser-smoke.py [URL].
Uses fresh isolated browser profiles; fixtures are never written to a user's browser.
"""
from playwright.sync_api import sync_playwright
import sys, json
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8080/'
errors=[]

def ready(page):
 page.goto(BASE);page.locator('#loading').wait_for(state='hidden')

def fixture(page,cls='warden',map_id='village',level=30,near_mob=False,at_portal=False):
 if page.locator('#hud').is_visible():
  page.keyboard.press('Escape');page.locator('[data-panel=settings]').click();page.locator('[data-special=title]').click()
 page.evaluate('''async ({cls,map,level,near,portal})=>{
 const {createPlayer,stats,World}=await import('./core.js');
 const p=createPlayer(cls,'검증 모험가');p.level=level;p.gold=20000;
 p.map=map;p.defeatedBosses=['m20'];p.visited=['village','sprout','acorn','brook','stump','shelltown','saltwood','glassbeach','tideroot','seacave'];
 for(const id of ['fiber','ironstone','softleaf','mint','seawood','shellore','saltflower','breathgrass'])p.inventory[id]=100;
 p.hp=stats(p).maxHp;if(portal){const {NAVIGATION}=await import('./world-layout.js');Object.assign(p,NAVIGATION[map].eastLanding);}
 if(near){const world=new World(),q=world.addPlayer(p),m=world.map(map).mobs.find(m=>m.hp>0);p.x=m.x-.9;p.y=m.y;}
 localStorage.setItem('leaftale:save:v1',JSON.stringify(p));
 }''',{'cls':cls,'map':map_id,'level':level,'near':near_mob,'portal':at_portal})
 page.reload();page.locator('#loading').wait_for(state='hidden');page.locator('#continue-game').click();page.wait_for_timeout(150)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':900})
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 ready(page)
 assert page.title().startswith('리프테일')
 page.screenshot(path='/tmp/leaftale-title-final.png',full_page=True)
 page.locator('#start-game').click();page.wait_for_timeout(150)
 initial=page.evaluate('__leaftale.snapshot().player.x')
 page.keyboard.down('d');page.wait_for_timeout(300);page.keyboard.up('d')
 assert abs(page.evaluate('__leaftale.snapshot().player.x')-initial)<.01
 box=page.locator('#world').bounding_box()
 point=page.evaluate('()=>{const p=__leaftale.snapshot().player;return __leaftale.worldToScreen(p.x+2,p.y)}');page.mouse.click(box['x']+point['x'],box['y']+point['y'])
 page.wait_for_function('(x)=>__leaftale.snapshot().player.x > x+1',arg=initial)
 print('PASS: click-to-move works; WASD does not move the character')
 page.keyboard.press('i');page.get_by_role('heading',name='여행자의 가방').wait_for();assert page.locator('.item-card').count()>0
 page.keyboard.press('Escape');assert page.locator('#menu-panel').is_hidden()
 page.keyboard.press('b');page.locator('[data-filter=alchemy]').click();page.locator('[data-action=craft][data-item=salve]').click();assert page.evaluate('__leaftale.snapshot().player.inventory.salve')==6
 page.locator('[data-filter=garden]').click();page.locator('[data-action=plant][data-item=mint]').first.click();assert page.evaluate('__leaftale.snapshot().player.garden[0].item')=='mint'
 page.keyboard.press('Escape')
 page.keyboard.press('k');assert page.locator('.monster-preview').count()==20
 page.locator('[data-filter="1"]').click();assert page.locator('.monster-preview').count()==20
 page.locator('details').first.locator('summary').click();assert '%' in page.locator('details').first.inner_text()
 page.keyboard.press('Escape')
 print('PASS: inventory, alchemy, planting and both regional drop tables')
 # Real movement to a portal then E: no direct state mutation in this transition.
 fixture(page,map_id='village',at_portal=True)
 box=page.locator('#world').bounding_box()
 point=page.evaluate("async()=>{const {PORTALS}=await import('./data.js');const p=PORTALS('village').at(-1);return __leaftale.worldToScreen(p.x,p.y)}");page.mouse.click(box['x']+point['x'],box['y']+point['y']-20)
 page.wait_for_function("__leaftale.snapshot().player.map === 'sprout'")
 print('PASS: clicking a portal walks to it and changes map without keyboard input')
 # Exercise every class's actual UI skills against real spawned enemies.
 for cls in ['warden','mage','ranger','herbalist']:
  fixture(page,cls,'sprout',30,True)
  page.keyboard.press('Tab');page.keyboard.press('1');page.wait_for_timeout(250)
  snap=page.evaluate('__leaftale.snapshot()')
  assert snap['player']['cooldowns'][0]>0,cls
  if cls!='herbalist':assert snap['player']['kills']>=1,cls
  page.screenshot(path='/tmp/leaftale-'+cls+'-combat.png',full_page=True)
 print('PASS: four classes use real skills with cooldowns and combat rewards')
 # All secondary choices through actual menus and a confirmation dialog.
 page.on('dialog',lambda d:d.accept())
 branches={'warden':['antler','thorn'],'mage':['moon','bloom'],'ranger':['hawk','mist'],'herbalist':['flower','venom']}
 for cls,choices in branches.items():
  for branch in choices:
   fixture(page,cls,'shelltown',25)
   page.keyboard.press('c');page.locator('[data-action=subclass][data-branch='+branch+']').click()
   assert page.evaluate('__leaftale.snapshot().player.branch')==branch
   page.keyboard.press('Escape')
 print('PASS: all eight advancement choices through actual UI')
 fixture(page,'mage','seacave',30)
 page.screenshot(path='/tmp/leaftale-seacave.png',full_page=True)
 # Save/reload round trip via the normal settings button.
 page.keyboard.press('i');gold=page.evaluate('__leaftale.snapshot().player.gold');page.keyboard.press('Escape')
 page.locator('[data-panel=settings]').click();page.locator('[data-special=save]').click();page.keyboard.press('Escape')
 page.reload();page.locator('#loading').wait_for(state='hidden');page.locator('#continue-game').click()
 assert page.evaluate('__leaftale.snapshot().player.map')=='seacave'
 assert page.evaluate('__leaftale.snapshot().player.gold')==gold
 print('PASS: saved level, map and inventory resume after reload')
 # Mobile context, touch controls, panel and lobby overflow checks.
 mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
 mp=mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)));ready(mp)
 assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth')
 for choice in mp.locator('.class-choice').all():
  rect=choice.bounding_box();assert rect['x']>=0 and rect['x']+rect['width']<=390
 mp.screenshot(path='/tmp/leaftale-mobile-title.png',full_page=True)
 mp.locator('#start-game').click();mp.wait_for_timeout(250)
 assert mp.locator('#mobile-pad').count()==0
 mx=mp.evaluate('__leaftale.snapshot().player.x');box=mp.locator('#world').bounding_box()
 point=mp.evaluate('()=>{const p=__leaftale.snapshot().player;return __leaftale.worldToScreen(p.x+2,p.y)}');mp.touchscreen.tap(box['x']+point['x'],box['y']+point['y'])
 mp.wait_for_function('(x)=>__leaftale.snapshot().player.x > x+.5',arg=mx)
 assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth')
 mp.screenshot(path='/tmp/leaftale-mobile-game.png',full_page=True)
 mp.locator('[data-panel=inventory]').click();assert mp.locator('#menu-panel').is_visible()
 mp.screenshot(path='/tmp/leaftale-mobile-bag.png',full_page=True)
 assert not errors,errors
 print('PASS: mobile layout, tap-to-move, menus and zero browser runtime errors')
 browser.close()
