import {afterAll,beforeAll,expect,it} from 'vitest'
import mongoose from 'mongoose'
import {MongoMemoryServer} from 'mongodb-memory-server'
import request from 'supertest'
import {createApp} from './app.js'
import {AdminUser,AuditLog,Service,Session,TransportInquiry} from './models.js'
import {digest} from './auth.js'

const enabled=process.env.TEST_MONGO==='1'
let mongo:MongoMemoryServer|undefined
const origin='http://localhost:5173'
const api=request(createApp(origin))
beforeAll(async()=>{
  if(!enabled) return
  const uri=process.env.TEST_MONGO_URI
  if(uri && !/^mongodb:\/\/(?:localhost|127\.0\.0\.1):\d+\//.test(uri)) throw new Error('TEST_MONGO_URI must point to a disposable local MongoDB instance.')
  if(!uri) mongo=await MongoMemoryServer.create({instance:{launchTimeout:60000}})
  const connection=uri || mongo!.getUri()
  await mongoose.connect(connection,{dbName:'rapid_nova_test_'+process.pid})
  await Promise.all([Service.init(),TransportInquiry.init(),Session.init(),AdminUser.init()])
},600000)
afterAll(async()=>{if(mongoose.connection.readyState===1) await mongoose.connection.dropDatabase();await mongoose.disconnect();await mongo?.stop()})
it.runIf(enabled)('publishes verified listings, persists inquiries and reflects staff changes in actual metrics',async()=>{
  await Service.create([{title:'Synthetic verified',slug:'synthetic-verified',description:'Test fixture',published:true},{title:'Draft fixture',slug:'draft-fixture',description:'Test fixture',published:false}])
  const listings=await api.get('/api/services').expect(200)
  expect(listings.body.data.map((item:{slug:string})=>item.slug)).toEqual(['synthetic-verified'])
  await api.get('/api/services/draft-fixture').expect(404)
  const result=await api.post('/api/transport-inquiries').set('Origin',origin).send({
    name:'Synthetic Test',email:'test@example.invalid',phone:'555-010-0100',method:'phone',category:'synthetic-verified',area:'unconfirmed',callback:'',consent:true,
  }).expect(201)
  const record=await TransportInquiry.findOne({reference:result.body.data.reference})
  expect(record?.status).toBe('New')
  const user=await AdminUser.create({email:'dispatch@example.invalid',passwordHash:'test-fixture',role:'Dispatch Staff'})
  await Session.create({tokenHash:digest('synthetic-session'),userId:user.id,expiresAt:new Date(Date.now()+60_000)})
  const cookie='rn_session=synthetic-session'
  await api.patch('/api/admin/transport/'+record?.id).set('Origin',origin).set('Cookie',cookie).send({status:'Confirmed',assignedTo:user.id,note:'Synthetic note'}).expect(200)
  const summary=await api.get('/api/admin/overview').set('Cookie',cookie).expect(200)
  expect(summary.body.data.counts).toEqual([{_id:'Confirmed',count:1}])
  expect(await AuditLog.countDocuments({resource:'transport'})).toBe(1)
})
