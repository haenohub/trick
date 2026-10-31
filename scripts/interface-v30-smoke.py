"""Exercise the polished interface, keyboard paths and real saved-player actions."""
from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8093/'
OUT = Path('test-results/interface-v30'); OUT.mkdir(parents=True, exist_ok=True)
errors, failures, layouts = [], [], []

def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), page.viewport_size

def panel_fits(page):
    panel = page.locator('#menu-panel')
    box = panel.bounding_box()
    assert box['x'] >= 0 and box['x'] + box['width'] <= page.viewport_size['width'] + 1, box
    assert page.locator('#panel-body').evaluate('e => e.scrollWidth <= e.clientWidth + 1'), page.viewport_size

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440,'height':900})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: failures.append(r.url) if r.status >= 400 else None)
    page.goto(BASE); page.locator('#loading').wait_for(state='hidden')
    page.evaluate('document.fonts.ready')
    assert page.evaluate('document.fonts.check("700 40px LeafTitle")')
    assert page.locator('.lobby-guide').is_visible()
    for width,height in [(1920,1080),(1440,900),(1280,720),(1024,768),(768,1024),(390,844),(320,740),(844,390)]:
        page.set_viewport_size({'width':width,'height':height});no_overflow(page)
        assert page.locator('#lobby').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
        start=page.locator('#start-game');start.scroll_into_view_if_needed()
        box=start.bounding_box();assert box['y']>=0 and box['y']+box['height']<=height+1,(width,height,box)
        if (width >= 1024 and height >= 720) or (width,height) in [(390,844),(320,740)]:
            assert page.locator('#lobby').evaluate('e=>e.scrollHeight<=e.clientHeight+1'),(width,height)
        layouts.append({'width':width,'height':height,'lobbyScroll':page.locator('#lobby').evaluate('e=>e.scrollHeight>e.clientHeight+1')})
        if (width,height) in [(1440,900),(1280,720),(390,844),(320,740)]:page.screenshot(path=str(OUT/f'lobby-{width}.png'))
    page.set_viewport_size({'width':1440,'height':900})
    choice=page.locator('[data-class=ranger]');choice.focus();choice.press('Enter')
    assert choice.evaluate('e=>e===document.activeElement'), 'class selection discarded keyboard focus'
    assert choice.get_attribute('aria-pressed')=='true'
    assert page.locator('#class-select [aria-pressed=true]').count()==1
    page.locator('#adventurer-name').fill('숲길의 모험가');page.locator('#start-game').click()
    assert page.evaluate('__leaftale.snapshot().player.classId')=='ranger'
    page.screenshot(path=str(OUT/'field.png'))
    # Restore a genuine high-level saved player to exercise equipment and point allocation.
    page.goto(BASE+'bestiary.html')
    page.evaluate('''async()=>{const{createPlayer}=await import('./core.js'),{ITEMS}=await import('./data.js');
      const p=createPlayer('ranger');p.name='숲길의 모험가';p.level=30;delete p.allocated;delete p.allocationVersion;
      for(const id of Object.keys(ITEMS))p.inventory[id]=3;
      localStorage.setItem('leaftale:save:v1',JSON.stringify(p));}''')
    page.goto(BASE);page.locator('#loading').wait_for(state='hidden');page.locator('#continue-game').click()
    page.keyboard.press('i');panel_fits(page)
    assert page.locator('#menu-panel').bounding_box()['width']==540
    assert page.locator('.inventory-grid').evaluate('e=>getComputedStyle(e).gridTemplateColumns.split(" ").length')==5
    assert page.locator('[data-inventory-item]').count()==204
    slots=page.locator('.inventory-slot')
    for at in [0,1,4,5]:
        slot=slots.nth(at);slot.hover();page.locator('#item-tooltip').wait_for(state='visible')
        name=slot.get_attribute('aria-label').split(' · ')[0]
        assert name in page.locator('#item-tooltip .item-heading h3').inner_text()
    page.screenshot(path=str(OUT/'inventory.png'))
    # Equipment goes through the actual double-click handler and world checks.
    page.locator('[data-filter=equipment]').click()
    page.locator('.inventory-slot[data-inventory-item=bow1]').dblclick()
    assert page.evaluate('__leaftale.snapshot().player.equipment.weapon')=='bow1'
    page.keyboard.press('i');assert page.locator('#menu-panel').is_hidden()
    page.keyboard.press('c');panel_fits(page)
    assert page.locator('.skill-row').count()==6
    assert page.locator('.skill-row h3 kbd').all_inner_texts()==['Q','W','E','R','D','G']
    assert not page.locator('.skill-stat-details').get_attribute('open')
    growth=page.locator('.skill-stat-details > summary');growth.focus();growth.press('Enter')
    before=int(page.locator('[data-unspent]').inner_text())
    page.locator('[data-action=allocateStat][data-attribute=strength][data-amount="1"]').click()
    assert int(page.locator('[data-unspent]').inner_text())==before-1
    assert page.locator('.skill-stat-details').evaluate('e=>e.open'), 'allocation closed the expanded growth controls'
    page.locator('[data-stat-amount=strength]').fill('3')
    page.locator('[data-action=allocateStat][data-attribute=strength]:not([data-amount])').click()
    assert int(page.locator('[data-unspent]').inner_text())==before-4
    page.locator('[data-stat-amount=dexterity]').fill('30')
    page.locator('[data-action=allocateStat][data-attribute=dexterity]:not([data-amount])').click()
    page.locator('.skill-stat-details > summary').click()
    page.screenshot(path=str(OUT/'skills.png'))
    page.keyboard.press('c');page.keyboard.press('i')
    page.locator('[data-filter=equipment]').click()
    page.locator('.inventory-slot[data-inventory-item=bow2]').dblclick()
    assert page.evaluate('__leaftale.snapshot().player.equipment.weapon')=='bow2'
    page.keyboard.press('i');page.keyboard.press('v');panel_fits(page)
    assert page.locator('[data-equipment-slot]').count()==5
    page.screenshot(path=str(OUT/'character.png'))
    page.keyboard.press('v');page.keyboard.press('k')
    page.locator('[data-catalogue=items]').click()
    assert page.locator('.item-entry').count()==204
    assert page.locator('.item-details[open]').count()==0
    page.locator('[data-catalogue=crafting]').click()
    assert page.locator('.craft-guide-card').count()==40
    assert page.locator('.craft-details[open]').count()==0
    page.locator('.craft-details > summary').first.click()
    assert page.locator('.craft-details-body').first.is_visible()
    for width in [1024,768,390,320]:
        page.set_viewport_size({'width':width,'height':844});panel_fits(page);no_overflow(page)
        hud=page.locator('.player-card').bounding_box();mini=page.locator('.map-card').bounding_box()
        assert hud['x']+hud['width']<=mini['x'], ('overlapping player/map HUD',width,hud,mini)
        field=page.locator('.field-menu').bounding_box();menu=page.locator('.topbar nav').bounding_box()
        assert field['x']+field['width']<=menu['x'], ('overlapping field menus',width,field,menu)
        if width==390:page.screenshot(path=str(OUT/'crafting-390.png'))
    page.set_viewport_size({'width':1440,'height':900});page.keyboard.press('Escape')
    assert page.locator('#menu-panel').get_attribute('data-panel')=='settings'
    close=page.locator('#close-panel');close.focus();close.press('Shift+Tab')
    assert page.locator('#menu-panel').evaluate('e=>e.contains(document.activeElement)')
    page.keyboard.press('Escape');assert page.locator('#menu-panel').is_hidden()
    page.keyboard.press('p');assert page.locator('.keyboard-layout').is_visible()
    page.keyboard.press('p');assert page.locator('#menu-panel').is_hidden()
    # Reduced motion removes only the window entrance, not the information or controls.
    page.emulate_media(reduced_motion='reduce');page.keyboard.press('i')
    assert page.locator('#menu-panel').evaluate('e=>getComputedStyle(e).animationName')=='none'
    page.goto(BASE+'bestiary.html#crafting')
    assert page.locator('#result-count').inner_text()=='40종'
    page.locator('#search').fill('도토리 속빵')
    assert page.locator('.craft-card').count()==1
    assert page.locator('.craft-details[open]').count()==0
    summary=page.locator('.craft-details > summary');summary.focus();summary.press('Enter')
    assert page.locator('.craft-effects').is_visible()
    summary.press('Space');assert not page.locator('.craft-effects').is_visible()
    page.screenshot(path=str(OUT/'guide-crafting.png'),full_page=True)
    page.locator('[data-catalogue=items]').click();page.locator('#search').fill('보들잎')
    page.screenshot(path=str(OUT/'guide-items.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});no_overflow(page)
    assert not page.locator('.guide-filters').evaluate('e=>e.open')
    page.locator('.guide-filters > summary').click()
    assert page.locator('#item-type').is_visible()
    page.locator('.guide-filters > summary').click()
    page.screenshot(path=str(OUT/'guide-390.png'),full_page=True)
    page.set_viewport_size({'width':320,'height':740});no_overflow(page)
    assert page.locator('#search').is_visible()
    assert not errors, errors
    assert not failures, failures
    (OUT/'browser-review.json').write_text(json.dumps({'layouts':layouts,'pageErrors':errors,'failedRequests':failures},ensure_ascii=False,indent=2))
    print('PASS: responsive lobby; class keyboard focus; five-column bag and hover; real equip/allocation; six skill shortcuts; all 204 items/40 recipes; dialogs; reduced motion; mobile filter disclosure; no page/asset errors',flush=True)
    browser.close()
