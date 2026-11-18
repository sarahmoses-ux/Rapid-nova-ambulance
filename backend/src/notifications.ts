import nodemailer from 'nodemailer'
import {Notification} from './models.js'

export function mail(to:string,subject:string,text:string){
  if(!process.env.SMTP_URL || !process.env.MAIL_FROM) return undefined
  return nodemailer.createTransport(process.env.SMTP_URL,{connectionTimeout:5000,socketTimeout:8000}).sendMail({from:process.env.MAIL_FROM,to,subject,text,disableFileAccess:true,disableUrlAccess:true})
}
async function sms(body:string){
  const {TWILIO_ACCOUNT_SID:sid,TWILIO_AUTH_TOKEN:auth,TWILIO_FROM:from,STAFF_SMS:to}=process.env
  if(!sid||!auth||!from||!to) return undefined
  const response=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+encodeURIComponent(sid)+'/Messages.json',{
    method:'POST',headers:{Authorization:'Basic '+Buffer.from(sid+':'+auth).toString('base64')},
    body:new URLSearchParams({From:from,To:to,Body:body}),signal:AbortSignal.timeout(8000),
  })
  if(!response.ok) throw new Error('SMS delivery failed')
  return true
}
export async function notify(reference:string,email:string){
  const body='A new transportation inquiry is available in the staff portal. Reference '+reference+'.'
  const jobs=[
    {channel:'email',recipientType:'staff',send:()=>process.env.STAFF_EMAIL && mail(process.env.STAFF_EMAIL,'New transportation inquiry',body)},
    {channel:'email',recipientType:'requester',send:()=>mail(email,'Transportation inquiry received','We received your inquiry. Reference '+reference+'. Our team will contact you to discuss availability.')},
    {channel:'sms',recipientType:'staff',send:()=>sms(body)},
  ]
  await Promise.all(jobs.map(async ({channel,recipientType,send})=>{
    let status='Skipped'
    try{if(await send()) status='Sent'}catch{status='Failed'}
    await Notification.create({reference,channel,recipientType,status})
  }))
}
