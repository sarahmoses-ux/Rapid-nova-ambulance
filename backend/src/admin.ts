import {Router} from 'express'
import {Types} from 'mongoose'
import {z} from 'zod'
import {statuses} from '../../shared/schemas.js'
import {allow,authenticate,roles} from './auth.js'
import * as db from './models.js'

export const admin=Router()
admin.use(authenticate)
const text=z.string().trim().max(5000)
const title=text.min(2).max(150)
const slug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100)
const url=z.url({protocol:/^https$/}).or(z.literal(''))
const image=url.or(z.string().regex(/^\/(?!\/)[a-zA-Z0-9/_\-.]+$/))
const faq=z.strictObject({question:title,answer:text.min(2)})
const publication={title,slug,description:text.min(2),published:z.boolean(),image:image.optional()}
const resources={
  transport:[db.TransportInquiry,'operations'],referrals:[db.FacilityReferralInquiry,'operations'],
  contacts:[db.ContactInquiry,'operations'],applications:[db.JobApplication,'recruitment'],
  notifications:[db.Notification,'operations'],audit:[db.AuditLog,'audit'],users:[db.AdminUser,'users'],
  services:[db.Service,'content',z.strictObject({...publication,audience:text.optional(),benefits:z.array(text).max(15).optional(),faqs:z.array(faq).max(20).optional()})],
  areas:[db.ServiceArea,'content',z.strictObject({...publication,phone:text.optional(),mapUrl:url.optional(),services:z.array(slug).max(50).optional(),faqs:z.array(faq).max(20).optional()})],
  careers:[db.Career,'recruitment',z.strictObject({...publication,location:title,employmentType:title})],
  faqs:[db.FAQ,'content',faq.extend({published:z.boolean(),order:z.number().int().min(0)})],
  testimonials:[db.Testimonial,'content',z.strictObject({name:title,quote:text.min(2),published:z.boolean()})],
} as const
const settings=z.strictObject({
  phone:text.optional(),email:z.email().or(z.literal('')).optional(),hours:text.optional(),location:text.optional(),mapUrl:url.optional(),
  billingEmail:z.email().or(z.literal('')).optional(),socials:z.array(url).max(8).optional(),announcement:text.optional(),
  heroHeadline:title.optional(),heroCopy:text.optional(),heroImage:image.optional(),aboutCopy:text.optional(),
  strengths:z.array(title).max(12).optional(),credentials:z.array(title).max(12).optional(),team:z.array(title).max(20).optional(),
  privacy:text.optional(),terms:text.optional(),accessibility:text.optional(),npp:text.optional(),
})
const audit=(actor:string,action:string,resource:string,record:string)=>db.AuditLog.create({actor,action,resource,record})
const id=z.string().regex(/^[a-f\d]{24}$/i)
admin.get('/overview',async(_req,res)=>{
  const role=res.locals.user.role
  const operations=['Super Admin','Administrator','Dispatch Staff'].includes(role)
  const recruitment=['Super Admin','Administrator','Recruitment Staff'].includes(role)
  const [counts,referrals,applications,recent]=await Promise.all([
    operations?db.TransportInquiry.aggregate([{ $match:{archivedAt:null} },{$group:{_id:'$status',count:{$sum:1}}}]):[],
    operations?db.FacilityReferralInquiry.countDocuments({archivedAt:null}):null,
    recruitment?db.JobApplication.countDocuments({archivedAt:null}):null,
    operations?db.TransportInquiry.find({archivedAt:null}).select('reference status createdAt').sort('-createdAt').limit(8).lean():[],
  ])
  res.json({data:{counts,referrals,applications,recent}})
})
admin.get('/settings',allow('settings'),async(_req,res)=>{res.json({data:await db.SiteSettings.findOne({key:'public'}).lean() ?? {}})})
admin.put('/settings',allow('settings'),async(req,res)=>{
  const data=await db.SiteSettings.findOneAndUpdate({key:'public'},{$set:settings.parse(req.body)},{new:true,upsert:true})
  await audit(res.locals.user.id,'update','settings',data.id)
  res.json({data})
})
for(const [resource,[collection,permission,schema]] of Object.entries(resources)){
  const base='/'+resource
  admin.get(base,allow(permission),async(req,res)=>{
    const page=z.coerce.number().int().min(1).max(10000).catch(1).parse(req.query.page)
    const query=z.string().trim().max(80).catch('').parse(req.query.q)
    const status=z.enum(statuses).safeParse(req.query.status)
    const filter:Record<string,unknown>={}
    if(query){
      const regex=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i')
      filter.$or=Object.keys(collection.schema.paths).filter(k=>['reference','title','email','name','question','action'].includes(k)).map(key=>({[key]:regex}))
      if(!(filter.$or as unknown[]).length) delete filter.$or
    }
    if(collection.schema.path('archivedAt')) filter.archivedAt=req.query.archived==='true'?{$ne:null}:null
    if(status.success && collection.schema.path('archivedAt')) filter.status=status.data
    const projection=resource==='users'?'email role active createdAt':undefined
    const [data,total]=await Promise.all([collection.find(filter,projection).sort('-createdAt').skip((page-1)*20).limit(20).lean(),collection.countDocuments(filter)])
    res.json({data,page,total})
  })
  if(schema){
    admin.post(base,allow(permission),async(req,res)=>{
      const data=await collection.create(schema.parse(req.body))
      await audit(res.locals.user.id,'create',resource,data.id)
      res.status(201).json({data})
    })
    admin.put(base+'/:id',allow(permission),async(req,res)=>{
      const data=await collection.findByIdAndUpdate(id.parse(req.params.id),{$set:schema.parse(req.body)},{new:true,runValidators:true})
      if(!data){res.status(404).json({error:'Record unavailable.'});return}
      await audit(res.locals.user.id,'update',resource,data.id)
      res.json({data})
    })
  }
}
const update=z.strictObject({status:z.enum(statuses).optional(),assignedTo:id.nullable().optional(),note:z.string().trim().min(1).max(500).optional(),archive:z.boolean().optional()})
admin.patch('/transport/:id',allow('operations'),async(req,res)=>{
  const {status,assignedTo,note,archive}=update.parse(req.body)
  const actor=res.locals.user.id
  if(assignedTo && !await db.AdminUser.exists({_id:assignedTo,active:true,role:{$in:['Super Admin','Administrator','Dispatch Staff']}})){
    res.status(422).json({error:'Select an active dispatch user.'});return
  }
  const set:Record<string,unknown>={},push:Record<string,unknown>={}
  if(status){set.status=status;push.history={status,actor,at:new Date()}}
  if(assignedTo!==undefined) set.assignedTo=assignedTo?new Types.ObjectId(assignedTo):null
  if(note) push.notes={text:note,actor,at:new Date()}
  if(archive!==undefined) set.archivedAt=archive?new Date():null
  const data=await db.TransportInquiry.findByIdAndUpdate(id.parse(req.params.id),{$set:set,$push:push},{new:true,runValidators:true})
  if(!data){res.status(404).json({error:'Record unavailable.'});return}
  await audit(actor,'update','transport',data.id)
  res.json({data})
})
for(const [resource,collection,permission] of [
  ['referrals',db.FacilityReferralInquiry,'operations'],
  ['contacts',db.ContactInquiry,'operations'],
  ['applications',db.JobApplication,'recruitment'],
] as const){
  admin.patch('/'+resource+'/:id',allow(permission),async(req,res)=>{
    const patch=z.strictObject({status:z.enum(statuses)}).parse(req.body)
    const data=await collection.findByIdAndUpdate(id.parse(req.params.id),{$set:patch},{new:true,runValidators:true})
    if(!data){res.status(404).json({error:'Record unavailable.'});return}
    await audit(res.locals.user.id,'update',resource,data.id)
    res.json({data})
  })
}
admin.get('/dispatch-users',allow('operations'),async(_req,res)=>{
  res.json({data:await db.AdminUser.find({active:true,role:{$in:['Super Admin','Administrator','Dispatch Staff']}}).select('email').lean()})
})
admin.patch('/users/:id',allow('users'),async(req,res)=>{
  const target=id.parse(req.params.id)
  if(target===res.locals.user.id){res.status(422).json({error:'Another Super Admin must manage your account.'});return}
  const patch=z.strictObject({role:z.enum(roles),active:z.boolean()}).parse(req.body)
  if(patch.role==='Super Admin'){res.status(422).json({error:'Super Admin role changes require offline provisioning.'});return}
  const data=await db.AdminUser.findOneAndUpdate({_id:target,role:{$ne:'Super Admin'}},{$set:patch},{new:true}).select('email role active')
  if(!data){res.status(422).json({error:'Super Admin role changes require offline provisioning.'});return}
  await db.Session.deleteMany({userId:target})
  await audit(res.locals.user.id,'update','users',target)
  res.json({data})
})
admin.get('/applications/:id/resume',allow('recruitment'),async(req,res)=>{
  const record=await db.JobApplication.findById(id.parse(req.params.id)).select('+resume')
  if(!record?.resume){res.status(404).json({error:'Resume unavailable.'});return}
  await audit(res.locals.user.id,'download','applications',record.id)
  res.set({'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="resume.pdf"'}).send(Buffer.from(record.resume as Buffer))
})
