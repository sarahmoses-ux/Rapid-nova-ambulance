import {z} from 'zod'

export const name = z.string().trim().min(2).max(100)
export const email = z.email().max(254)
export const phone = z.string().trim().regex(/^\+?[\d ()-]{7,24}$/).refine(value => value.replace(/\D/g,'').length >= 7)
const consent = z.literal(true)
const category = z.string().trim().regex(/^[a-z0-9-]{1,100}$/)
export const transport = z.strictObject({
  name, email, phone, method:z.enum(['phone','email']),
  category, area:category, callback:z.iso.date().or(z.literal('')), consent,
})
export const referral = z.strictObject({
  facility:name,name,email,phone,slot:z.enum(['morning','afternoon','anytime']),
  category:z.enum(['referral','partnership','coordination']),consent,
})
export const contact = z.strictObject({
  name,email,phone,category:z.enum(['general','billing','estimate','partnership']),consent,
})
export const application = z.strictObject({
  name,email,phone,position:category,experience:z.string().trim().min(10).max(1500),
})
export const statuses = ['New','Contacted','Under Review','Confirmed','Completed','Cancelled'] as const
