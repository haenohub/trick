"""Verify the standalone field guide through actual desktop/mobile/file UI."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8093/bestiary.html"
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)
    assert page.locator(".monster-card").count() == 8
    assert page.locator("#result-count").inner_text() == "40종"
    page.wait_for_function("document.querySelector('canvas[data-monster]').dataset.loaded === 'true'")
    page.screenshot(path="/tmp/leaftale-bestiary-desktop.png", full_page=True)
    page.locator("#search").fill("콩잎폴짝")
    assert page.locator(".monster-card").count() == 1
    assert page.locator(".chance").all_inner_texts() == ["32%", "18%", "8%", "1.2%"]
    page.locator(".drop-item summary").first.click()
    assert "어린 가지" in page.locator(".drop-item[open]").inner_text()
    page.locator("#search").fill("버들섬유")
    assert page.locator("#result-count").inner_text() == "20종"
    page.locator("#reset").click()
    page.locator('[data-region="1"]').click()
    assert page.locator("#result-count").inner_text() == "20종"
    assert page.locator("#map-filter option").count() == 5
    page.locator("#map-filter").select_option("seacave")
    assert page.locator("#result-count").inner_text() == "5종"
    page.locator('[data-rank="boss"]').click()
    assert page.locator(".monster-card").get_attribute("data-id") == "m40"
    assert page.locator(".chance").all_inner_texts() == ["71%", "60%", "14%", "18%"]
    page.locator("#reset").click()
    page.locator("#sort").select_option("level-desc")
    assert page.locator(".monster-card").first.get_attribute("data-id") == "m40"
    page.locator('#pagination [data-page="2"]').first.click()
    assert page.locator('#pagination [aria-current="page"]').inner_text() == "2"
    page.locator("#search").fill("없는몬스터123")
    assert page.locator("#empty").is_visible()
    page.locator("#empty-reset").click()
    page.evaluate("dispatchEvent(new Event('beforeprint'))")
    assert page.locator(".monster-card").count() == 40
    assert page.locator(".drop-table tbody tr").count() == 160
    page.evaluate("dispatchEvent(new Event('afterprint'))")
    assert page.locator(".monster-card").count() == 8
    with page.expect_download() as download:
        page.locator("#download").click()
    saved = Path("/tmp/leaftale-bestiary-export.html")
    download.value.save_as(saved)
    assert "bestiary-data" in saved.read_text()
    # Run the downloaded HTML with networking disabled. Managed Chromium blocks file://,
    # so fulfill just the document from memory; no scripts, modules or assets are served.
    offline = browser.new_context(offline=True)
    file_page = offline.new_page()
    file_page.on("pageerror", lambda e: errors.append(str(e)))
    offline_url = "http://127.0.0.1:8093/offline-copy.html"
    file_page.route(offline_url, lambda route: route.fulfill(body=saved.read_text(), content_type="text/html"))
    file_page.goto(offline_url, wait_until="domcontentloaded")
    assert file_page.locator("#result-count").inner_text() == "40종"
    file_page.locator("#search").fill("푸른숨 뿌리해룡")
    assert file_page.locator(".monster-card").count() == 1
    assert file_page.locator(".chance").all_inner_texts() == ["71%", "60%", "14%", "18%"]
    for width in [390, 768, 320]:
        mobile = browser.new_page(viewport={"width": width, "height": 844}, is_mobile=True, has_touch=True)
        mobile.on("pageerror", lambda e: errors.append(str(e)))
        mobile.goto(BASE)
        assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
        mobile.locator("#search").fill("콩잎폴짝")
        assert mobile.locator(".chance").all_inner_texts() == ["32%", "18%", "8%", "1.2%"]
        if width == 390:
            mobile.wait_for_function("document.querySelector('canvas[data-monster]').dataset.loaded === 'true'")
            mobile.screenshot(path="/tmp/leaftale-bestiary-mobile.png", full_page=True)
        mobile.close()
    assert not errors, errors
    print("PASS: live loot values, item lore, regions/maps/ranks, search, sorting, pagination, all-entry print, HTML download, offline document and 320/390/768px layouts")
    browser.close()
