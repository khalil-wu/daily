import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('./evidence/chinese-expanded/capture/', import.meta.url));
await mkdir(dir, { recursive: true });
const targets = [['wuji', 1084747109], ['real', 1625209452], ['shengjian', 6739978476], ['flomo', 1552314395], ['yiyan', 1010174792]];
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [name, id] of targets) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
    const page = await context.newPage();
    try {
      const url = `https://apps.apple.com/cn/app/id${id}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('body').waitFor();
      await writeFile(`${dir}${name}-page.txt`, await page.locator('body').innerText());
      const meta = await page.evaluate(() => ({ url: location.href, title: document.title,
        links: [...document.querySelectorAll('a')].map(a => ({ text: a.textContent, url: a.href })),
        pictures: [...document.querySelectorAll('picture')].map(p => ({ srcset: p.querySelector('source')?.srcset, width: p.querySelector('img')?.width, height: p.querySelector('img')?.height })),
      }));
      await writeFile(`${dir}${name}-meta.json`, JSON.stringify(meta, null, 2));
      await page.screenshot({ path: `${dir}${name}-appstore.png`, fullPage: true });
      const urls = [...new Set(meta.pictures.filter(p => p.srcset && p.height > p.width * 1.5 && p.width >= 150).map(p => {
        const srcs = p.srcset.split(',').map(s => s.trim().split(/\s+/));
        return srcs.find(s => Number(s[1]?.replace('w', '')) >= 500)?.[0] || srcs[0][0];
      }))];
      await page.setContent('<html lang="zh-CN"><body style="margin:0;padding:24px;background:#e9e9e9;font-family:system-ui"><h1>' + name + ' · 当前商店公开图库</h1><p>2026-11-21 · 宣传图不等同实际安装版本或动效实测</p><div style="display:flex;gap:18px;flex-wrap:wrap">' + urls.map((src, i) => `<div><p>${i + 1}</p><img style="width:260px;display:block" src="${src}"></div>`).join('') + '</div></body></html>');
      await page.waitForFunction(() => [...document.images].every(i => i.complete), { timeout: 25000 });
      const broken = await page.evaluate(() => [...document.images].filter(i => !i.naturalWidth).length);
      await page.screenshot({ path: `${dir}${name}-gallery.png`, fullPage: true });
      results.push({ name, url, galleryImages: urls.length, broken });
    } catch (error) { results.push({ name, error: String(error) }); }
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${dir}capture-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
