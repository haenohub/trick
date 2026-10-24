"""Exercise new tactics, warnings, sounds and treasure through real browser UI."""
from playwright.sync_api import sync_playwright
import sys,math
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
 def ready():
  page.goto(BASE);page.locator('#loading').wait_for(state='hidden')
 def fixture(cls='warden',mode='chest'):
  if page.locator('#hud').is_visible():
   page.keyboard.press('Escape');page.locator('[data-panel=settings]').click();page.locator('[data-special=title]').click()
  page.evaluate('''async ({cls,mode})=>{
    const{createPlayer,stats,World}=await import('./core.js');const{NAVIGATION}=await import('./world-layout.js');
    const p=createPlayer(cls);p.level=30;p.defeatedBosses=['m20'];p.map=mode==='boss'?'stump':mode==='tideboss'?'seacave':'sprout';
    if(mode==='chest'){const end=NAVIGATION.sprout.secretPassage.finish;p.x=end.x-3.2;p.y=end.y-3.2;}
    else if(mode==='boss'||mode==='tideboss'){Object.assign(p,NAVIGATION[p.map].boss);p.x+=4;}
    else {const w=new World(),q=w.addPlayer({...p,...NAVIGATION.sprout.spawn}),m=w.map('sprout').mobs[0];p.x=m.x-.9;p.y=m.y;}
    p.hp=stats(p).maxHp;localStorage.setItem('leaftale:save:v1',JSON.stringify(p));
  }''',{'cls':cls,'mode':mode})
  page.reload();page.locator('#loading').wait_for(state='hidden');page.locator('#continue-game').click();page.wait_for_timeout(100)
 ready();fixture()
 assert page.evaluate('__leaftale.snapshot().chests.length')==0
 end=page.evaluate("async()=>{const{NAVIGATION}=await import('./world-layout.js');return NAVIGATION.sprout.secretPassage.finish}")
 point=page.evaluate('p=>__leaftale.worldToScreen(p.x,p.y)',end);box=page.locator('#world').bounding_box();page.mouse.click(box['x']+point['x'],box['y']+point['y'])
 page.wait_for_function('p=>Math.hypot(__leaftale.snapshot().player.x-p.x,__leaftale.snapshot().player.y-p.y)<.2',arg=end)
 page.wait_for_function('__leaftale.snapshot().chests.length===1');page.wait_for_timeout(650)
 chest=page.evaluate('__leaftale.snapshot().chests[0]')
 page.screenshot(path='/tmp/leaftale-hidden-alcove.png')
 point=page.evaluate('p=>__leaftale.worldToScreen(p.x,p.y)',chest)
 page.mouse.click(box['x']+point['x'],box['y']+point['y']-10)
 page.wait_for_function('id=>__leaftale.snapshot().player.exploration.opened.includes(id)',arg=chest['id'])
 assert page.evaluate('__leaftale.snapshot().drops.filter(d=>d.treasure).length')==4
 before=page.evaluate('__leaftale.snapshot().player.gold');money=page.evaluate('__leaftale.snapshot().drops.find(d=>d.treasure&&d.kind==="currency")')
 point=page.evaluate('p=>__leaftale.worldToScreen(p.x,p.y)',money);page.mouse.click(box['x']+point['x'],box['y']+point['y']-12)
 page.wait_for_function('gold=>__leaftale.snapshot().player.gold===gold',arg=before+money['count'])
 page.keyboard.press('m');assert '발견한 숲길' in page.locator('#panel-body').inner_text();assert '나비잠 씨앗터' in page.locator('#panel-body').inner_text()
 page.keyboard.press('Escape');page.locator('[data-panel=settings]').click();page.locator('[data-special=save]').click()
 page.reload();page.locator('#loading').wait_for(state='hidden');page.locator('#continue-game').click()
 assert page.evaluate('__leaftale.snapshot().drops.filter(d=>d.treasure).length')==3
 assert page.evaluate('__leaftale.snapshot().chests[0].opened')
 print('PASS: real floor-click discovery, visible chest click, ground treasure, coin flight, journal lore and exact uncollected rewards after reload')
 # A real mage attack grows the visible resource; no runtime state injection.
 fixture('mage','combat');page.keyboard.press('Tab');page.keyboard.press('1')
 page.wait_for_function('__leaftale.snapshot().player.spellCharge===1')
 page.wait_for_function('document.querySelector("#combat-trait").textContent.includes("1/3")')
 page.keyboard.press('c');assert '달씨앗 공명' in page.locator('#panel-body').inner_text();page.keyboard.press('Escape')
 fixture('warden','boss')
 page.wait_for_function('__leaftale.snapshot().mobs.some(m=>m.def==="m20"&&m.windup)')
 page.locator('#boss-banner').wait_for(state='visible');assert '1단계' in page.locator('#boss-name').inner_text()
 page.keyboard.press('Tab');page.wait_for_function('document.querySelector("#target-card").hidden')
 page.screenshot(path='/tmp/leaftale-root-guardian-warning.png')
 # Sound generation is explicitly unlocked by a real user gesture.
 fixture('warden','tideboss');page.wait_for_function('__leaftale.snapshot().mobs.some(m=>m.def==="m40"&&m.windup)')
 page.wait_for_function('document.querySelector("#boss-name").textContent.includes("푸른숨")');page.screenshot(path='/tmp/leaftale-tidal-guardian-warning.png')
 page.locator('#sound-toggle').click()
 assert page.locator('#sound-toggle').get_attribute('aria-label')=='소리 끄기'
 assert page.evaluate('''async()=>{const{CombatAudio}=await import('./audio.js');const audio=new CombatAudio();return ['warden','mage','ranger','herbalist','warning','slam','treasure'].every(cue=>audio.play(cue));}''')
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert page.evaluate('''()=>{const boss=document.querySelector('#boss-banner').getBoundingClientRect(),map=document.querySelector('.map-card').getBoundingClientRect(),player=document.querySelector('.player-card').getBoundingClientRect();return boss.top>=map.bottom&&player.right<=map.left;}''')
 page.screenshot(path='/tmp/leaftale-combat-mobile.png')
 assert not errors,errors
 print('PASS: live mage resource, tactics descriptions, boss windup/status, seven synthesized sound profiles and mobile layout without runtime errors')
 b.close()
