"""Real input: repeat attacks, skill approach/priority, and A + floor cancellation."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 for cls in ['warden','ranger','mage','herbalist']:
  context=b.new_context(viewport={'width':1440,'height':900});p=context.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
  p.evaluate('''async cls=>{
   const {createPlayer}=await import('./core.js'),{NAVIGATION}=await import('./world-layout.js');
   const raw=createPlayer(cls);Object.assign(raw,{map:'sprout',level:30,...NAVIGATION.sprout.worldAt(8,10)});
   delete raw.allocationVersion;delete raw.allocated;localStorage.setItem('leaftale:save:v1',JSON.stringify(raw));
  }''',cls)
  p.reload();p.locator('#loading').wait_for(state='hidden')
  p.evaluate('''async()=>{
   const rev=document.querySelector('meta[name=leaftale-revision]').content,{World}=await import('./core.js?v='+rev);
   const add=World.prototype.addPlayer;
   World.prototype.addPlayer=function(...args){const hero=add.apply(this,args);this.rng=()=>.5;
    const mobs=this.map(hero.map).mobs;for(const m of mobs){m.hp=0;m.respawn=Infinity;}
    Object.assign(mobs[0],{x:hero.x+1.3,y:hero.y-.3,homeX:hero.x+1.3,homeY:hero.y-.3,hp:1000000,maxHp:1000000,ai:'idle'});
    return hero;
   };World.prototype.updateMob=function(){};
  }''')
  p.locator('#continue-game').click();p.wait_for_timeout(150)
  target=p.evaluate('''()=>{const m=__leaftale.snapshot().mobs.find(m=>m.hp>0),q=__leaftale.worldToScreen(m.x,m.y);return{id:m.uid,x:q.x,y:q.y-30*__leaftale.view().zoom};}''')
  p.keyboard.press('a');p.mouse.click(target['x'],target['y'])
  p.wait_for_function('__leaftale.snapshot().player.combatTarget!==null')
  first=p.evaluate('__leaftale.snapshot().player.action.start')
  p.wait_for_function('(start)=>__leaftale.snapshot().player.action?.start>start+1.2',arg=first)
  assert p.evaluate('(id)=>__leaftale.snapshot().mobs.find(m=>m.uid===id).hp',target['id'])<1000000
  p.screenshot(path='/tmp/hunting-live-'+cls+'.png')
  if cls=='mage':
   # Choose an actual visible, reachable floor beyond the shared eight-unit range.
   goal=p.evaluate('''async()=>{const {NAVIGATION}=await import('./world-layout.js'),{findRoute,blocked}=await import('./core.js');
    const nav=NAVIGATION.sprout,s=__leaftale.snapshot(),hero=s.player;
    for(let r=3;r<nav.rows-3;r++)for(let c=3;c<nav.cols-3;c++){
     const a=nav.worldAt(c,r),d=Math.hypot(a.x-hero.x,a.y-hero.y),q=__leaftale.worldToScreen(a.x,a.y);
     if(d>13&&d<25&&q.x>260&&q.x<1200&&q.y>180&&q.y<735&&!blocked(hero.map,a.x,a.y)&&findRoute(hero.map,hero,a).length)return{...a,sx:q.x,sy:q.y};
    }throw Error('no distant visible floor');
   }''')
   p.keyboard.press('w');p.mouse.click(goal['sx'],goal['sy'])
   p.wait_for_function('__leaftale.snapshot().player.queuedSkill!==null')
   queued=p.evaluate('__leaftale.snapshot().player');point=queued['queuedSkill']['point']
   assert abs(point['x']-goal['x'])<.03 and abs(point['y']-goal['y'])<.03
   assert queued['cooldowns'][1]==0
   p.screenshot(path='/tmp/hunting-queued-ground.png')
   p.wait_for_function('__leaftale.snapshot().player.action?.kind==="skill"')
   spell=p.evaluate('__leaftale.snapshot().player');assert spell['cooldowns'][1]>0
   assert abs(spell['action']['aim']['x']-point['x'])<.001
   assert abs(spell['action']['aim']['y']-point['y'])<.001
   assert ((spell['x']-point['x'])**2+(spell['y']-point['y'])**2)**.5<=8.01
   p.wait_for_function('__leaftale.snapshot().effects.some(e=>e.kind==="magic")')
   effect=p.evaluate('__leaftale.snapshot().effects.find(e=>e.kind==="magic")');assert abs(effect['x']-point['x'])<.001 and abs(effect['y']-point['y'])<.001
   p.wait_for_function('__leaftale.snapshot().player.action?.kind==="basic"')
   assert p.evaluate('__leaftale.snapshot().player.combatTarget')==target['id']
  # Arming A alone keeps combat going. The floor click performs the cancellation.
  p.keyboard.press('a');assert p.evaluate('__leaftale.snapshot().player.combatTarget')==target['id']
  p.mouse.click(30,700);assert 'aiming' not in (p.locator('#world').get_attribute('class')or'')
  snapshot=p.evaluate('__leaftale.snapshot().player');assert snapshot['combatTarget'] is None and snapshot['action'] is None and snapshot['queuedSkill'] is None
  p.wait_for_timeout(4200 if cls=='herbalist' else 700) # Released flights and existing poison finish independently.
  hp=p.evaluate('(id)=>__leaftale.snapshot().mobs.find(m=>m.uid===id).hp',target['id']);p.wait_for_timeout(1200)
  assert p.evaluate('(id)=>__leaftale.snapshot().mobs.find(m=>m.uid===id).hp',target['id'])==hp
  assert p.evaluate('__leaftale.snapshot().player.action') is None
  print('PASS: '+cls+' repeats basics from one click; A alone preserves combat; A + floor cancels subsequent attacks',flush=True)
  context.close()
 assert not errors,errors
 print('PASS: mage ground skill moves into range, retains its selected center, pays at cast, preempts basics and resumes them; no runtime errors',flush=True)
 b.close()
