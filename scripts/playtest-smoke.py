"""Actual window size and click-to-collect flow, including the in-flight frame."""
from playwright.sync_api import sync_playwright
import sys, math
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE);page.locator('#loading').wait_for(state='hidden')
 rect=page.locator('#game-shell').bounding_box();assert abs(rect['width']-1440)<2 and abs(rect['height']-900)<2,rect
 assert abs(rect['x'])<2 and abs(rect['y'])<2,rect
 assert page.evaluate('''()=>{const root=document.querySelector('#game-shell'),label=document.querySelector('.name-line strong');const before=getComputedStyle(label).fontSize;root.style.width='70vw';const after=getComputedStyle(label).fontSize;root.style.width='';return before===after;}''')
 page.evaluate('''async()=>{const{World,createPlayer,stats}=await import('./core.js');const{NAVIGATION}=await import('./world-layout.js');const p=createPlayer('mage');Object.assign(p,{level:30,map:'sprout',...NAVIGATION.sprout.spawn});p.hp=stats(p).maxHp;const w=new World(),q=w.addPlayer(p),m=w.map('sprout').mobs[0];p.x=m.x-.9;p.y=m.y;localStorage.setItem('leaftale:save:v1',JSON.stringify(p));}''')
 page.reload();page.locator('#loading').wait_for(state='hidden');page.locator('#continue-game').click();page.wait_for_timeout(100)
 assert page.evaluate('__leaftale.view().zoom')==1/1.2
 assert page.evaluate('__leaftale.snapshot().player.stats.speed')==16.5
 before=page.evaluate('__leaftale.snapshot().player.gold')
 page.keyboard.press('Tab');page.keyboard.press('1');page.wait_for_function('__leaftale.snapshot().drops.some(d=>d.kind==="currency")')
 assert page.evaluate('__leaftale.snapshot().player.gold')==before
 page.screenshot(path='/tmp/leaftale-playtest-ground.png')
 d=page.evaluate('__leaftale.snapshot().drops.find(d=>d.kind==="currency")');point=page.evaluate('d=>__leaftale.worldToScreen(d.x,d.y)',d);box=page.locator('#world').bounding_box()
 page.mouse.click(box['x']+point['x'],box['y']+point['y']-12)
 page.wait_for_function('id=>__leaftale.snapshot().drops.some(d=>d.id===id&&d.pickupEnds)',arg=d['id'])
 page.wait_for_timeout(140);assert page.evaluate('__leaftale.snapshot().player.gold')==before
 page.screenshot(path='/tmp/leaftale-playtest-flight.png')
 page.wait_for_function('(n)=>__leaftale.snapshot().player.gold===n',arg=before+d['count'])
 page.wait_for_function('document.querySelector("#loot-lines").textContent.includes("리프")')
 assert '+'+str(d['count']) in page.locator('#loot-lines').inner_text()
 page.wait_for_timeout(350);page.screenshot(path='/tmp/leaftale-playtest-receipt.png')
 # A real item click also changes inventory only after the animation completes.
 d=page.evaluate('__leaftale.snapshot().drops.find(d=>d.kind==="item")');old=page.evaluate('(id)=>__leaftale.snapshot().player.inventory[id]||0',d['item'])
 point=page.evaluate('d=>__leaftale.worldToScreen(d.x,d.y)',d);page.mouse.click(box['x']+point['x'],box['y']+point['y']-12)
 page.wait_for_function('(v)=>(__leaftale.snapshot().player.inventory[v.id]||0)===v.n',arg={'id':d['item'],'n':old+d['count']})
 page.wait_for_function('document.querySelectorAll("#loot-lines .loot-receipt").length>=2')
 page.keyboard.press('k');assert '리프' in page.locator('#panel-body').inner_text();assert '100%' in page.locator('#panel-body').inner_text()
 assert not errors,errors
 print('PASS: full-viewport game window, 20% wider world view and unchanged fonts, 5x speed, ground item/currency drops, real click flight and exactly-once awards with lower-right receipts')
 b.close()
