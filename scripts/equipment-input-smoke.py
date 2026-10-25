"""Quarter-view minimap, non-blocking item descriptions and held-key pickups."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':900});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE);p.locator('#loading').wait_for(state='hidden');p.locator('#start-game').click()
 result=p.evaluate('''async()=>{
  const {Renderer,loadArt}=await import('./renderer.js');const{fitProjected,project}=await import('./view-projection.js');const{NAVIGATION,imageToWorld}=await import('./world-layout.js');await loadArt();
  const map=document.createElement('canvas');map.width=174;map.height=116;
  const c=map.getContext('2d'),draw=c.drawImage.bind(c),calls=[];
  c.drawImage=(image,...args)=>{if(image instanceof HTMLImageElement&&image.src.includes('/items.png'))calls.push(args);draw(image,...args);};
  const r=new Renderer(document.createElement('canvas'),map),s=__leaftale.snapshot(),nav=NAVIGATION[s.player.map];r.size={width:1440,height:900};r.camera=project(s.player.x,s.player.y);r.drawMinimap(s);
  const f=fitProjected([[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>imageToWorld(u,v,nav.id)),174,116),q=f.point(s.player.x,s.player.y),last=calls.at(-1);
  if(Math.hypot(last[4]+last[6]/2-q.x,last[5]+last[7]/2-q.y)>1e-7)throw Error('player marker differs from quarter-view map');
  for(const[x,y]of[[0,0],[173,0],[0,115],[173,115]]){const color=[...c.getImageData(x,y,1,1).data];if(color.join(',')!=='30,61,53,255')throw Error('minimap is still a filled top-down rectangle');}
  return {markers:calls.length,files:r.minimapCache.size};
 }''')
 assert result['markers']>=5 and result['files']==1,result
 p.screenshot(path='/tmp/leaftale-equipment-quarter-minimap.png')
 print('PASS: minimap ground, viewport and player/NPC markers share the game quarter-view projection')
 for width in [1440,960,390,320]:
  p.set_viewport_size({'width':width,'height':844});p.keyboard.press('i');p.wait_for_timeout(50)
  for index in range(1,5):
   p.locator('.inventory-slot').first.hover()
   target=p.locator('.inventory-slot').nth(index);key=target.get_attribute('data-inventory-item');box=target.bounding_box()
   point={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}
   p.evaluate('''q=>{const t=document.querySelector('#item-tooltip');t.style.left=Math.max(0,q.x-120)+'px';t.style.top=Math.max(0,q.y-100)+'px';}''',point)
   hit=p.evaluate('q=>document.elementFromPoint(q.x,q.y)?.closest("[data-inventory-item]")?.dataset.inventoryItem',point)
   assert hit==key,(width,key,hit)
   p.mouse.move(point['x'],point['y']);p.wait_for_timeout(50)
   name=p.evaluate('async id=>(await import("./data.js")).ITEMS[id].name',key)
   assert name in p.locator('#item-tooltip h3').inner_text(),(width,key)
  p.keyboard.press('i')
 print('PASS: descriptions covering adjacent slots pass mouse input through and update to the underlying item at four viewport widths')
 p.set_viewport_size({'width':1440,'height':900});p.locator('[data-panel=settings]').click();p.locator('[data-special=title]').click()
 p.evaluate('''async()=>{const{World,createPlayer,stats}=await import('./core.js');const raw=createPlayer('warden');Object.assign(raw,{level:30,map:'sprout'});const w=new World(),q=w.addPlayer(raw),m=w.map('sprout').mobs[0];raw.x=m.x-.9;raw.y=m.y;raw.hp=stats(raw).maxHp;localStorage.setItem('leaftale:save:v1',JSON.stringify(raw));}''')
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click();p.keyboard.press('Tab');p.keyboard.press('a')
 p.wait_for_function('__leaftale.snapshot().drops.length>=3');p.wait_for_timeout(150)
 count=p.evaluate('__leaftale.snapshot().drops.length');p.keyboard.press('Space');p.wait_for_timeout(1100)
 assert p.evaluate('__leaftale.snapshot().drops.length')==count-1
 p.evaluate('''()=>{window.flightSamples=[];window.flightCapture=true;function sample(){const s=__leaftale.snapshot();flightSamples.push(s.drops.filter(d=>d.pickupEnds>s.time).length);if(flightCapture)requestAnimationFrame(sample);}requestAnimationFrame(sample);}''')
 p.keyboard.down('Space');p.wait_for_function('__leaftale.snapshot().drops.length===0');p.keyboard.up('Space')
 samples=p.evaluate('()=>{flightCapture=false;return flightSamples;}');assert max(samples)==1,samples
 print('PASS: tapping Space collects exactly one item; holding collects all nearby drops one flight at a time without OS key-repeat')
 # Make another pile through real combat, then interrupt a held pickup with UI.
 p.keyboard.press('Tab');p.keyboard.press('a');p.wait_for_function('__leaftale.snapshot().drops.length>=3')
 count=p.evaluate('__leaftale.snapshot().drops.length');p.keyboard.down('Space');p.keyboard.press('i');p.wait_for_timeout(1700)
 assert p.evaluate('__leaftale.snapshot().drops.length')==count-1
 p.keyboard.up('Space');p.keyboard.press('i')
 count=p.evaluate('__leaftale.snapshot().drops.length');p.keyboard.down('Space');p.evaluate('window.dispatchEvent(new Event("blur"))');p.wait_for_timeout(1700);p.keyboard.up('Space')
 assert p.evaluate('__leaftale.snapshot().drops.length')==count-1
 p.keyboard.press('p');p.locator('[data-rebind=pickup]').first.click();p.keyboard.press('v');p.keyboard.press('p')
 count=p.evaluate('__leaftale.snapshot().drops.length');p.keyboard.press('Space');p.wait_for_timeout(850);assert p.evaluate('__leaftale.snapshot().drops.length')==count
 p.keyboard.down('v');p.wait_for_function('__leaftale.snapshot().drops.length===0');p.keyboard.up('v')
 assert not errors,errors
 print('PASS: opening a menu, window blur and key release stop repetition; remapped held V works and old Space no longer picks up')
 b.close()
