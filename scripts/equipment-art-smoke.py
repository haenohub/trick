"""Real texture requests, worn-gear draw calls and inventory equip/save flow."""
from playwright.sync_api import sync_playwright
import sys
BASE=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8093/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':900});errors=[];requests=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.on('request',lambda r:requests.append(r.url))
 p.route(BASE+'appearance-test.html',lambda r:r.fulfill(status=200,content_type='text/html',body='<html><body></body></html>'))
 p.goto(BASE+'appearance-test.html')
 result=p.evaluate('''async()=>{
  const {loadArt,prepareEquipmentArt,Renderer,drawCharacterPreview}=await import('./renderer.js');
  const {starterEquipment}=await import('./equipment-appearance.js');
  const {ITEMS,CLASSES}=await import('./data.js');await loadArt();
  if(performance.getEntriesByType('resource').some(e=>e.name.includes('/appearance/')))throw Error('unused wardrobe downloaded during initial load');
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;canvas.id='outfits';document.body.append(canvas);
  const r=new Renderer(canvas,document.createElement('canvas'));r.dpr=1;r.zoom=1;
  const context=canvas.getContext('2d'),native=context.drawImage.bind(context),calls=[];
  context.drawImage=(image,...args)=>{calls.push({file:new URL(image.src).pathname,args,width:image.width,height:image.height});native(image,...args);};r.ctx=context;
  let variants=0,checked=0;
  for(const cls of CLASSES){
   const starter=starterEquipment(cls.id);
   await prepareEquipmentArt(cls.id,starter);
   for(const item of Object.values(ITEMS).filter(i=>i.type==='equipment'&&(!i.classId||i.classId===cls.id))){
    const equipment={...starter,[item.slot]:item.id};await prepareEquipmentArt(cls.id,equipment);
    for(const anim of ['idle','walk','windup','attack','recover','hurt','death'])for(let dir=0;dir<8;dir++)for(const time of [0,.1,.2,.4]){
     calls.length=0;r.sprite(cls.id,64,112,anim,dir,time,0,96,null,cls.id+anim+dir,equipment);
     if(calls.length!==7)throw Error(cls.id+' '+item.id+' wrong layer count '+calls.length);
     if(!calls.some(c=>c.file.includes(item.slot==='weapon'?'/appearance/held-weapons.png':'/appearance/gear/'+cls.id+'-'+item.id+'.png')))throw Error('equipped item is invisible');
     const frame=calls[0].args.slice(0,4).join(',');
     for(const c of calls){
      const [sx,sy,sw,sh]=c.args;
      if(c.file.endsWith('/appearance/held-weapons.png')){if(sx!==dir*96||sw!==96||sh!==96||sy%96||sy<0||sy+sh>c.height)throw Error('wrong held weapon cell');continue;}
      if(!c.file.includes('/appearance/')||sw!==96||sh!==96||sy!==dir*96||sx<0||sx+sw>c.width||sy+sh>c.height||c.args.slice(0,4).join(',')!==frame)throw Error('gear/body frame or heading mismatch '+JSON.stringify(c));
     }checked++;
    }variants++;
   }
  }
  context.clearRect(0,0,1024,512);
  for(let row=0;row<4;row++){
   const cls=CLASSES[row],starter=starterEquipment(cls.id);await prepareEquipmentArt(cls.id,starter);
   for(let dir=0;dir<8;dir++)r.sprite(cls.id,dir*128+64,row*128+112,'idle',dir,0,0,96,null,cls.id,starter);
  }
  return {variants,checked};
 }''')
 assert result=={'variants':48,'checked':10752},result
 p.locator('#outfits').screenshot(path='/tmp/leaftale-all-classes-equipped.png')
 print('PASS: lazy wardrobe loading; all 48 fitted class/item variants × 8 directions × 7 motions × 4 times draw seven synchronized native layers with isolated held weapons')
 p.goto(BASE);p.locator('#loading').wait_for(state='hidden')
 p.evaluate('''async()=>{
  const {createPlayer}=await import('./core.js');const q=createPlayer('warden');q.level=30;q.branch='antler';
  for(const id of ['spear2','wardenarmor2','hood2','boots2','charm2'])q.inventory[id]=1;
  localStorage.setItem('leaftale:save:v1',JSON.stringify(q));
 }''')
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click()
 p.evaluate('''()=>{window.gearCalls=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(image.src?.includes('/appearance/')){gearCalls.push(image.src);if(gearCalls.length>1000)gearCalls.shift();}return draw.call(this,image,...args);};}''')
 p.wait_for_function("gearCalls.some(f=>f.includes('/appearance/held-weapons.png'))")
 for slot,item in [('weapon','spear2'),('armor','wardenarmor2'),('head','hood2'),('boots','boots2'),('charm','charm2')]:
  if p.locator('#menu-panel').get_attribute('hidden') is not None:p.keyboard.press('i')
  p.locator('[data-inventory-item='+item+']').hover()
  p.locator('#item-tooltip [data-action=equip]').click()
  p.wait_for_function('(q)=>__leaftale.snapshot().player.equipment[q.slot]===q.item',arg={'slot':slot,'item':item})
  p.wait_for_function('(item)=>gearCalls.some(f=>f.includes(item.startsWith("spear")?"/appearance/held-weapons.png":"/appearance/gear/warden-"+item+".png"))',arg=item)
 p.keyboard.press('i');p.wait_for_timeout(5500)
 p.screenshot(path='/tmp/leaftale-equipped-in-game.png')
 p.reload();p.locator('#loading').wait_for(state='hidden');p.locator('#continue-game').click()
 equipment=p.evaluate('__leaftale.snapshot().player.equipment')
 assert equipment=={'weapon':'spear2','armor':'wardenarmor2','head':'hood2','boots':'boots2','charm':'charm2'},equipment
 assert not errors,errors
 print('PASS: actual inventory buttons replace all five worn slots in the game renderer and equipment survives reload')
 b.close()
