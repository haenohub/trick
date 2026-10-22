"""Original pixel artwork, drawn from primitives into frame atlases. No external assets."""
from PIL import Image, ImageDraw
from pathlib import Path
import math, random, json, subprocess

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'site/assets'; OUT.mkdir(exist_ok=True)
data=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {MONSTERS,ITEMS,CLASSES} from './site/data.js'; console.log(JSON.stringify({MONSTERS,ITEMS,CLASSES}));"],cwd=ROOT,text=True))
OUTLINE='#263d35'
def shade(c,n):
 c=c.lstrip('#'); rgb=[int(c[i:i+2],16) for i in (0,2,4)]
 return tuple(max(0,min(255,v+n)) for v in rgb)+(255,)
def shape(d,box,c,kind='ellipse'):
 getattr(d,kind)(tuple(round(v) for v in box),fill=c,outline=OUTLINE,width=1)
def frame_pose(col):
 if col<4: return 'idle',col/4,round(math.sin(col/4*math.tau)*.65),0
 if col<10:
  t=(col-4)/6;return 'walk',t,round(math.sin(t*math.tau*2)*.7),round(math.sin(t*math.tau)*2)
 if col<16:
  i=col-10; return 'attack',i/6,[0,1,1,-1,0,0][i],[-1,-2,-1,3,2,0][i]
 if col<18:return 'hurt',(col-16)/2,0,-2
 return 'death',(col-18)/6,0,0
