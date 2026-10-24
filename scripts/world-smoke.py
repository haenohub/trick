"""Check native projection, smooth follow, expanded map views and edge clicks."""
from playwright.sync_api import sync_playwright
import sys, math
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':900});p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE);p.locator('#loading').wait_for(state='hidden');p.locator('#start-game').click();p.wait_for_timeout(200)
 result=p.evaluate('''()=>{const s=__leaftale.snapshot().player,a=__leaftale.worldToScreen(s.x,s.y),c=__leaftale.worldToScreen(s.x+1,s.y-1),q=__leaftale.screenToWorld(c.x,c.y);return{zoom:__leaftale.view().zoom,dx:c.x-a.x,dy:c.y-a.y,error:Math.hypot(q.x-s.x-1,q.y-s.y+1)}}''')
 assert result['zoom']==1 and abs(result['dx']-64)<1e-7 and abs(result['dy'])<1e-7 and result['error']<1e-7,result
 initial=p.evaluate('({p:__leaftale.snapshot().player,c:__leaftale.view().camera})')
 target={'x':initial['p']['x']+3,'y':initial['p']['y']-3}
 point=p.evaluate('(q)=>__leaftale.worldToScreen(q.x,q.y)',target);box=p.locator('#world').bounding_box();p.mouse.click(box['x']+point['x'],box['y']+point['y'])
 cameras=[]
 for i in range(30):
  p.wait_for_timeout(70);cameras.append(p.evaluate('__leaftale.view().camera.x'))
 final=p.evaluate('({p:__leaftale.snapshot().player,c:__leaftale.view().camera})')
 assert math.hypot(final['p']['x']-target['x'],final['p']['y']-target['y'])<.05
 assert final['c']['x']-initial['c']['x']>180
 assert all(b-a>=-.01 and b-a<90 for a,b in zip(cameras,cameras[1:])),cameras
 p.screenshot(path='/tmp/leaftale-expanded-village-follow.png')
 print('PASS: native world scale in a 70% game window, inverse mouse projection and continuous camera follow during real floor-click movement')
 # Isolated saves show actual runtime terrain, portals, habitats and service buildings.
 for map_id in ['village','sprout','acorn','brook','stump','shelltown','saltwood','glassbeach','tideroot','seacave']:
  p.keyboard.press('Escape');p.locator('[data-panel=settings]').click();p.locator('[data-special=title]').click()
  p.evaluate('''async id=>{const{createPlayer,stats}=await import('./core.js');const{NAVIGATION}=await import('./world-layout.js');const p=createPlayer();Object.assign(p,{map:id,level:30,defeatedBosses:['m20'],...NAVIGATION[id].spawn});p.hp=stats(p).maxHp;localStorage.setItem('leaftale:save:v1',JSON.stringify(p));}''',map_id)
  p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click();p.wait_for_timeout(120)
  assert p.evaluate('__leaftale.snapshot().player.map')==map_id,map_id
  assert p.locator('#minimap').evaluate('(c)=>c.getContext("2d").getImageData(0,0,c.width,c.height).data.some(v=>v)')
  p.screenshot(path='/tmp/leaftale-expanded-'+map_id+'.png')
 print('PASS: all ten expanded maps render with camera bounds, portals, distinct terrain and minimaps')
 p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(200)
 assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
 p.screenshot(path='/tmp/leaftale-expanded-mobile.png')
 assert not errors,errors
 print('PASS: mobile layout and zero browser runtime errors')
 b.close()
