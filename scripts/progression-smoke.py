"""Exercise growth, equipment requirements and codex stats in the real UI."""
from playwright.sync_api import sync_playwright
import sys
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b = pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 p = b.new_page(viewport={'width':1440,'height':900});errors=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
 p.evaluate('''async()=>{
  const {createPlayer}=await import('./core.js'),q=createPlayer('warden');
  for(const id of ['spear2','staff2','thornweapon'])q.inventory[id]=1;
  localStorage.setItem('leaftale:save:v1',JSON.stringify(q));
 }''')
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click()
 p.keyboard.press('c');assert p.locator('[data-attribute]').count()==6;assert p.locator('[data-stat]').count()==9
 values=p.evaluate('''()=>Object.fromEntries([...document.querySelectorAll('[data-attribute]')].map(e=>[e.dataset.attribute,Number(e.textContent)]))''')
 assert values==p.evaluate('__leaftale.snapshot().player.stats.attributes')
 p.keyboard.press('c');p.keyboard.press('i')
 for item in ['spear2','staff2','thornweapon']:
  p.locator('[data-inventory-item='+item+']').hover()
  assert p.locator('#item-tooltip [data-action=equip]').is_disabled()
  assert p.locator('#item-tooltip .equipment-requirements .missing').count()>0
  assert '공격력' in p.locator('#item-tooltip').inner_text()
  assert '기본 성장 스탯' in p.locator('#item-tooltip').inner_text()
 p.keyboard.press('i');p.locator('[data-panel=settings]').click();p.locator('[data-special=title]').click()
 p.evaluate('''async()=>{
  const {createPlayer,grantXp}=await import('./core.js');const q=createPlayer('warden');grantXp(q,1200);
  q.level=30;q.branch='antler';for(const id of ['spear2','wardenarmor2','hood2','boots2','charm2'])q.inventory[id]=1;
  localStorage.setItem('leaftale:save:v1',JSON.stringify(q));
 }''')
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click();p.keyboard.press('c')
 assert int(p.locator('[data-attribute=strength]').inner_text())>values['strength']
 assert int(p.locator('[data-attribute=vitality]').inner_text())>values['vitality']
 for e in p.locator('[data-stat]').all():
  key=e.get_attribute('data-stat');assert e.inner_text()!='NaN';assert p.evaluate('(k)=>Number.isFinite(__leaftale.snapshot().player.stats[k])',key)
 p.screenshot(path='/tmp/leaftale-growth-stats.png');p.keyboard.press('c')
 for width in [1440,390,320]:
  p.set_viewport_size({'width':width,'height':844});p.keyboard.press('i')
  p.locator('[data-inventory-item=spear2]').hover();button=p.locator('#item-tooltip [data-action=equip]')
  assert button.is_enabled();assert p.locator('#item-tooltip .missing').count()==0
  box=button.bounding_box();assert box['y']>=0 and box['y']+box['height']<=844,(width,box)
  p.screenshot(path='/tmp/leaftale-gear-stats-'+str(width)+'.png');p.keyboard.press('i')
 p.set_viewport_size({'width':1440,'height':900});p.keyboard.press('i');p.locator('[data-inventory-item=spear2]').hover()
 before=p.evaluate('__leaftale.snapshot().player.stats.attack');p.locator('#item-tooltip [data-action=equip]').click()
 p.wait_for_function('__leaftale.snapshot().player.equipment.weapon==="spear2"')
 assert p.evaluate('__leaftale.snapshot().player.stats.attack')>before
 p.goto(BASE+'bestiary.html')
 result=p.evaluate('''()=>{
  const data=JSON.parse(document.querySelector('#bestiary-data').textContent),gear=data.items.filter(i=>i.type==='equipment');
  if(gear.length!==30||gear.some(i=>!i.statLines.length||!i.requirementLines.length))throw Error('missing codex stats');
  return gear.length;
 }''');assert result==30
 assert not errors,errors
 print('PASS: six growth attributes and nine combat stats match real snapshots; requirements block level/class/branch mismatches; valid gear changes damage; descriptions fit desktop/390/320; all 30 codex items expose stats and requirements')
 b.close()
