import mongoose, {Schema, type SchemaDefinition} from 'mongoose'
import {statuses} from '../../shared/schemas.js'

const model = (name:string,fields:SchemaDefinition<Record<string,unknown>>,indexes:Record<string,1|-1>[] = []) => {
  const schema = new Schema(fields, {timestamps:true,strict:'throw'})
  for(const index of indexes) schema.index(index)
  return mongoose.model(name,schema)
}
const required = {type:String,required:true}
const reference = {type:String,required:true,unique:true}
const person = {name:required,email:required,phone:required}
const lifecycle = {reference,status:{type:String,enum:statuses,default:'New'},archivedAt:Date,expiresAt:Date}
const recordIndexes:Record<string,1|-1>[] = [{status:1,createdAt:-1},{archivedAt:1,createdAt:-1}]
export const TransportInquiry = model('TransportInquiry',{
  ...person,...lifecycle,method:required,category:required,area:required,callback:String,consent:Boolean,
  assignedTo:Schema.Types.ObjectId,history:[{status:String,actor:String,at:Date}],notes:[{text:String,actor:String,at:Date}],
},recordIndexes)
export const FacilityReferralInquiry = model('FacilityReferralInquiry',{...person,...lifecycle,facility:required,slot:required,category:required,consent:Boolean},recordIndexes)
export const ContactInquiry = model('ContactInquiry',{...person,...lifecycle,category:required,consent:Boolean},recordIndexes)
export const JobApplication = model('JobApplication',{...person,...lifecycle,position:required,experience:required,resume:{type:Buffer,select:false,required:true}},recordIndexes)
const publication = {title:required,slug:{type:String,unique:true,required:true},description:required,published:{type:Boolean,default:false},image:String}
const embeddedFaq = new Schema({question:String,answer:String},{_id:false})
export const Service = model('Service',{...publication,audience:String,benefits:[String],faqs:[embeddedFaq]},[{published:1,title:1}])
export const ServiceArea = model('ServiceArea',{...publication,phone:String,mapUrl:String,services:[String],faqs:[embeddedFaq]},[{published:1,title:1}])
export const Career = model('Career',{...publication,location:String,employmentType:String},[{published:1,title:1}])
export const FAQ = model('FAQ',{question:required,answer:required,published:Boolean,order:Number},[{published:1,order:1}])
export const Testimonial = model('Testimonial',{name:required,quote:required,published:Boolean})
export const SiteSettings = model('SiteSettings',{key:{type:String,unique:true,default:'public'},phone:String,email:String,hours:String,location:String,mapUrl:String,billingEmail:String,socials:[String],announcement:String,heroHeadline:String,heroCopy:String,heroImage:String,aboutCopy:String,strengths:[String],credentials:[String],team:[String],privacy:String,terms:String,accessibility:String,npp:String})
export const AdminUser = model('AdminUser',{email:{...required,unique:true},passwordHash:required,role:required,active:{type:Boolean,default:true},mfaSecret:{type:String,select:false},lastMfaCounter:Number,resetHash:{type:String,select:false},resetExpires:Date})
export const Session = model('Session',{tokenHash:{...required,unique:true},userId:{type:Schema.Types.ObjectId,required:true},expiresAt:{type:Date,expires:0,required:true}},[{userId:1}])
export const Notification = model('Notification',{reference:required,status:required,channel:required,recipientType:required},[{createdAt:-1}])
export const AuditLog = model('AuditLog',{actor:required,action:required,resource:required,record:required},[{createdAt:-1}])
for (const collection of [TransportInquiry,FacilityReferralInquiry,ContactInquiry,JobApplication]) collection.schema.index({expiresAt:1},{expireAfterSeconds:0})
