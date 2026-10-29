"""Confirm an armed combat action through the real canvas input."""
def confirm_attack(page,key):
 page.keyboard.press(key)
 point=page.evaluate('''async key=>{
  const{combatAim}=await import('./targeting.js'),s=__leaftale.snapshot(),slot=key==='a'?null:'qwer'.indexOf(key),rule=combatAim(s.player,slot);
  const m=s.mobs.filter(m=>m.hp>0).sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];
  const aim=rule.mode==='self'||!m?s.player:m,q=__leaftale.worldToScreen(aim.x,aim.y);
  return{x:q.x,y:q.y-(rule.mode==='enemy'?32*__leaftale.view().zoom:0)};
 }''',key)
 page.mouse.click(point['x'],point['y'])
