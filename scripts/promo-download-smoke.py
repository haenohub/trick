"""Verify actual MP4 downloads and the desktop save picker without touching user files."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import hashlib,sys

BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
EXPECTED='a63b8cf8b7b2968f51e12b74356eefe5eb8181eb092e878bf972f1721c5647e9'
SIZE=26471583
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':1000},accept_downloads=True);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.goto(BASE+'promo/');p.wait_for_function('document.querySelector("video").readyState>=1')
 assert p.locator('video').evaluate('v=>v.videoWidth===1080&&v.videoHeight===1920&&Math.abs(v.duration-30)<.04')
 for width in [1440,390,320]:
  p.set_viewport_size({'width':width,'height':844})
  assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  assert p.locator('#save-video').is_visible()
 p.evaluate('''()=>{
  window.saved={bytes:0,chunks:[],closed:false,aborted:false};
  window.showSaveFilePicker=async options=>{saved.options=options;return{createWritable:async()=>({write:async value=>{saved.chunks.push(value);saved.bytes+=value.byteLength;},close:async()=>{saved.closed=true;},abort:async()=>{saved.aborted=true;}})}};
 }''')
 p.locator('#save-video').click();p.wait_for_function('saved.closed',timeout=60000)
 assert p.evaluate('saved.options.startIn')=='desktop'
 assert p.evaluate('saved.options.suggestedName')=='리프테일_30초_홍보영상.mp4'
 assert p.evaluate('saved.bytes')==SIZE
 digest=p.evaluate('''async()=>{const data=new Uint8Array(saved.bytes);let at=0;for(const chunk of saved.chunks){data.set(chunk,at);at+=chunk.byteLength;}return[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(v=>v.toString(16).padStart(2,'0')).join('');}''')
 assert digest==EXPECTED;assert '저장했습니다' in p.locator('#status').inner_text()
 print('PASS: real 30-second video metadata; desktop picker request; exact streamed MP4 bytes; desktop/mobile layout',flush=True)

 p.evaluate('window.showSaveFilePicker=undefined')
 with p.expect_download(timeout=60000) as download:p.locator('#save-video').click()
 file=Path('/tmp/leaftale-promo-download.mp4');download.value.save_as(file)
 assert download.value.suggested_filename=='리프테일_30초_홍보영상.mp4'
 assert hashlib.sha256(file.read_bytes()).hexdigest()==EXPECTED
 print('PASS: browser-native fallback downloads the complete actual MP4 with its Korean filename',flush=True)

 p.evaluate('''()=>{window.saved={bytes:0,chunks:[],closed:false,aborted:false};window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async value=>{saved.bytes+=value.byteLength;},close:async()=>{saved.closed=true;},abort:async()=>{saved.aborted=true;}})});}''')
 p.route(BASE+'promo/leaftale-30s.mp4',lambda route:route.fulfill(body=b'incomplete',content_type='video/mp4'))
 p.locator('#save-video').click();p.wait_for_function('saved.aborted')
 assert not p.evaluate('saved.closed');assert '저장하지 못했습니다' in p.locator('#status').inner_text()
 p.unroute(BASE+'promo/leaftale-30s.mp4')
 p.evaluate("()=>{window.showSaveFilePicker=async()=>{throw new DOMException('cancelled','AbortError')};}")
 p.locator('#save-video').click();p.wait_for_function("document.querySelector('#status').textContent.includes('취소')")
 assert p.locator('#save-video').is_enabled()
 print('PASS: incomplete files abort without reporting a successful save; cancelling remains safe and retryable',flush=True)
 assert not errors,errors;b.close()
