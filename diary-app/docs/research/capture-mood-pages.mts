import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
const folder='docs/research/evidence/chinese-expanded/mood';await mkdir(folder,{recursive:true});
const products=[['card',1295506659],['heartisland',1530149693],['moo',1473250948],['moodhelper',6502696370],['mooda',6449689589]] as const;
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({locale:'zh-CN',viewport:{width:1440,height:1100}});
 for(const [key,id] of products){
  const p=await context.newPage();
  try{
   const r=await p.goto('https://apps.apple.com/cn/app/id'+id,{waitUntil:'domcontentloaded',timeout:45000});
   await p.waitForTimeout(2000);
   await writeFile(folder+'/'+key+'-page.txt',await p.locator('body').innerText());
   await p.screenshot({path:folder+'/'+key+'-page.png',fullPage:true});
   const meta=await p.evaluate(()=>({title:document.title,url:location.href,links:Array.from(document.querySelectorAll('a')).map(a=>({text:a.textContent,url:a.href})).filter(a=>/隐私|开发者|网站|Privacy|Terms|Developer/.test(a.text||'')),pictures:Array.from(document.querySelectorAll('picture')).map(el=>({src:el.querySelector('source')?.getAttribute('srcset'),alt:el.querySelector('img')?.alt,html:el.outerHTML})).filter(v=>v.src?.includes('/300x650'))}));
   await writeFile(folder+'/'+key+'-meta.json',JSON.stringify({status:r?.status(),...meta},null,2));
   const unique=[...new Map(meta.pictures.map(v=>{const src=v.src!.split(',').map(x=>x.trim().split(' ')[0]).find(x=>/600x|626x/.test(x))||v.src!.split(',')[0].split(' ')[0];return[src,src]})).values()];
   const gallery=await context.newPage();
   await gallery.setContent('<style>body{margin:20px;background:#eee}main{display:flex;flex-wrap:wrap;gap:15px}article{width:300px}img{width:300px;display:block}p{font:16px system-ui}</style><main>'+unique.map((url,i)=>'<article><p>Official gallery '+(i+1)+'</p><img src="'+url+'"></article>').join('')+'</main>');
   await gallery.evaluate(()=>Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r}))));
   await gallery.screenshot({path:folder+'/'+key+'-gallery.png',fullPage:true});await gallery.close();
   console.log(key+': '+meta.title+' | gallery '+unique.length+' | links '+JSON.stringify(meta.links));
  }catch(e){console.log(key+' FAILED '+String(e));await writeFile(folder+'/'+key+'-error.txt',String(e));}
  await p.close();
 }
}finally{await browser.close();}
