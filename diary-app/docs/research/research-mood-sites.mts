import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const folder='docs/research/evidence/chinese-expanded/mood';
const sites=[['card-site','https://carddiary.me/'],['card-privacy','https://carddiary.me/PrivacyPolicy.html'],['heartisland-privacy','http://xindaoapp.com.cn/privacy_policy.html'],['moo-privacy','https://c.aiyouaiyou.cn/WebResource/page/spa/privacy-policy-moo-ios.html'],['moodhelper-privacy','https://aboutkoan.notion.site/f2bb299d9d994d4fb74ed9ac8edee5c5?pvs=4'],['mooda-privacy','https://docs.mooda.me/en-privacy'],['analoglab','https://analoglab.io/']];
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({locale:'zh-CN',viewport:{width:1440,height:1100}});
 for(const [key,url] of sites){const p=await context.newPage();try{
 const r=await p.goto(url,{waitUntil:'domcontentloaded',timeout:25000});await p.waitForTimeout(1200);
 await writeFile(folder+'/'+key+'.txt',await p.locator('body').innerText());await p.screenshot({path:folder+'/'+key+'.png',fullPage:true});
 const meta=await p.evaluate(()=>({title:document.title,url:location.href,links:Array.from(document.querySelectorAll('a')).map(a=>({text:a.textContent,url:a.href}))}));
 await writeFile(folder+'/'+key+'-meta.json',JSON.stringify({status:r?.status(),...meta},null,2));console.log(key+': '+r?.status()+' '+meta.title);
 }catch(e){await writeFile(folder+'/'+key+'-error.txt',String(e));console.log(key+': '+String(e));}await p.close();}
}finally{await browser.close();}
