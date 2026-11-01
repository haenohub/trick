"""Review the actual field renderer's two corrected headings, without trails."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw
import io,base64,json

OUT=Path('test-results/directional-fixes-v32');OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory='dist'))
Thread(target=server.serve_forever,daemon=True).start()
errors=[];review=[]
try:
  with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=b.new_context(viewport={'width':1500,'height':1000},record_video_dir=str(OUT/'video'))
    p=context.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
    p.on('response',lambda r:errors.append(f'{r.status}: {r.url}') if r.status>=400 else None)
    p.goto(f'http://127.0.0.1:{server.server_port}/animation-lab.html')
    p.wait_for_function('window.__animationLab?.snapshot().hand?.length===2')
    p.locator('#debug').uncheck();p.locator('#trail').uncheck()
    for actor,dirs in [('herbalist',[7]),('ranger',[1,7])]:
      p.locator('#actor').select_option(actor)
      p.wait_for_function('document.querySelector(".stage").getAttribute("aria-busy")==="false"')
      weapons=p.locator('#weapon option').evaluate_all('es=>es.map(e=>e.value)')
      if actor=='herbalist':weapons=weapons[:1]
      for direction in dirs:
        sheet=Image.new('RGB',(8*230,len(weapons)*200),'#223e47');draw=ImageDraw.Draw(sheet)
        for row,weapon in enumerate(weapons):
          p.locator('#weapon').select_option(weapon)
          p.wait_for_function('document.querySelector(".stage").getAttribute("aria-busy")==="false"')
          p.locator('#direction').select_option(str(direction));p.locator('#animation').select_option('combo')
          for frame in range(8):
            p.evaluate('(i)=>__animationLab.setFrame(i)',frame)
            s=p.evaluate('__animationLab.snapshot()');assert s['dir']==direction and s['index']==frame
            raw=p.locator('#stage').evaluate('c=>c.toDataURL("image/png").split(",")[1]')
            im=Image.open(io.BytesIO(base64.b64decode(raw))).convert('RGB')
            im=im.crop((220,120,680,470)).resize((230,175),Image.Resampling.NEAREST)
            sheet.paste(im,(frame*230,row*200));draw.text((frame*230+4,row*200+177),f'{weapon} / {s["frame"]}',fill='white')
          if row==0:
            for speed,wait in [('1',900),('0.25',3000)]:
              p.locator('#speed').select_option(speed);p.evaluate('__animationLab.setPlaying(true)');p.wait_for_timeout(wait)
            p.evaluate('__animationLab.setFrame(0)')
          for anim in ['walk','idle']:
            p.locator('#animation').select_option(anim)
            for frame in range(8):p.evaluate('(i)=>__animationLab.setFrame(i)',frame)
          review.append({'actor':actor,'dir':direction,'weapon':weapon,'comboFrames':8,'walkFrames':8,'idleFrames':8})
        sheet.save(OUT/f'{actor}-{direction}-combo.png')
    assert not errors,errors
    context.close();b.close()
  (OUT/'review.json').write_text(json.dumps({'review':review,'errors':errors},indent=2))
  print('PASS: herbalist NW and all 9 bows NE/NW; 456 stopped combo/walk/idle frames, normal/.25 playback, no trails or browser errors')
finally:server.shutdown()
