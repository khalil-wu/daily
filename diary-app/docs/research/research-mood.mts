import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const folder='docs/research/evidence/chinese-expanded/mood';
await mkdir(folder,{recursive:true});
const terms=['卡片日记','心岛日记','小情绪','MOODA','Mori手帐'];
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({locale:'zh-CN',viewport:{width:1440,height:1100}});
 for(const term of terms){
  const r=await context.request.get('https://itunes.apple.com/search?'+new URLSearchParams({term,country:'cn',entity:'software',limit:'12'}),{timeout:45000});
  const json=await r.json();
  await writeFile(folder+'/'+term+'-search.json',JSON.stringify(json,null,2));
  console.log(JSON.stringify({term,results:json.results.map((v:any)=>({name:v.trackName,id:v.trackId,seller:v.sellerName,artist:v.artistName,url:v.trackViewUrl,version:v.version,site:v.sellerUrl,price:v.formattedPrice}))}));
 }
}finally{await browser.close();}