def sprite_frame(shape_name,color,col,direction=0,hero=False,variant=0):
 im=Image.new('RGBA',(32,32));d=ImageDraw.Draw(im)
 state,t,bob,stride=frame_pose(col); cx=16;cy=20+bob
 if state=='attack':cx+=round(stride*.7)*(1 if direction in [0,1] else -1)
 death=state=='death'; light=shade(color,25);dark=shade(color,-28)
 if death:cy+=round(t*5)
 if hero:
  # Articulated feet, tunic, hands, hair and weapon share the same fixed pivot.
  leg=stride if state=='walk' else 0
  shape(d,(11,24-leg,15,28-leg),'#685b48','rectangle');shape(d,(18,24+leg,22,28+leg),'#685b48','rectangle')
  shape(d,(10,15+bob,23,25+bob),color,'rectangle')
  d.rectangle((12,16+bob,20,17+bob),fill=light);d.line((12,23+bob,22,23+bob),fill=dark,width=2)
  arm=round(math.sin(t*math.tau)*1.5) if state=='walk' else stride
  shape(d,(7,17+bob+arm,11,23+bob+arm),'#e8c5a2','rectangle');shape(d,(22,17+bob-arm,26,23+bob-arm),'#e8c5a2','rectangle')
  shape(d,(9,4+bob,23,17+bob),'#f1d2ac')
  hair={'warden':'#a8774e','mage':'#d4cbdc','ranger':'#6c7970','herbalist':'#cd8d90'}[shape_name]
  shape(d,(8,2+bob,24,10+bob),hair)
  d.rectangle((9,7+bob,12,14+bob),fill=hair);d.rectangle((22,6+bob,24,15+bob),fill=hair)
  if shape_name=='mage':
   d.polygon([(9,5+bob),(8,0),(13,4+bob)],fill='#ac9fc3',outline=OUTLINE);d.polygon([(20,5+bob),(25,0),(24,9+bob)],fill='#ac9fc3',outline=OUTLINE)
  elif shape_name=='ranger':
   d.polygon([(9,7+bob),(8,1+bob),(14,5+bob)],fill=hair,outline=OUTLINE);d.polygon([(19,5+bob),(25,1+bob),(24,9+bob)],fill=hair,outline=OUTLINE)
  elif shape_name=='herbalist':
   d.line((12,4+bob,9,0),fill='#5e966c',width=2);d.line((20,4+bob,24,1),fill='#79aa75',width=2);d.rectangle((8,12+bob,10,21+bob),fill=hair)
  else:
   d.polygon([(10,5+bob),(5,2+bob),(8,9+bob)],fill='#ac926b',outline=OUTLINE);d.rectangle((18,3+bob,22,5+bob),fill='#b1cb7a')
  if direction!=2:
   shift=1 if direction==1 else -1 if direction==3 else 0
   d.rectangle((13+shift,10+bob,14+shift,12+bob),fill=OUTLINE);d.rectangle((19+shift,10+bob,20+shift,12+bob),fill=OUTLINE)
   d.point((17+shift,14+bob),fill='#aa7c72')
  else:d.rectangle((11,6+bob,22,13+bob),fill=hair)
  wx=26 if direction!=3 else 5;wy=17+bob-arm
  if shape_name=='warden':
   d.line((wx,wy+10,wx+round(stride*.6),wy-10),fill='#8b7150',width=2);d.polygon([(wx-2+round(stride*.6),wy-7),(wx+round(stride*.6),wy-13),(wx+3+round(stride*.6),wy-7)],fill='#cbd4b1',outline=OUTLINE)
  elif shape_name=='ranger':
   d.arc((wx-4,wy-8,wx+3,wy+8),270,90,fill='#c0a366',width=2);d.line((wx,wy-8,wx,wy+8),fill='#e4dcb6');
   if state=='attack':d.line((wx-5,wy,wx+5,wy),fill='#e8d8ad')
  else:
   d.line((wx,wy+9,wx,wy-7),fill='#9a7755',width=2);shape(d,(wx-3,wy-11,wx+3,wy-5),'#b9d3ae' if shape_name=='herbalist' else '#e0c9eb');d.point((wx,wy-9),fill='#fff1c4')
 else:
  # All silhouettes have their own anatomy; small pose shifts become pixel clusters.
  leg=stride if state=='walk' else 0
  if shape_name in ['rabbit','mouse','squirrel','weasel','otter','fox','boar','monkey','croc','lizard','deer','dragon','ancient','treant']:
   shape(d,(7,22-leg,12,27-leg),dark,'rectangle');shape(d,(21,22+leg,26,27+leg),dark,'rectangle')
  if shape_name in ['bug','beetle','mantis','crab','hermit','shrimp']:
   for side in [-1,1]:
    for j in range(3):d.line((16+side*6,18+j*2,16+side*(11+(j%2)),20+j*2+(leg if j%2 else -leg)),fill=OUTLINE,width=1)
  if shape_name in ['weasel','otter','fox','squirrel','monkey','lizard','croc','dragon']:
   tcx=5 if direction!=3 else 26;shape(d,(tcx-3,13+bob+leg,tcx+5,24+bob+leg),dark)
  if shape_name in ['jelly','anemone','worm','caterpillar']:
   for j in range(5):
    xx=8+j*4;d.line((xx,21+bob,xx+round(math.sin(t*math.tau+j)*2),28+bob),fill=dark,width=2)
  if shape_name in ['bird','bat','dragon']:
   wing=round(math.sin(t*math.tau)*3)
   for sign in [-1,1]:d.polygon([(16+sign*5,15+bob),(16+sign*15,9+bob+wing),(16+sign*12,23+bob),(16+sign*6,22+bob)],fill=dark,outline=OUTLINE)
  body=(6,12+bob,27,25+bob)
  if shape_name in ['worm','caterpillar']:body=(3,17+bob,28,26+bob)
  if shape_name=='deer':body=(8,14+bob,25,23+bob)
  if shape_name in ['treant','ancient']:body=(7,10+bob,26,27+bob)
  shape(d,body,color)
  d.ellipse((body[0]+3,body[1]+2,body[2]-5,body[3]-6),fill=light)
  if shape_name in ['rabbit','mouse','fox','squirrel','weasel','otter','boar','monkey','lizard','croc','deer','dragon']:
   shape(d,(11,8+bob,27,21+bob),color)
   if shape_name=='rabbit':
    shape(d,(11,0+bob,16,12+bob),color);shape(d,(20,1+bob,25,12+bob),color);d.line((13,3+bob,13,9+bob),fill='#d6ada4',width=2)
   elif shape_name in ['fox','squirrel','mouse','weasel','monkey']:
    shape(d,(10,5+bob,16,12+bob),color);shape(d,(22,5+bob,28,12+bob),color)
   elif shape_name=='boar':d.line((24,19+bob,28,15+bob),fill='#e7ddc0',width=2)
   elif shape_name=='deer':
    for x in [13,23]:d.line((x,10+bob,x,2+bob),fill='#bca47c',width=2);d.line((x,5+bob,x-3,2+bob),fill='#bca47c',width=2)
   elif shape_name=='dragon':
    d.polygon([(13,10+bob),(11,1+bob),(17,9+bob)],fill='#d3d9b2',outline=OUTLINE);d.polygon([(22,9+bob),(25,1+bob),(26,12+bob)],fill='#d3d9b2',outline=OUTLINE)
  if shape_name in ['treant','ancient']:
   for sign in [-1,1]:d.line((16+sign*8,17+bob,16+sign*13,22+bob+stride),fill=dark,width=4)
   for x,y in [(8,8),(17,5),(25,8)]:shape(d,(x-6,y-5+bob,x+5,y+5+bob),light)
   d.rectangle((12,20+bob,21,21+bob),fill=OUTLINE)
  if shape_name=='sprout':
   d.line((16,18+bob,16,4+bob),fill='#658653',width=2);shape(d,(6,3+bob,16,10+bob),light);shape(d,(16,1+bob,27,8+bob),color)
  if shape_name=='snail':shape(d,(5,7+bob,24,24+bob),'#caa98a');d.arc((8,10+bob,21,22+bob),0,330,fill='#997861',width=2)
  if shape_name=='hermit':shape(d,(6,6+bob,26,24+bob),'#d7c4a4');d.arc((9,9+bob,24,23+bob),0,300,fill='#a4937c',width=2)
  if shape_name in ['crab','shrimp','mantis']:
   for sign in [-1,1]:
    xx=16+sign*12;shape(d,(xx-4,9+bob-stride,xx+3,16+bob-stride),light);d.line((xx,9+bob-stride,xx+2,13+bob-stride),fill=OUTLINE)
  if shape_name=='bird':d.polygon([(23,11+bob),(31,14+bob),(23,16+bob)],fill='#c5ac6a',outline=OUTLINE)
  if shape_name=='fish':d.polygon([(7,17+bob),(0,11+bob),(1,25+bob),(8,23+bob)],fill=dark,outline=OUTLINE)
  if shape_name in ['bug','beetle']:d.line((16,13+bob,16,25+bob),fill=dark,width=1);d.rectangle((10,15+bob,12,17+bob),fill=light)
  if shape_name in ['beetle','caterpillar'] and 'a' in color:d.point((20,16+bob),fill='#eee6b7')
  if shape_name=='jelly':d.arc((5,8+bob,28,29+bob),180,360,fill=light,width=3)
  if direction!=2:
   ey=17+bob if shape_name not in ['deer','dragon','rabbit','fox','squirrel','mouse','monkey','otter','weasel','boar'] else 13+bob
   for ex in [14,22]:d.rectangle((ex,ey,ex+1,ey+2),fill=OUTLINE);d.point((ex,ey),fill='#f4eec9')
  if state=='attack':d.line((13,23+bob,22,23+bob),fill='#715b50',width=1)
 if not hero:
  # Species-specific anatomy and carried objects, not just palette swaps.
  v=variant+1
  if v==1: d.polygon([(6,11+bob),(16,7+bob),(25,11+bob),(15,18+bob)],fill='#8bae5f',outline=OUTLINE);d.line((15,9+bob,15,17+bob),fill='#c2d48b')
  if v==2: shape(d,(4,18+bob,12,26+bob),'#c5ae7b');d.point((7,21+bob),fill='#e3cf97')
  if v==3: d.rectangle((6,24+bob,27,27+bob),fill='#8e7958');d.point((8,23+bob),fill='#c9b58b')
  if v==4:
   for x in range(7,27,4):d.polygon([(x,14+bob),(x+1,7+bob),(x+4,14+bob)],fill='#9d8b5c',outline=OUTLINE)
  if v==5: d.polygon([(3,18+bob),(0,13+bob),(6,15+bob),(10,12+bob),(10,19+bob)],fill='#d2a7ac',outline=OUTLINE)
  if v in [6,10]:
   shape(d,(9,3+bob,27,12+bob),'#a3895c');d.rectangle((10,7+bob,26,10+bob),fill='#796b46');d.line((18,3+bob,20,0+bob),fill='#6d6c47',width=2)
   if v==10:
    for x in [5,15,26]:shape(d,(x-2,25+bob,x+2,29+bob),'#b4a06a')
  if v==7:
   for x in [13,23]:d.line((x,2+bob,x,11+bob),fill='#8d8056');d.line((x,6+bob,x+2,4+bob),fill='#b9aa72')
  if v==8:shape(d,(10,10+bob,22,20+bob),'#9a825e');d.line((11,14+bob,21,14+bob),fill='#675d44');d.line((12,17+bob,20,17+bob),fill='#675d44')
  if v==9:shape(d,(0,18+bob,10,26+bob),'#9b885d','rectangle');shape(d,(22,18+bob,31,26+bob),'#9b885d','rectangle')
  if v==11:shape(d,(7,5+bob,26,21+bob),'#a0d6d4');d.arc((9,7+bob,24,20+bob),190,290,fill='#e2f2e1',width=2)
  if v==12:
   for x in [9,25]:d.line((x,21+bob,x+leg,31),fill='#6a8b56',width=2)
  if v==13:
   for xx in [4,17]:shape(d,(xx,9+bob,xx+11,15+bob),'#b6d8cf')
  if v==14:d.polygon([(7,13+bob),(12,6+bob),(22,7+bob),(27,15+bob)],fill='#a0aaa0',outline=OUTLINE);d.line((12,8+bob,21,10+bob),fill='#d1d4ba')
  if v==15:
   for sign in [-1,1]:d.line((20,17+bob,20+sign*8,16+bob),fill='#e0d1b1');d.line((20,18+bob,20+sign*7,20+bob),fill='#e0d1b1')
  if v==16:
   for x in [8,14,20]:d.rectangle((x,12+bob,x+3,16+bob),fill='#c1a67e',outline='#6a6249')
  if v==17:d.pieslice((2,0+bob,27,17+bob),180,360,fill='#c28a82',outline=OUTLINE);d.rectangle((5,7+bob,24,9+bob),fill='#e3c7ad');d.rectangle((10,4+bob,13,5+bob),fill='#f1d5b5')
  if v==18:
   for x,y in [(8,12),(17,9),(23,15)]:shape(d,(x-2,y-2+bob,x+3,y+4+bob),'#e0b858');d.point((x,y-1+bob),fill='#f8e6aa')
  if v==19:
   for x in [7,15,25]:d.line((x,14+bob,x-3,5+bob),fill='#807550',width=2);d.line((x-2,7+bob,x+2,4+bob),fill='#807550',width=2)
  if v==20:
   d.rectangle((9,15+bob,25,27+bob),fill='#7b7654',outline=OUTLINE)
   for x,y in [(8,8),(16,3),(25,8)]:shape(d,(x-6,y-3+bob,x+6,y+6+bob),'#91ae73')
   d.rectangle((12,18+bob,14,21+bob),fill='#dce3a7');d.rectangle((21,18+bob,23,21+bob),fill='#dce3a7')
  if v==21:
   for x in [8,11,24,27]:d.point((x,19+bob),fill='#f1eee0')
  if v==22:
   for x in range(9,27,4):d.polygon([(x,11+bob),(x+2,8+bob),(x+4,12+bob)],fill='#d7e0cd',outline='#7d9b88')
  if v==23:d.arc((9,8+bob,24,22+bob),0,300,fill='#f2ddae',width=2)
  if v==24:d.line((25,13+bob,31,12+bob),fill='#ead8a0',width=2);d.line((12,23+bob,10+leg,31),fill='#9c8766');d.line((23,23+bob,24-leg,31),fill='#9c8766')
  if v==25:d.polygon([(1,15+bob),(7,13+bob),(12,21+bob),(5,25+bob)],fill='#eef0df',outline=OUTLINE)
  if v==26:d.polygon([(8,15+bob),(16,4+bob),(25,15+bob),(16,22+bob)],fill='#c7e2d1',outline=OUTLINE);d.line((16,6+bob,16,20+bob),fill='#f0f4dc')
  if v==27:
   for x in [2,24]:shape(d,(x,10+bob-stride,x+7,20+bob-stride),'#d4bd8c');d.line((x+2,12+bob-stride,x+5,12+bob-stride),fill='#8e805b')
  if v==28:
   for x,y,r in [(8,9,4),(17,6,5),(25,12,4)]:d.ellipse((x-r,y-r+bob,x+r,y+r+bob),outline='#e4f2de',width=1)
  if v==29:
   for sign in [-1,1]:d.polygon([(16+sign*8,20+bob),(16+sign*15,5+bob-stride),(16+sign*10,7+bob-stride),(16+sign*5,19+bob)],fill='#e5e3bf',outline=OUTLINE)
  if v==30:shape(d,(3,16+bob,13,26+bob),'#83b7bc');d.rectangle((6,18+bob,10,21+bob),fill='#d4db9b')
  if v==31:
   for x in range(5,28,4):d.line((x,18+bob,x+1,26+bob),fill='#657f69')
  if v==32:
   for x in [14,23]:shape(d,(x-2,10+bob,x+2,15+bob),'#e5e6cc');d.point((x,12+bob),fill='#577d7b')
  if v==33:
   for x,y in [(8,13),(13,11),(17,12),(21,10)]:d.rectangle((x,y+bob,x+4,y+3+bob),fill='#96b473')
  if v==34:d.rectangle((10,12+bob,24,22+bob),fill='#c3b889',outline=OUTLINE);d.line((15,14+bob,15,18+bob),fill='#51674c',width=2);d.line((21,14+bob,21,18+bob),fill='#51674c',width=2)
  if v==35:d.arc((5,22,30,31),0,300,fill='#cce5d7',width=1)
  if v==36:
   for x in [9,15,21]:d.rectangle((x,12+bob,x+2,14+bob),fill='#c6eeee')
  if v==37:
   for sign in [-1,1]:d.polygon([(16+sign*6,15+bob),(16+sign*13,5+bob),(16+sign*11,18+bob)],fill='#d6e2da',outline=OUTLINE)
  if v==38:
   for x in range(5,29,4):d.line((x,15+bob,x+round(math.sin(t*math.tau+x)*2),3+bob),fill='#5f987b',width=2)
  if v==39:
   for x in [8,15,24]:d.line((x,14+bob,x,4+bob),fill='#d6aaa2',width=2);d.line((x,8+bob,x-4,5+bob),fill='#d6aaa2',width=2)
  if v==40:
   for x in [7,12,17]:d.polygon([(x,13+bob),(x-2,4+bob),(x+4,12+bob)],fill='#b5c8a3',outline=OUTLINE)
   for sign in [-1,1]:d.line((22,18+bob,22+sign*8,24+bob),fill='#cbdab0')
 if death:
  alpha=im.getchannel('A').point(lambda a:round(a*(1-t)))
  im.putalpha(alpha)
 return im.resize((64,64),Image.Resampling.NEAREST)

