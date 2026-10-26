"""Compile fallback combat atlases from the exact runtime bitmap compositor."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import base64
BASE='http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 p=b.new_page();p.route(BASE+'avatar-pack.html',lambda r:r.fulfill(body='<html></html>',content_type='text/html'));p.goto(BASE+'avatar-pack.html')
 for cls in ['warden','mage','ranger','herbalist']:
  encoded=p.evaluate('''async id=>{
   const {drawPaperDoll}=await import('./avatar-draw.js');const{equippedAppearance,starterEquipment}=await import('./equipment-appearance.js');
   const art=await(await fetch('./assets/manifest.json')).json(),a=equippedAppearance(art,id,starterEquipment(id)),images=new Map();
   for(const l of a.layers){const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src='./assets/'+l.file+'.png';});images.set(l.file,image);}
   const c=document.createElement('canvas');c.width=c.height=768;const context=c.getContext('2d');context.imageSmoothingEnabled=false;
   for(let row=0;row<8;row++)for(let col=0;col<8;col++){context.save();context.beginPath();context.rect(col*96+4,row*96+4,88,88);context.clip();drawPaperDoll(context,a,images,col,row,col*96,row*96,1);context.restore();}
   return c.toDataURL('image/png').split(',')[1];
  }''',cls)
  Path('/tmp/leaftale-combat-equipped-'+cls+'.png').write_bytes(base64.b64decode(encoded))
  print('Composited equipped '+cls)
 b.close()
