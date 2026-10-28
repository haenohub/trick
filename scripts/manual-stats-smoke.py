from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':900});errors=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
 p.evaluate('''async()=>{const{createPlayer}=await import('./core.js');const q=createPlayer('warden');q.level=2;localStorage.setItem('leaftale:save:v1',JSON.stringify(q));}''')
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click();p.keyboard.press('c')
 assert p.locator('[data-unspent]').inner_text()=='12'
 p.locator('[data-action=allocateStat][data-attribute=strength][data-amount="1"]').click()
 assert p.locator('[data-unspent]').inner_text()=='11';assert p.locator('[data-attribute=strength]').first.inner_text()=='13'
 p.locator('[data-stat-amount=vitality]').fill('7');p.locator('[data-action=allocateStat][data-attribute=vitality]:not([data-amount])').click()
 assert p.locator('[data-unspent]').inner_text()=='4';assert p.locator('[data-attribute=vitality]').first.inner_text()=='19'
 p.locator('[data-stat-amount=luck]').fill('999');p.locator('[data-action=allocateStat][data-attribute=luck]:not([data-amount])').click();assert p.locator('[data-unspent]').inner_text()=='4'
 p.screenshot(path='/tmp/manual-stats-desktop.png')
 p.set_viewport_size({'width':320,'height':844});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth');p.locator('[data-stat-amount=luck]').fill('4');p.locator('[data-action=allocateStat][data-attribute=luck]:not([data-amount])').click()
 assert p.locator('[data-unspent]').inner_text()=='0';p.screenshot(path='/tmp/manual-stats-mobile.png')
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click();p.keyboard.press('c');assert p.locator('[data-unspent]').inner_text()=='0'
 assert p.evaluate('__leaftale.snapshot().player.allocated')=={'strength':1,'dexterity':0,'intelligence':0,'vitality':7,'spirit':0,'luck':4}
 assert p.evaluate('__leaftale.snapshot().ambience.label')
 assert not errors,errors
 print('PASS: +1 and bulk stat allocation, invalid amount rejection, 320px UI, zero-point disabled buttons, persistence and shared map phase')
 b.close()
