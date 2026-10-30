"""Real QWER inputs for all twenty authored skills, impacts, buffs and free map travel."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 for cls,branches in [('warden',['antler','thorn']),('mage',['moon','bloom']),('ranger',['hawk','mist']),('herbalist',['flower','venom'])]:
  for bi,branch in enumerate(branches):
   p=b.new_page(viewport={'width':1440,'height':900});p.on('pageerror',lambda e:errors.append(str(e)))
   p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
   p.evaluate('''async args=>{const{createPlayer}=await import('./core.js'),{NAVIGATION}=await import('./world-layout.js');const raw=createPlayer(args.cls);Object.assign(raw,{level:30,branch:args.branch,map:'sprout',...NAVIGATION.sprout.worldAt(8,10)});delete raw.allocated;delete raw.allocationVersion;raw.inventory.barktonic=2;localStorage.setItem('leaftale:save:v1',JSON.stringify(raw));}''',{'cls':cls,'branch':branch})
   p.reload();p.locator('#loading').wait_for(state='hidden')
   p.evaluate(r'''async()=>{const rev=document.querySelector('meta[name=leaftale-revision]').content,{World}=await import('./core.js?v='+rev),add=World.prototype.addPlayer;World.prototype.addPlayer=function(...args){const p=add.apply(this,args);this.rng=()=>.5;for(const m of this.map(p.map).mobs){m.hp=0;m.respawn=Infinity;}const m=this.map(p.map).mobs[0];Object.assign(m,{hp:1e7,maxHp:1e7,x:p.x+1.3,y:p.y-.3,homeX:p.x+1.3,homeY:p.y-.3});return p;};World.prototype.updateMob=function(){};window.vfxDraws=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(im.src?.match(/assets\/(skills\/|combat-impacts-v24)/))vfxDraws.push({file:im.src,width:im.width,height:im.height,args});return draw.call(this,im,...args);};}''')
   p.locator('#continue-game').click();p.wait_for_timeout(200)
   assert p.evaluate('__leaftale.version')=='0.24.0'
   for slot,key in ([(0,'q'),(1,'w'),(2,'e'),(3,'r')] if bi==0 else [(3,'r')]):
    goal=p.evaluate('''()=>{const m=__leaftale.snapshot().mobs.find(m=>m.hp>0),s=__leaftale.worldToScreen(m.x,m.y);return{x:s.x,y:s.y};}''')
    p.keyboard.press(key);p.mouse.click(goal['x'],goal['y'])
    name=branch if slot==3 else cls+'-'+str(slot)
    if cls=='ranger' and slot==1: check='e.kind==="arrow-rain"'
    elif cls=='warden' and slot==2:check='e.kind==="leaf-landing"'
    else:check='e.kind==="skill-vfx"&&e.key==='+repr(name)
    p.wait_for_function('__leaftale.snapshot().effects.some(e=>'+check+')')
    row=slot if slot<3 else 3+bi
    p.wait_for_function('(a)=>vfxDraws.some(d=>d.file.includes("skills/"+a.cls+".png")&&d.args[1]===a.row*128)',arg={'cls':cls,'row':row})
    p.wait_for_timeout(180)
    p.screenshot(path='/tmp/v24-skill-'+name+'.png')
    p.wait_for_function('!__leaftale.snapshot().player.action||__leaftale.snapshot().player.action.kind==="basic"')
   # One confirmed basic attack produces its class-specific impact sheet.
   goal=p.evaluate('''()=>{const m=__leaftale.snapshot().mobs.find(m=>m.hp>0),q=__leaftale.worldToScreen(m.x,m.y);return{x:q.x,y:q.y-25*__leaftale.view().zoom};}''')
   p.keyboard.press('a');p.mouse.click(goal['x'],goal['y'])
   p.wait_for_function('__leaftale.snapshot().effects.some(e=>e.kind==="attack-impact")')
   p.wait_for_function('vfxDraws.some(d=>d.file.includes("combat-impacts-v24"))')
   assert p.evaluate('vfxDraws.every(d=>{const[sx,sy,sw,sh]=d.args;return sx>=0&&sy>=0&&sx+sw<=d.width&&sy+sh<=d.height&&sw===128&&sh===128;})')
   p.keyboard.press('a');p.mouse.click(30,700)
   if cls=='warden' and bi==0:
    before=p.evaluate('__leaftale.snapshot().player.stats.attack')
    p.keyboard.press('i');p.locator('[data-inventory-item=barktonic]').hover();p.locator('#item-tooltip [data-action=potion]').click()
    assert p.evaluate('__leaftale.snapshot().player.stats.attack')>before
    assert p.locator('.active-consumable').count()==1
    p.keyboard.press('i');p.keyboard.press('m')
    assert p.locator('.map-row[data-fast=true]').count()==10
    p.locator('.map-row[data-map=seacave]').click();p.wait_for_function('__leaftale.snapshot().player.map==="seacave"')
    assert p.evaluate('__leaftale.snapshot().player.defeatedBosses')==[]
    p.keyboard.press('m');p.wait_for_function('async()=>{const rev=document.querySelector("meta[name=leaftale-revision]").content;return(await import("./renderer.js?v="+rev)).worldArtReady("seacave");}');p.wait_for_timeout(250);p.screenshot(path='/tmp/v24-free-seacave.png')
   print('PASS: '+cls+'/'+branch+' real skill inputs, dedicated generated rows, basic impact and bounded native crops',flush=True)
   p.close()
 p=b.new_page();p.goto(BASE+'bestiary.html');p.locator('#search').fill('콩잎폴짝');p.wait_for_timeout(250)
 chances=p.locator('.chance').all_inner_texts();assert '60%' in chances and '10%' in chances and '40%' in chances and '5%' in chances
 p.locator('[data-catalogue=items]').click();p.locator('#search').fill('');p.locator('#item-type').select_option('consumable')
 assert p.locator('#result-count').inner_text()=='24종'
 p.locator('#search').fill('붉은수피 강장제');assert '90초 동안 공격력 +20%' in p.locator('.item-guide-card').inner_text()
 assert not errors,errors
 print('PASS: free unvisited coast travel, consumable actual combat stats/HUD and 24-consumable codex with exact drop rates',flush=True)
 b.close()
