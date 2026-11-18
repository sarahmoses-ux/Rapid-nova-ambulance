import express from 'express'
import type {Request,Response,NextFunction} from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import {rateLimit} from 'express-rate-limit'
import {z,ZodError} from 'zod'
import {authenticate,cookieOptions,digest,mfaCounter,passwordHash,passwordMatches,permissions,token} from './auth.js'
import {AdminUser,AuditLog,Session} from './models.js'
import {mail} from './notifications.js'
import {publicApi} from './public.js'
import {admin} from './admin.js'

export function createApp(origin=process.env.PUBLIC_ORIGIN || 'http://localhost:5173'){
  const app=express()
  app.disable('x-powered-by')
  if(process.env.TRUST_PROXY==='1') app.set('trust proxy',1)
  app.use(helmet(),cors({origin,credentials:true}),cookieParser(),express.json({limit:'32kb'}))
  app.use('/api',(req,res,next)=>{
    if(process.env.NODE_ENV==='production'&&!req.secure){res.status(400).json({error:'HTTPS required.'});return}
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('Origin')!==origin){res.status(403).json({error:'Request origin rejected.'});return}
    if(req.path.startsWith('/admin')||req.path.startsWith('/auth')) res.set('Cache-Control','no-store')
    next()
  })
  const authLimit=rateLimit({windowMs:15*60_000,limit:15})
  const email=z.email().transform(x=>x.toLowerCase())
  const password=z.string().min(14).max(128)
  app.post('/api/auth/login',authLimit,async(req,res)=>{
    const credentials=z.strictObject({email,password:z.string().min(1).max(128),code:z.string().regex(/^\d{6}$/)}).parse(req.body)
    const user=await AdminUser.findOne({email:credentials.email,active:true}).select('+mfaSecret')
    const matches=passwordMatches(credentials.password,typeof user?.passwordHash==='string'?user.passwordHash:undefined)
    const counter=typeof user?.mfaSecret==='string'?mfaCounter(user.mfaSecret,credentials.code):undefined
    if(!user||!matches||counter===undefined||!permissions[String(user.role)]){
      res.status(401).json({error:'Check your email, password and authenticator code.'});return
    }
    const accepted=await AdminUser.updateOne({_id:user.id,active:true,$or:[{lastMfaCounter:{$lt:counter}},{lastMfaCounter:{$exists:false}}]},{$set:{lastMfaCounter:counter}})
    if(!accepted.modifiedCount){res.status(401).json({error:'Wait for a fresh authenticator code.'});return}
    const sid=token(),maxAge=8*60*60_000
    await Session.create({tokenHash:digest(sid),userId:user.id,expiresAt:new Date(Date.now()+maxAge)})
    await AuditLog.create({actor:user.id,action:'login',resource:'users',record:user.id})
    res.cookie('rn_session',sid,{...cookieOptions,maxAge}).json({data:{email:user.email,role:user.role,permissions:permissions[String(user.role)]}})
  })
  app.post('/api/auth/logout',async(req,res)=>{
    if(typeof req.cookies.rn_session==='string') await Session.deleteOne({tokenHash:digest(req.cookies.rn_session)})
    res.clearCookie('rn_session',cookieOptions).status(204).end()
  })
  app.get('/api/auth/me',authenticate,(_req,res)=>{
    const user=res.locals.user
    res.json({data:{email:user.email,role:user.role,permissions:permissions[String(user.role)]}})
  })
  app.post('/api/auth/forgot-password',authLimit,async(req,res)=>{
    const data=z.strictObject({email}).parse(req.body)
    const secret=token()
    const user=await AdminUser.findOneAndUpdate({email:data.email,active:true},{$set:{resetHash:digest(secret),resetExpires:new Date(Date.now()+20*60_000)}})
    if(user) void mail(String(user.email),'Staff password reset',origin+'/admin/reset#'+secret)?.catch(()=>console.error('Password reset email failed'))
    res.status(202).json({data:{accepted:true}})
  })
  app.post('/api/auth/reset-password',authLimit,async(req,res)=>{
    const data=z.strictObject({token:z.string().regex(/^[a-f0-9]{64}$/),password}).parse(req.body)
    const user=await AdminUser.findOneAndUpdate({active:true,resetHash:digest(data.token),resetExpires:{$gt:new Date()}},{$set:{passwordHash:passwordHash(data.password)},$unset:{resetHash:1,resetExpires:1}})
    if(!user){res.status(422).json({error:'Reset link expired or invalid.'});return}
    await Session.deleteMany({userId:user.id})
    await AuditLog.create({actor:user.id,action:'password-reset',resource:'users',record:user.id})
    res.status(204).end()
  })
  app.use('/api/admin',admin)
  app.use('/api',publicApi)
  app.use((_req,res)=>{res.status(404).json({error:'Page unavailable.'})})
  app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    void _next
    if(err instanceof ZodError){res.status(422).json({error:'Check the submitted fields.',fields:err.issues.map(issue=>issue.path.join('.'))});return}
    if(err instanceof multer.MulterError){res.status(422).json({error:'Upload one PDF resume of up to 2 MB.'});return}
    if(err && typeof err==='object' && 'code' in err && err.code===11000){res.status(409).json({error:'That record already exists.'});return}
    if(err && typeof err==='object' && 'status' in err && err.status===413){res.status(413).json({error:'Request body is too large.'});return}
    if(err instanceof SyntaxError){res.status(400).json({error:'Invalid request body.'});return}
    console.error('Unhandled API error')
    res.status(500).json({error:'The request could not be completed. Please try again.'})
  })
  return app
}
