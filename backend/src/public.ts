import {Router} from 'express'
import type {Request,Response} from 'express'
import {randomUUID} from 'node:crypto'
import {rateLimit} from 'express-rate-limit'
import multer from 'multer'
import {application,contact,referral,transport} from '../../shared/schemas.js'
import * as db from './models.js'
import {notify} from './notifications.js'

export const publicApi=Router()
const limited=rateLimit({windowMs:15*60_000,limit:30})
for(const [path,collection] of Object.entries({services:db.Service,'service-areas':db.ServiceArea,careers:db.Career})){
  publicApi.get('/'+path,async (_req,res)=>{res.json({data:await collection.find({published:true}).sort('title').limit(500).lean()})})
  publicApi.get('/'+path+'/:slug',async(req,res)=>{
    const data=await collection.findOne({published:true,slug:req.params.slug}).lean()
    if(!data){res.status(404).json({error:'Page unavailable.'});return}
    res.json({data})
  })
}
publicApi.get('/faqs',async(_req,res)=>{res.json({data:await db.FAQ.find({published:true}).sort('order').limit(100).lean()})})
publicApi.get('/testimonials',async(_req,res)=>{res.json({data:await db.Testimonial.find({published:true}).limit(30).lean()})})
publicApi.get('/settings/public',async(_req,res)=>{res.json({data:await db.SiteSettings.findOne({key:'public'}).lean() ?? {}})})
const expires = () => new Date(Date.now()+Number(process.env.RETENTION_DAYS||180)*86400000)
const reference = (prefix:string) => prefix+'-'+randomUUID().toUpperCase()
const unavailable=(res:Response)=>res.status(422).json({error:'That selection is no longer available. Refresh the page and try again.'})

publicApi.post('/transport-inquiries',limited,async(req,res)=>{
  const data=transport.parse(req.body)
  if(data.category!=='general' && !await db.Service.exists({slug:data.category,published:true})){unavailable(res);return}
  if(data.area!=='unconfirmed' && !await db.ServiceArea.exists({slug:data.area,published:true})){unavailable(res);return}
  const id=reference('RN')
  await db.TransportInquiry.create({...data,reference:id,expiresAt:expires(),history:[{status:'New',actor:'public',at:new Date()}]})
  try{await notify(id,data.email)}catch{console.error('Unable to persist notification status')}
  res.status(201).json({data:{reference:id}})
})
for(const [path,schema,collection,prefix] of [
  ['/referral-inquiries',referral,db.FacilityReferralInquiry,'RF'],
  ['/contact',contact,db.ContactInquiry,'CT'],
] as const){
  publicApi.post(path,limited,async(req,res)=>{
    const id=reference(prefix)
    await collection.create({...schema.parse(req.body),reference:id,expiresAt:expires()})
    res.status(201).json({data:{reference:id}})
  })
}
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1,fields:5,parts:7,fieldSize:2000}})
export function validResume(file:Request['file']){
  return Boolean(file && file.mimetype==='application/pdf' && file.buffer.subarray(0,5).toString()==='%PDF-' &&
    /%%EOF\s*$/.test(file.buffer.subarray(-128).toString('latin1')))
}
publicApi.post('/job-applications',limited,upload.single('resume'),async(req,res)=>{
  if(!validResume(req.file)){res.status(422).json({error:'Upload a PDF resume of up to 2 MB.'});return}
  const data=application.parse(req.body)
  if(!await db.Career.exists({slug:data.position,published:true})){unavailable(res);return}
  const id=reference('JA')
  await db.JobApplication.create({...data,resume:req.file!.buffer,reference:id,expiresAt:expires()})
  res.status(201).json({data:{reference:id}})
})
