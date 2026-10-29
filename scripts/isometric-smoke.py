"""Real native-isometric scenes, direct diamond drawing, map selection and cache bounds."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':900});errors=[];requests=[]
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url))
 p.goto(BASE);p.locator('#loading').wait_for(state='hidden');p.locator('#start-game').click();p.wait_for_timeout(300)
 p.screenshot(path='/tmp/iso-village-in-game-final.png')
 assert len(set(u.split('?')[0] for u in requests if '/world/iso-' in u))<20,'all region textures downloaded at startup'
 ids=p.evaluate('''async()=>{
  const {Renderer,loadArt,prepareWorldArt,worldArtReady,prepareEquipmentArt}=await import('./renderer.js'),{World,createPlayer}=await import('./core.js'),{NAVIGATION}=await import('./world-layout.js'),{project}=await import('./view-projection.js');
  await loadArt();const {starterEquipment}=await import('./equipment-appearance.js');await prepareEquipmentArt('warden',starterEquipment('warden'));const canvas=document.createElement('canvas');canvas.id='iso-test';canvas.style.cssText='position:fixed;inset:0;width:1440px;height:900px;z-index:10000';document.body.append(canvas);
  const r=new Renderer(canvas,document.createElement('canvas')),draw=r.ctx.drawImage.bind(r.ctx),transform=r.ctx.transform.bind(r.ctx);let calls=[],transforms=0;
  r.ctx.drawImage=(image,...args)=>{if(image.src?.includes('/world/iso-'))calls.push({file:image.src,args,w:image.width,h:image.height});return draw(image,...args);};r.ctx.transform=(...a)=>{transforms++;return transform(...a);};
  window.isoCheck=async id=>{await prepareWorldArt(id);if(!worldArtReady(id))throw Error(id+' textures not ready');const nav=NAVIGATION[id],raw=createPlayer('warden');Object.assign(raw,{map:id,defeatedBosses:['m20'],...nav.spawn});const w=new World(),hero=w.addPlayer(raw,'local'),s=w.snapshot('local');calls=[];transforms=0;r.render(s,null,.016);
   if(transforms)throw Error(id+' terrain was transformed instead of drawing native diamonds');
   const floor=calls.filter(c=>c.file.includes('-floor.png')),props=calls.filter(c=>c.file.includes('-props.png'));if(!floor.length||!props.length)throw Error(id+' missing native terrain or upright landmarks');
   for(const c of floor){const[x,y,w,h]=c.args;if(w!==448||h!==224||x<0||y<0||x+w>c.w||y+h>c.h)throw Error(id+' wrong diamond crop');}
   for(const c of props){const[x,y,w,h]=c.args;if(w!==384||h!==384||x<0||y<0||x+w>c.w||y+h>c.h)throw Error(id+' wrong scenery crop');}
   const q=r.worldToScreen(hero.x,hero.y);if(Math.abs(q.x-720)>.01||Math.abs(q.y-450-24*r.zoom)>.01)throw Error(id+' hero not centered');return{floor:floor.length,props:props.length};
  };
  return Object.keys(NAVIGATION);
 }''')
 for id in ids:
  result=p.evaluate('(id)=>isoCheck(id)',id);assert result['floor']>0 and result['props']>0
  p.locator('#iso-test').screenshot(path='/tmp/isometric-'+id+'.png')
 assert not errors,errors
 print('PASS: all ten real scenes use native 2:1 diamond crops without affine terrain transforms, region-specific upright scenery and centered actors; world assets load by region')
 p.goto(BASE+'maps.html');p.wait_for_function("document.querySelector('#status').textContent.startsWith('게임에서')")
 for id in ids:
  p.locator('[data-map='+id+']').click();p.wait_for_function("document.querySelector('#status').textContent.startsWith('게임에서')")
  assert p.locator('[data-map='+id+']').get_attribute('aria-pressed')=='true';assert p.locator('#features span').count()==3
 p.locator('#in').click();p.locator('#fit').click();p.screenshot(path='/tmp/isometric-map-atlas.png')
 p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(100);assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('PASS: map atlas selects all ten regions, zooms/resets and fits a mobile viewport')
 b.close()