for m in data['MONSTERS']:
 atlas=Image.new('RGBA',(64*24,64*4))
 for row in range(4):
  for col in range(24):atlas.paste(sprite_frame(m['shape'],m['color'],col,row,variant=m['index']),(col*64,row*64))
 atlas.save(OUT/(m['id']+'.png'),optimize=True)
for c in data['CLASSES']:
 atlas=Image.new('RGBA',(64*24,64*4))
 for row in range(4):
  for col in range(24):atlas.paste(sprite_frame(c['id'],c['color'],col,row,True),(col*64,row*64))
 atlas.save(OUT/(c['id']+'.png'),optimize=True)

for kind in ['tree','palm','house','bush','rock','crystal']:
 for variant in range(3):
  rng=random.Random(variant+sum(map(ord,kind))); im=Image.new('RGBA',(64,80));d=ImageDraw.Draw(im)
  if kind in ['tree','palm']:
   d.polygon([(27,72),(37,72),(35,37),(30,36)],fill='#735f43',outline=OUTLINE);d.line((32,69,31,40),fill='#a08653',width=2)
   if kind=='tree':
    palette=['#385e45','#47794c','#5b9257','#81a862']
    for x,y,r in [(22,37,18),(43,34,17),(31,20,19),(17,25,13),(43,19,13),(31,32,19)]:shape(d,(x-r,y-r,x+r,y+r),palette[(x+y)%3])
    for i in range(95):
     x=rng.randrange(6,58);y=rng.randrange(4,48)
     if im.getpixel((x,y))[3] and im.getpixel((x,y))[:3]!=(38,61,53):d.rectangle((x,y,x+1,y+1),fill=palette[rng.randrange(1,4)])
   else:
    for sign in [-1,1]:
     for yy in [8,22,35]:d.polygon([(32,27),(32+sign*29,yy),(32+sign*22,yy+11),(32,32)],fill=['#658f6d','#86a980','#4d7b62'][yy%3],outline=OUTLINE)
    shape(d,(25,24,32,31),'#bfa47c');shape(d,(33,24,40,31),'#bfa47c')
  elif kind=='house':
   d.rectangle((10,29,56,68),fill=['#b6a17d','#c0b58e','#b39d81'][variant],outline=OUTLINE,width=2)
   d.polygon([(5,31),(31,8),(62,31)],fill=['#6f8e67','#8c9170','#927c64'][variant],outline=OUTLINE)
   for y in range(19,32,4):d.line((20-(y-19),y,43+(y-19),y),fill='#a7b47b')
   d.rectangle((28,43,39,68),fill='#625640',outline=OUTLINE);d.point((36,55),fill='#e8cb7a')
   for x in [15,44]:d.rectangle((x,40,x+7,50),fill='#f1cf86',outline=OUTLINE);d.line((x+3,40,x+3,50),fill='#8b7858')
   d.rectangle((8,66,59,70),fill='#7e7658');d.rectangle((14,53,23,56),fill='#718c58');d.rectangle((43,53,54,56),fill='#718c58')
  elif kind=='bush':
   for x,y,r in [(19,60,11),(31,53,14),(44,61,11)]:shape(d,(x-r,y-r,x+r,y+r),['#5f8b52','#83a761','#507d51'][variant])
   for i in range(18):x=rng.randrange(12,52);y=rng.randrange(49,65);d.rectangle((x,y,x+1,y+1),fill='#d5d7a4' if i%3==0 else '#a1b773')
  elif kind=='rock':
   d.polygon([(10,68),(14,53),(32,44),(50,52),(56,68),(40,73),(19,73)],fill='#89978c',outline=OUTLINE);d.polygon([(15,54),(31,47),(44,53),(32,60)],fill='#b0b8a0');d.line((32,60,38,70),fill='#667c72',width=2)
  else:
   for x,y,h in [(22,67,28),(36,70,48),(47,69,23)]:d.polygon([(x-6,y),(x-5,y-h+8),(x,y-h),(x+6,y-h+8),(x+7,y)],fill=['#76b7b5','#a1cbbf','#87a9c0'][variant],outline=OUTLINE);d.line((x,y-h+5,x+2,y-6),fill='#dce9d1',width=2)
  im.resize((128,160),Image.Resampling.NEAREST).save(OUT/f'{kind}{variant}.png',optimize=True)

