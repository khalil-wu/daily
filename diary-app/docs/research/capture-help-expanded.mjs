import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('./evidence/chinese-expanded/capture/', import.meta.url));
const targets = [
  ['flomo-voice','https://help.flomoapp.com/ai/aivoice.html'],
  ['flomo-review','https://help.flomoapp.com/advance/lucky.html'],
  ['flomo-storage','https://help.flomoapp.com/basic/storage.html'],
  ['flomo-passcode','https://help.flomoapp.com/advance/passcode.html'],
  ['flomo-privacy','https://help.flomoapp.com/privacy.html'],
  ['wuji-site','https://wujiapp.com/'],
  ['wuji-privacy','http://www.xiejianji.com/policy_wujiiOS.html'],
  ['real-privacy','https://reminder.iofree.xyz/privacy/'],
  ['real-description-privacy','https://friends.iofree.xyz/privacy/'],
  ['shengjian-privacy','https://branch-mountain-80d.notion.site/Privacy-Policy-inVoice-16f33667df918071b000d3149eefd998?pvs=73'],
  ['yiyan-privacy','https://app.yiyan.art/yiyan/View/yanyanprivacy.html'],
];
const browser=await chromium.launch({headless:true}); const results=[];
try{
 for(let i=0;i<targets.length;i+=3){
  const batch=await Promise.allSettled(targets.slice(i,i+3).map(async([name,url])=>{
   const context=await browser.newContext({viewport:{width:1280,height:900},locale:'zh-CN'});const page=await context.newPage();
   try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
    if(name==='shengjian-privacy') await page.waitForFunction(()=>document.body.innerText.length>400,{timeout:12000}).catch(()=>{});
    await writeFile(`${dir}${name}.txt`,await page.locator('body').innerText());
    const meta=await page.evaluate(()=>({url:location.href,title:document.title,links:[...document.querySelectorAll('a')].map(a=>({text:a.textContent,url:a.href})),images:[...document.images].map(i=>({src:i.currentSrc,alt:i.alt}))}));
    await writeFile(`${dir}${name}.json`,JSON.stringify(meta,null,2));
    await page.screenshot({path:`${dir}${name}.png`,fullPage:true});
    return {name,url:page.url(),status:response?.status(),textLength:(await page.locator('body').innerText()).length};
   }catch(error){return {name,url,error:String(error)};}finally{await context.close();}
  }));results.push(...batch);
 }
}finally{await browser.close();}
await writeFile(`${dir}help-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
