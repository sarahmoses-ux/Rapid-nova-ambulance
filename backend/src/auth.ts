import {createHash,createHmac,createCipheriv,createDecipheriv,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto'
import type {Request,Response,NextFunction} from 'express'
import {AdminUser,Session} from './models.js'

export const roles = ['Super Admin','Administrator','Dispatch Staff','Content Manager','Recruitment Staff'] as const
export const permissions:Record<string,readonly string[]> = {
  'Super Admin':['operations','content','recruitment','users','audit','settings'],
  Administrator:['operations','content','recruitment','audit','settings'],
  'Dispatch Staff':['operations'],
  'Content Manager':['content'],
  'Recruitment Staff':['recruitment'],
}
export const token = () => randomBytes(32).toString('hex')
export const digest = (value:string) => createHash('sha256').update(value).digest('hex')
export function passwordHash(value:string){
  const salt=token()
  return salt+':'+scryptSync(value,salt,64).toString('hex')
}
const dummy = passwordHash(token())
export function passwordMatches(value:string,stored=dummy){
  const [salt,hash]=stored.split(':')
  return timingSafeEqual(scryptSync(value,salt,64),Buffer.from(hash,'hex'))
}
function mfaKey(){
  const key=process.env.MFA_ENCRYPTION_KEY
  if(key && !/^[a-f0-9]{64}$/i.test(key)) throw new Error('MFA_ENCRYPTION_KEY must be 32 bytes encoded as hex.')
  if(!key && process.env.NODE_ENV==='production') throw new Error('MFA_ENCRYPTION_KEY is required in production.')
  return key?Buffer.from(key,'hex'):null
}
export function protectMfaSecret(secret:string){
  const key=mfaKey()
  if(!key) return secret
  const iv=randomBytes(12)
  const cipher=createCipheriv('aes-256-gcm',key,iv)
  const ciphertext=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()])
  return [iv,cipher.getAuthTag(),ciphertext].map(value=>value.toString('hex')).join(':')
}
function readMfaSecret(stored:string){
  const key=mfaKey()
  if(!stored.includes(':')) return process.env.NODE_ENV==='production'?'':stored
  if(!key) return ''
  try{
    const [iv,tag,ciphertext]=stored.split(':').map(value=>Buffer.from(value,'hex'))
    const decipher=createDecipheriv('aes-256-gcm',key,iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8')
  }catch{return ''}
}
export function mfaCounter(secret:string,code:string){
  if(!/^\d{6}$/.test(code)) return undefined
  secret=readMfaSecret(secret)
  if(!secret) return undefined
  let bits=0, value=0
  const bytes:number[]=[]
  for(const char of secret.toUpperCase()){
    const digit='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char)
    if(digit<0) return undefined
    value=(value<<5)|digit
    bits+=5
    if(bits>=8){bits-=8;bytes.push((value>>bits)&255)}
  }
  const now=Math.floor(Date.now()/30000)
  for(const counter of [now,now-1,now+1]){
    const time=Buffer.alloc(8)
    time.writeBigUInt64BE(BigInt(counter))
    const mac=createHmac('sha1',Buffer.from(bytes)).update(time).digest()
    const offset=mac[mac.length-1]&15
    const expected=String((mac.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0')
    if(timingSafeEqual(Buffer.from(code),Buffer.from(expected))) return counter
  }
}
export const cookieOptions = {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/api'}
export async function authenticate(req:Request,res:Response,next:NextFunction){
  const sid=req.cookies.rn_session
  const session=typeof sid==='string' && await Session.findOne({tokenHash:digest(sid),expiresAt:{$gt:new Date()}})
  const user=session && await AdminUser.findOne({_id:session.userId,active:true}).select('email role')
  if(!user){res.status(401).json({error:'Sign in to continue.'});return}
  res.locals.user=user
  next()
}
export const allow = (permission:string) => (_req:Request,res:Response,next:NextFunction) => {
  if(!permissions[res.locals.user.role]?.includes(permission)){res.status(403).json({error:'Access denied.'});return}
  next()
}
