"""Exercise real packed clips in the renderer and all actors in the atelier."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':900});errors=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
 result=p.evaluate('''async()=>{
  const {Renderer,loadArt}=await import('./renderer.js');await loadArt();
  const art=await(await fetch('./assets/manifest.json')).json();
  const calls=[],r=new Renderer(document.createElement('canvas'),document.createElement('canvas'));r.dpr=1;
  r.ctx={save(){},restore(){},translate(){},scale(){},drawImage(image,sx,sy,sw,sh){calls.push({file:new URL(image.src).pathname,sx,sy,sw,sh,w:image.width,h:image.height});}};
  const actors=[...Object.entries(art.characterLayouts),...Object.entries(art.npcLayouts).map(([id,l])=>['npc:'+id,l]),...Object.entries(art.monsters)].filter(([id,l])=>l.clips?.walk && l.clips?.idle);
  for(const [name,l] of actors)for(const anim of ['walk','idle'])for(let dir=0;dir<8;dir++){
   const key=name+':'+anim;const before=calls.length;
   r.sprite(name,100,100,anim,dir,0,0,l.size,null,key);
   r.sprite(name,100,100,anim,dir,.25,0,l.size,null,key);
   r.sprite(name,100,100,anim,dir,.55,0,l.size,null,key);
   for(const c of calls.slice(before))if(!c.file.includes('/'+l.clips[anim].file+'.png')||c.sw!==l.size||c.sh!==l.size||c.sy!==dir*l.size||c.sx<0||c.sx>=l.size*8||c.w!==l.size*8||c.h!==l.size*8)throw Error(name+' '+anim+' '+dir+' wrong clip '+JSON.stringify(c));
  }
  return {actors:actors.length,calls:calls.length,files:new Set(calls.map(c=>c.file)).size};
 }''')
 assert result['actors']==72 and result['calls']==72*2*8*3 and result['files']==144,result
 p.goto(BASE+'directions.html');p.wait_for_function("document.querySelector('#status').textContent.startsWith('8방향')")
 actors=p.evaluate('DATA.actors.map(a=>({id:a.id,kind:a.kind,ready:!!a.layout.clips?.idle,clips:a.layout.clips}))')
 for actor in actors:
  p.evaluate('(id)=>choose(DATA.actors.find(a=>a.id===id))',actor['id'])
  p.wait_for_function("sheet !== null && document.querySelector('#status').textContent.startsWith('8방향')")
  for anim in ['idle','walk']:
   p.locator('#animation').select_option(anim);frames=[]
   for i in range(4):
    p.wait_for_timeout(200 if anim=='walk' else 100);frames.append(p.locator('#hero').evaluate('(c)=>c.toDataURL()'))
   assert len(set(frames))>=(3 if actor['ready'] or anim=='walk' else 1),(actor,anim)
   if actor['ready']:assert ('/'+actor['clips'][anim]['file']+'.png') in p.locator('#atlas-download').get_attribute('href')
   else:assert '준비 중' in p.locator('#status').inner_text()
 p.screenshot(path='/tmp/leaftale-locomotion-atelier.png')
 assert not errors,errors
 print('PASS: all 72 actors × 8 headings × walk/idle use 144 new atlases; 3456 draw calls in bounds; all atelier actors use finished motion')
 b.close()
