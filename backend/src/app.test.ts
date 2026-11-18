import {afterEach,describe,expect,it,vi} from 'vitest'
import request from 'supertest'
import {createHmac} from 'node:crypto'
import {createApp} from './app.js'
import {AdminUser,Notification,Session,TransportInquiry} from './models.js'
import {passwordHash} from './auth.js'
import nodemailer from 'nodemailer'

const origin='http://localhost:5173'
const app=createApp(origin)
const payload={name:'Synthetic Test',email:'test@example.invalid',phone:'555-010-0100',method:'phone',category:'general',area:'unconfirmed',callback:'',consent:true}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()})
function code(){
  const time=Buffer.alloc(8)
  time.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)))
  const mac=createHmac('sha1',Buffer.alloc(20)).update(time).digest()
  return String((mac.readUInt32BE(mac[19]&15)&0x7fffffff)%1000000).padStart(6,'0')
}
describe('public API',()=>{
  it('rejects untrusted mutation origins',async()=>{
    await request(app).post('/api/transport-inquiries').set('Origin','https://untrusted.invalid').send(payload).expect(403)
  })
  it('rejects medical fields and malformed contact information',async()=>{
    await request(app).post('/api/transport-inquiries').set('Origin',origin).send({...payload,patientName:'Synthetic'}).expect(422)
    await request(app).post('/api/transport-inquiries').set('Origin',origin).send({...payload,email:'invalid'}).expect(422)
  })
  it('persists an inquiry and records a delivery failure without rejecting the inquiry',async()=>{
    vi.stubEnv('SMTP_URL','smtp://unused.invalid')
    vi.stubEnv('MAIL_FROM','staff@example.invalid')
    vi.stubEnv('STAFF_EMAIL','staff@example.invalid')
    vi.spyOn(nodemailer,'createTransport').mockImplementation(()=>({sendMail:async()=>{throw new Error('offline')}}) as never)
    const create=vi.spyOn(TransportInquiry,'create').mockResolvedValue({} as never)
    const notifications=vi.spyOn(Notification,'create').mockResolvedValue({} as never)
    const {body}=await request(app).post('/api/transport-inquiries').set('Origin',origin).send(payload).expect(201)
    expect(body.data.reference).toMatch(/^RN-/)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({reference:body.data.reference,category:'general'}))
    expect(notifications).toHaveBeenCalledWith(expect.objectContaining({recipientType:'requester',status:'Failed'}))
  })
  it('rejects files with a forged PDF MIME type and oversized uploads',async()=>{
    await request(app).post('/api/job-applications').set('Origin',origin).attach('resume',Buffer.from('not a pdf'),{filename:'resume.pdf',contentType:'application/pdf'}).expect(422)
    await request(app).post('/api/job-applications').set('Origin',origin).attach('resume',Buffer.alloc(2*1024*1024+1),{filename:'resume.pdf',contentType:'application/pdf'}).expect(422)
  })
})
describe('staff API',()=>{
  it('requires an authenticated session',async()=>{
    await request(app).get('/api/admin/overview').expect(401)
    await request(app).get('/api/admin/applications/000000000000000000000000/resume').expect(401)
  })
  it('rejects incorrect MFA even with a correct password',async()=>{
    const password='example strong test password'
    vi.spyOn(AdminUser,'findOne').mockReturnValue({select:async()=>({id:'test',passwordHash:passwordHash(password),mfaSecret:'A'.repeat(32),role:'Dispatch Staff'})} as never)
    const wrong=String((Number(code())+1)%1000000).padStart(6,'0')
    await request(app).post('/api/auth/login').set('Origin',origin).send({email:payload.email,password,code:wrong}).expect(401)
  })
  it('keeps recruitment staff out of dispatch records',async()=>{
    vi.spyOn(Session,'findOne').mockResolvedValue({userId:'test'} as never)
    vi.spyOn(AdminUser,'findOne').mockReturnValue({select:async()=>({role:'Recruitment Staff'})} as never)
    await request(app).get('/api/admin/transport').set('Cookie','rn_session=synthetic').expect(403)
  })
})