items=list(data['ITEMS'].values()); atlas=Image.new('RGBA',(32*8,32*math.ceil(len(items)/8)))
for index,i in enumerate(items):
 im=Image.new('RGBA',(16,16));d=ImageDraw.Draw(im);c=i.get('color','#b4c58b');light=shade(c,30)
 if i['type']=='material':
  if i['id'] in ['ironstone','shellore']:d.polygon([(2,12),(4,5),(9,2),(14,7),(12,13),(5,14)],fill=c,outline=OUTLINE);d.line((5,6,9,4),fill=light,width=2)
  elif i['id'] in ['fiber','seawood']:d.line((3,13,12,3),fill='#8d7355',width=4);d.line((3,12,12,3),fill=c,width=2)
  else:
   d.line((7,14,9,3),fill='#5c8659',width=1);shape(d,(2,5,9,10),c);shape(d,(8,2,14,7),light)
 elif i['type']=='consumable':
  shape(d,(4,5,12,14),c);d.rectangle((6,2,10,5),fill='#c5ab77',outline=OUTLINE);d.line((6,7,6,10),fill='#eff4d7',width=1)
 elif i.get('slot')=='weapon':
  w=i.get('weapon')
  if w=='bow':d.arc((2,1,13,14),270,90,fill=c,width=2);d.line((8,1,8,14),fill='#e1d7b7')
  else:
   d.line((3,14,11,3),fill='#987c55',width=2)
   if w=='spear':d.polygon([(9,3),(14,0),(13,6)],fill='#d4d8bd',outline=OUTLINE)
   else:shape(d,(8,0,15,6),c);d.point((11,2),fill='#f9f2ca')
 elif i.get('slot')=='armor':d.polygon([(4,2),(6,4),(10,4),(12,2),(15,6),(12,9),(12,14),(3,14),(3,9),(0,6)],fill=c,outline=OUTLINE);d.line((5,7,10,7),fill=light,width=1)
 elif i.get('slot')=='head':shape(d,(2,3,14,13),c);d.rectangle((4,9,12,14),fill='#334a3a')
 elif i.get('slot')=='boots':d.polygon([(4,2),(10,2),(10,10),(14,11),(14,14),(3,14)],fill=c,outline=OUTLINE)
 else: d.ellipse((2,2,13,13),outline=c,width=2);shape(d,(6,9,10,15),light)
 if i.get('tier',1)>1:
  d.line((2,2,5,2),fill='#e1e4cf');d.point((2,3),fill='#e1e4cf')
  if i.get('tier')==3:d.polygon([(12,11),(14,13),(12,15),(10,13)],fill='#e7cd8b',outline=OUTLINE)
 atlas.paste(im.resize((32,32),Image.Resampling.NEAREST),((index%8)*32,(index//8)*32))
atlas.save(OUT/'items.png',optimize=True)
(OUT/'manifest.json').write_text(json.dumps({'frameSize':64,'columns':24,'directions':4,'animations':{'idle':[0,4,5],'walk':[4,6,10],'attack':[10,6,13],'hurt':[16,2,8],'death':[18,6,8]},'items':{i['id']:n for n,i in enumerate(items)},'provenance':'Original procedural pixel drawings; generated by scripts/generate-art.py.'},ensure_ascii=False,indent=2))
print(f'Generated {len(data["MONSTERS"])} monster atlases, 4 character atlases, 18 scenery sprites and {len(items)} item icons.')
