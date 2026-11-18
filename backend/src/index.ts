import mongoose from 'mongoose'
import {createApp} from './app.js'
import * as models from './models.js'
import {passwordHash,protectMfaSecret,roles} from './auth.js'
import {z} from 'zod'

const port=Number(process.env.PORT||4000)
const mongo=process.env.MONGODB_URI
if(!mongo) throw new Error('Set MONGODB_URI before starting the API.')
z.coerce.number().int().min(1).max(3650).parse(process.env.RETENTION_DAYS||180)
if(process.env.NODE_ENV==='production'){
  z.url({protocol:/^https$/}).parse(process.env.PUBLIC_ORIGIN)
  z.string().regex(/^[a-f0-9]{64}$/i).parse(process.env.MFA_ENCRYPTION_KEY)
}
await mongoose.connect(mongo)
await Promise.all(Object.values(models).map(model=>model.init()))
if(process.argv.includes('--provision-admin')){
  const email=z.email().parse(process.env.PROVISION_EMAIL).toLowerCase()
  const password=z.string().min(14).max(128).parse(process.env.PROVISION_PASSWORD)
  const role=z.enum(roles).parse(process.env.PROVISION_ROLE)
  const mfaSecret=z.string().regex(/^[A-Z2-7]{32,64}$/).parse(process.env.PROVISION_MFA_SECRET)
  await models.AdminUser.create({email,passwordHash:passwordHash(password),role,mfaSecret:protectMfaSecret(mfaSecret)})
  await mongoose.disconnect()
}else{
  const server=createApp().listen(port,()=>console.log('Rapid Nova API listening on port '+port))
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>server.close(()=>void mongoose.disconnect()))
}
