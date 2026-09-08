import asyncio, os
from playwright.async_api import async_playwright

DIR = '/home/z/my-project/analysis/diagrams'
JOBS = [
    ('fig1_architecture.html',   'fig1_architecture.png',   1500),
    ('fig2_naming.html',         'fig2_naming.png',         1680),
    ('fig3_router.html',         'fig3_router.png',         1200),
    ('fig4_reference_data.html', 'fig4_reference_data.png', 1560),
    ('fig5_walkthrough.html',    'fig5_walkthrough.png',    1280),
]

async def render(page, html_name, png_name, width):
    html_path = os.path.join(DIR, html_name)
    out_path = os.path.join(DIR, png_name)
    await page.set_viewport_size({'width': width, 'height': 900})
    await page.goto(f'file://{html_path}', wait_until='networkidle')
    await page.wait_for_timeout(400)
    el = page.locator('#root')
    bbox = await el.bounding_box()
    if bbox:
        fit_w = max(width, int(bbox['width'] + 100))
        fit_h = int(bbox['height'] + 100)
        await page.set_viewport_size({'width': fit_w, 'height': fit_h})
        await page.wait_for_timeout(250)
    await el.screenshot(path=out_path)
    print(f'OK {png_name} ({os.path.getsize(out_path)/1024:.0f} KB)')

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1400, 'height': 900}, device_scale_factor=2)
        for html_name, png_name, width in JOBS:
            await render(page, html_name, png_name, width)
        await browser.close()

asyncio.run(main())
