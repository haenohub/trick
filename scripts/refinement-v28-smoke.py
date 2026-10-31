"""Item details, eight real skill inputs, repeatable field advancement and worn weapon rendering."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 p=b.new_page(viewport={'width':1440,'height':1000});p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE+'bestiary.html#items');assert p.locator('#result-count').inner_text()=='204종'
 assert p.locator('.item-details[open]').count()==0
 assert p.locator('.item-guide-heading canvas').evaluate_all('es=>es.every(e=>e.width===64&&e.height===64&&e.getBoundingClientRect().width===64)')
 assert not p.locator('.item-metrics').first.is_visible()
 p.locator('#search').fill('붉은수피 강장제');assert p.locator('.item-guide-card .lore').is_visible()
 assert not p.locator('.item-details .craft-details-body').is_visible()
 p.locator('.item-details > summary').focus();p.locator('.item-details > summary').press('Enter')
 assert '90초 동안 공격력 +20%' in p.locator('.item-guide-card').inner_text()
 p.screenshot(path='/tmp/v28-item-guide-details.png',full_page=True)
 p.locator('.item-details > summary').press('Space');assert not p.locator('.item-metrics').is_visible()
 for width in [768,390,320]:
  p.set_viewport_size({'width':width,'height':844});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  p.locator('.item-details > summary').click();assert p.locator('.item-metrics').is_visible();p.locator('.item-details > summary').click()
 print('PASS: 204-item guide, 64px item previews, name/lore visible with everything else collapsed, Enter/Space and 320px layout',flush=True)
 p.close()

 for cls,branches in [('warden',['antler','thorn']),('mage',['moon','bloom']),('ranger',['hawk','mist']),('herbalist',['flower','venom'])]:
  p=b.new_page(viewport={'width':1440,'height':900});p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
  p.evaluate('''async cls=>{const{createPlayer}=await import('./core.js'),q=createPlayer(cls);q.level=30;q.map='sprout';delete q.allocated;delete q.allocationVersion;q.inventory.barktonic=2;localStorage.setItem('leaftale:save:v1',JSON.stringify(q));}''',cls)
  p.reload();p.locator('#loading').wait_for(state='hidden')
  p.evaluate('''async()=>{const rev=document.querySelector('meta[name=leaftale-revision]').content,{World}=await import('./core.js?v='+rev),{NAVIGATION}=await import('./world-layout.js?v='+rev),{facingVector}=await import('./directions.js?v='+rev),add=World.prototype.addPlayer;
   World.prototype.addPlayer=function(...args){const p=add.apply(this,args);window.testWorld=this;this.rng=()=>.5;const nav=NAVIGATION.sprout,v=facingVector(2);let found=false;for(let r=2;r<nav.rows-2&&!found;r++)for(let c=2;c<nav.cols-2;c++){const a=nav.worldAt(c,r),end={x:a.x+v.x*9,y:a.y+v.y*9};if(this.sight(p.map,a,end)){Object.assign(p,a);found=true;break;}}if(!found)throw Error('no lane');for(const m of this.map(p.map).mobs){m.hp=0;m.respawn=Infinity;}const m=this.map(p.map).mobs[0];Object.assign(m,{x:p.x+v.x*2,y:p.y+v.y*2,homeX:p.x+v.x*2,homeY:p.y+v.y*2,hp:1e7,maxHp:1e7});return p;};World.prototype.updateMob=function(){};
   window.skillDraws=[];window.weaponDraws=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...a){if(im.src?.includes('/skills/expanded-'))skillDraws.push({file:im.src,width:im.width,height:im.height,a});if(im.src?.includes('/appearance/tier-'))weaponDraws.push({file:im.src,a});return draw.call(this,im,...a);};
  }''')
  p.locator('#continue-game').click();assert p.evaluate('__leaftale.version')=='0.29.0'
  assert p.locator('#skillbar [data-slot]').count()==6
  assert p.locator('#skillbar [data-slot] kbd').all_inner_texts()==['Q','W','E','R','D','G']
  goal=p.evaluate('''()=>{const m=__leaftale.snapshot().mobs.find(m=>m.hp>0);return __leaftale.worldToScreen(m.x,m.y);}''')
  p.keyboard.press('d');p.mouse.click(goal['x'],goal['y'])
  p.wait_for_function('__leaftale.snapshot().player.cooldowns[4]>0')
  p.wait_for_function('__leaftale.snapshot().mobs.some(m=>m.hp>0&&m.hp<1e7)')
  p.wait_for_function('(cls)=>skillDraws.some(d=>d.file.includes("expanded-"+cls)&&d.a[1]===0)',arg=cls)
  p.screenshot(path='/tmp/v28-'+cls+'-D.png');p.wait_for_timeout(1250)
  p.keyboard.press('a');p.mouse.click(30,700);p.wait_for_timeout(150)
  before=p.evaluate('__leaftale.snapshot().player')
  goal=p.evaluate('''async()=>{const{facingVector}=await import('./directions.js'),p=__leaftale.snapshot().player,v=facingVector(2),x=p.x+v.x*3,y=p.y+v.y*3,q=__leaftale.worldToScreen(x,y);return{x,y,sx:q.x,sy:q.y};}''')
  if cls=='herbalist':p.evaluate("()=>{const p=testWorld.players.get('local');p.poisonUntil=testWorld.time+20;}")
  p.keyboard.press('g');p.mouse.click(goal['sx'],goal['sy'])
  p.wait_for_function('__leaftale.snapshot().player.cooldowns[5]>0')
  p.wait_for_function('(cls)=>skillDraws.some(d=>d.file.includes("expanded-"+cls)&&d.a[1]===128)',arg=cls)
  if cls!='warden':p.wait_for_function('(g)=>{const p=__leaftale.snapshot().player;return Math.hypot(p.x-g.x,p.y-g.y)<.05;}',arg=goal)
  if cls=='mage':assert p.evaluate('__leaftale.snapshot().player.shield')>0
  if cls=='ranger':assert p.evaluate('__leaftale.snapshot().player.featherRemaining')>0
  if cls=='herbalist':assert not p.evaluate('__leaftale.snapshot().player.poisoned')
  if cls=='warden':
   p.wait_for_function('__leaftale.snapshot().player.counterRemaining>0')
   assert p.evaluate('__leaftale.snapshot().player.counterCharges')==2
  p.screenshot(path='/tmp/v28-'+cls+'-G.png')
  assert p.evaluate('skillDraws.every(d=>{const[x,y,w,h]=d.a;return w===128&&h===128&&x%128===0&&y%128===0&&x>=0&&y>=0&&x+w<=d.width&&y+h<=d.height;})')
  p.keyboard.press('c');assert p.locator('.skill-row').count()==6
  p.evaluate("()=>{const p=testWorld.players.get('local');p.hp=30;p.focus=17;p.cooldowns[3]=testWorld.time+15;}")
  p.wait_for_timeout(100)
  p.locator(f'[data-action=subclass][data-branch={branches[0]}]').click();p.wait_for_function('(branch)=>__leaftale.snapshot().player.branch===branch',arg=branches[0])
  p.locator(f'[data-action=subclass][data-branch={branches[1]}]').click();p.wait_for_function('(branch)=>__leaftale.snapshot().player.branch===branch',arg=branches[1])
  state=p.evaluate('__leaftale.snapshot().player');assert state['map']=='sprout';assert state['hp']<state['stats']['maxHp'];assert state['focus']<30;assert state['cooldowns'][3]>10
  for width in [390,320]:
   p.set_viewport_size({'width':width,'height':844});assert p.locator('#panel-body').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),(cls,width)
  p.set_viewport_size({'width':1440,'height':900});p.keyboard.press('c');p.keyboard.press('k');p.locator('[data-catalogue=items]').click()
  assert p.locator('.item-details[open]').count()==0
  assert p.locator('.item-entry .item-heading .item-icon').evaluate_all('es=>es.every(e=>e.getBoundingClientRect().width===64)')
  assert p.evaluate('weaponDraws.some(d=>d.file.includes("tier-"))')
  if cls=='ranger':assert p.evaluate('weaponDraws.some(d=>d.file.includes("tier-bow-v28"))')
  print('PASS: '+cls+' real D/G inputs, bounded generated frames, mobility/defense, six skills, repeatable field profession changes and large folded in-game items',flush=True)
  p.close()
 assert not errors,errors;b.close()
