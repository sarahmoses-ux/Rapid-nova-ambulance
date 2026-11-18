import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {join} from 'node:path'

const dist=fileURLToPath(new URL('../dist/',import.meta.url))
const origin=process.env.SITE_ORIGIN ? new URL(process.env.SITE_ORIGIN).origin : ''
const api=process.env.SEO_PUBLIC_API_BASE?.replace(/\/$/,'')
const html=await readFile(join(dist,'index.html'),'utf8')
const pages=new Map([
  ['/',['Medical Transportation','Explore transportation inquiry resources for patients, families and healthcare facilities.']],
  ['/about',['About Us','Learn about Rapid Nova Ambulance and our approach to transportation inquiries.']],
  ['/services',['Services','Explore verified medical transportation services and inquire about availability.']],
  ['/service-areas',['Service Areas','Find confirmed Texas service areas.']],
  ['/patient-resources',['Patient Resources','Find answers to common transportation questions.']],
  ['/careers',['Careers','Explore published openings at Rapid Nova Ambulance.']],
  ['/contact',['Contact Us','Submit a business, billing or general inquiry.']],
  ['/request-transport',['Request Transport','Submit a scheduled transportation inquiry.']],
  ['/referrals',['Facility Referrals','Start a conversation about facility referrals and partnerships.']],
  ['/billing',['Insurance and Billing','Ask about billing, coverage, self-pay or transportation estimates.']],
])
const get=async path=>{
  const response=await fetch(api+path,{signal:AbortSignal.timeout(5000)})
  if(!response.ok) throw new Error('SEO data request failed for '+path)
  return (await response.json()).data
}
let settings={}
if(api){
  const result=await Promise.all(['/services','/service-areas','/careers','/settings/public'].map(get))
  for(const [index,route] of ['/services','/service-areas','/careers'].entries()){
    for(const item of result[index]){
      if(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) pages.set(route+'/'+item.slug,[item.title,item.description.slice(0,155)])
    }
  }
  settings=result[3]
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
const image=origin+ '/ambulance.jpg'
for(const [path,[name,description]] of pages){
  const title=path==='/'?'Rapid Nova Ambulance | '+name:name+' | Rapid Nova Ambulance'
  const canonical=origin?'<link rel="canonical" href="'+escape(origin+path)+'"><meta property="og:url" content="'+escape(origin+path)+'"><meta property="og:image" content="'+escape(image)+'">':'<meta name="robots" content="noindex, nofollow">'
  const organization=path==='/'&&origin?'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'Organization',name:'Rapid Nova Ambulance',url:origin,telephone:settings.phone||undefined,email:settings.email||undefined}).replace(/</g,'\\u003c')+'</script>':''
  const metadata='<meta name="description" content="'+escape(description)+'"><title>'+escape(title)+'</title><meta property="og:title" content="'+escape(title)+'"><meta property="og:description" content="'+escape(description)+'"><meta property="og:type" content="website">'+canonical+organization
  const target=join(dist,path)
  await mkdir(target,{recursive:true})
  await writeFile(join(target,'index.html'),html.replace(/<meta name="description"[^>]+><title>[^<]+<\/title>/,()=>metadata))
}
await writeFile(join(dist,'robots.txt'),origin?'User-agent: *\nDisallow: /admin\nDisallow: /api\nSitemap: '+origin+'/sitemap.xml\n':'User-agent: *\nDisallow: /\n')
await writeFile(join(dist,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+(origin?[...pages.keys()].map(path=>'<url><loc>'+escape(origin+path)+'</loc></url>').join(''):'')+'</urlset>')
