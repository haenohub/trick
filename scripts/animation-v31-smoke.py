"""Real renderer review: normal/quarter speed, stopped frames, gear and field.

Run after npm run build. With no URL, serves dist in this process so the browser
and HTTP server always share the same execution environment.
"""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from threading import Thread
import base64, io, json, sys
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

OUT=Path('test-results/animation-v31'); OUT.mkdir(parents=True,exist_ok=True)
server=None
if len(sys.argv)>1: BASE=sys.argv[1].rstrip('/')+'/'
else:
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self,*args): pass
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory='dist'))
    Thread(target=server.serve_forever,daemon=True).start()
    BASE=f'http://127.0.0.1:{server.server_port}/'
errors,failed,review=[],[],[]
try:
  with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=b.new_context(viewport={'width':1600,'height':1080},record_video_dir=str(OUT/'video'))
    p=context.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
    p.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
    p.goto(BASE+'animation-lab.html');p.wait_for_function('window.__animationLab?.snapshot().hand?.length===2')
    assert not p.locator('#trail').is_checked()
    p.evaluate('__animationLab.setFrame(2)');before=p.evaluate('__animationLab.snapshot()')
    p.wait_for_timeout(150);assert p.evaluate('__animationLab.snapshot().clock')==before['clock']
    p.locator('#next').click();assert p.evaluate('__animationLab.snapshot().index')==3
    p.locator('#prev').click();assert p.evaluate('__animationLab.snapshot().index')==2
    p.locator('#speed').select_option('0.25');p.evaluate('__animationLab.setPlaying(true)')
    before=p.evaluate('__animationLab.snapshot().clock');p.wait_for_timeout(600)
    elapsed=p.evaluate('__animationLab.snapshot().clock')-before
    assert .08<elapsed<.25,elapsed
    for cls in ['warden','ranger','mage','herbalist']:
      p.locator('#actor').select_option(cls)
      p.wait_for_function('(id)=>__animationLab.snapshot().actor===id&&document.querySelector(".stage").getAttribute("aria-busy")==="false"',arg=cls)
      # Every tier must decode its alternate pose atlas, not silently omit gear.
      weapons=p.locator('#weapon option').evaluate_all('es=>es.map(e=>e.value)')
      assert len(weapons)==9,(cls,weapons)
      for weapon in weapons:
        p.locator('#weapon').select_option(weapon)
        p.wait_for_function('document.querySelector(".stage").getAttribute("aria-busy")==="false"')
        p.evaluate('__animationLab.setFrame(4)')
        s=p.evaluate('__animationLab.snapshot()');assert s['hand'] and s['grip']
      p.locator('#weapon').select_option(weapons[0])
      p.wait_for_function('document.querySelector(".stage").getAttribute("aria-busy")==="false"')
      for anim in ['combo','walk']:
        p.locator('#animation').select_option(anim)
        sheet=Image.new('RGB',(216*8,258*8),'#223e47');draw=ImageDraw.Draw(sheet)
        for direction in range(8):
          p.locator('#direction').select_option(str(direction))
          for frame in range(8):
            p.evaluate('(i)=>__animationLab.setFrame(i)',frame)
            snapshot=p.evaluate('__animationLab.snapshot()')
            assert snapshot['index']==frame and snapshot['ground']==[48,92]
            raw=p.locator('#stage').evaluate('c=>c.toDataURL("image/png").split(",")[1]')
            im=Image.open(io.BytesIO(base64.b64decode(raw))).convert('RGB')
            im=im.crop((180,0,720,590)).resize((216,236),Image.Resampling.NEAREST)
            x,y=frame*216,direction*258;sheet.paste(im,(x,y))
            draw.text((x+4,y+237),f'{direction} / {snapshot["frame"]} / {snapshot["durationMs"]:.1f} ms',fill='#ffe7b6')
        sheet.save(OUT/f'{cls}-{anim}.png')
      p.locator('#direction').select_option('5');p.locator('#animation').select_option('combo')
      p.locator('#speed').select_option('1');p.evaluate('__animationLab.setPlaying(true)');p.wait_for_timeout(700)
      p.locator('#speed').select_option('0.25');p.wait_for_timeout(2200)
      p.locator('#flip').check();p.evaluate('__animationLab.setFrame(4)');p.screenshot(path=str(OUT/f'{cls}-mirrored.png'))
      p.locator('#flip').uncheck();review.append({'class':cls,'directions':8,'stills':128,'weapons':len(weapons),'normalAndQuarterSpeed':True})
    p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
    p.locator('[data-class=warden]').click();p.locator('#start-game').click()
    p.wait_for_function('__leaftale.snapshot()?.player')
    p.wait_for_timeout(250);p.screenshot(path=str(OUT/'live-field.png'))
    p.keyboard.press('Escape');assert p.locator('#panel-body a[href="./animation-lab.html"]').is_visible()
    for width,height in [(390,844),(1600,1080)]:
      p.set_viewport_size({'width':width,'height':height});p.goto(BASE+'animation-lab.html')
      p.wait_for_function('window.__animationLab?.snapshot().hand?.length===2')
      assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    assert not errors,errors;assert not failed,failed
    context.close();b.close()
  (OUT/'review.json').write_text(json.dumps({'review':review,'pageErrors':errors,'failedResponses':failed},ensure_ascii=False,indent=2))
  print('PASS: 512 stopped frames, 36 weapons, 8 headings, normal/.25 playback, mirror, pause/step, live field, mobile; no browser errors')
finally:
  if server:server.shutdown()
