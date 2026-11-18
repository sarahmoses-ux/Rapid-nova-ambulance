import {useState,type ReactNode} from 'react'
import {Link,useSearchParams} from 'react-router-dom'
import {useForm,type FieldPath,type RegisterOptions} from 'react-hook-form'
import {CheckCircle2} from 'lucide-react'
import {application,contact,referral,transport} from '../../shared/schemas'
import {api,errorMessage,useData,type Listing} from './api'

export type FormKind='transport'|'referral'|'contact'|'application'
type Fields={
  name:string;email:string;phone:string;method:string;category:string;area:string;callback:string;
  consent:boolean;facility:string;slot:string;position:string;experience:string;resume:FileList;
}
const endpoints={transport:'/transport-inquiries',referral:'/referral-inquiries',contact:'/contact',application:'/job-applications'}
const schemas={transport,referral,contact,application}
const labels:Partial<Record<keyof Fields,string>>={name:'Contact name',email:'Email address',phone:'Phone number',method:'Preferred contact method',category:'Inquiry category',area:'General service area',callback:'Preferred callback date',consent:'Privacy consent',facility:'Facility name',slot:'Preferred callback time',position:'Position',experience:'Relevant experience',resume:'Resume (PDF, up to 2 MB)'}
const referralOptions=[['referral','Facility referral'],['partnership','Partnership'],['coordination','Transportation coordination']]
const contactOptions=[['general','General inquiry'],['billing','Insurance and billing'],['estimate','Transportation estimate'],['partnership','Partnership']]
export default function Forms({kind,selected}:{kind:FormKind;selected?:string}){
  const [params]=useSearchParams()
  const services=useData<Listing[]>('/services',[])
  const areas=useData<Listing[]>('/service-areas',[])
  const [step,setStep]=useState(1)
  const [reference,setReference]=useState('')
  const [failure,setFailure]=useState('')
  const {register,handleSubmit,trigger,setError,getValues,setValue,formState:{errors,isSubmitting}}=useForm<Fields>({
    defaultValues:{method:'phone',category:kind==='referral'?(referralOptions.some(([key])=>key===params.get('category'))?params.get('category')!:'referral'):kind==='contact'&&(contactOptions.some(([key])=>key===params.get('category')))?params.get('category')!:'general',area:'unconfirmed',callback:'',slot:'anytime',position:selected,consent:false},
  })
  const validName=(value:unknown)=>transport.shape.name.safeParse(value).success||'Enter a name between 2 and 100 characters.'
  const validEmail=(value:unknown)=>transport.shape.email.safeParse(value).success||'Enter a valid email address.'
  const validPhone=(value:unknown)=>transport.shape.phone.safeParse(value).success||'Enter a valid phone number.'
  function field(key:FieldPath<Fields>,options:RegisterOptions<Fields>,children:(props:ReturnType<typeof register>)=>ReactNode,label=labels[key]){
    return <label className="field" key={key}><span>{label}</span>{children(register(key,options))}{errors[key]&&<span className="field-error" id={key+'-error'} role="alert">{errors[key]?.message||'Check this field.'}</span>}</label>
  }
  const input=(key:FieldPath<Fields>,type:string,options:RegisterOptions<Fields>={},label?:string,autocomplete?:string)=>field(key,options,props=><input {...props} type={type} autoComplete={autocomplete} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key]?key+'-error':undefined}/>,label)
  const select=(key:FieldPath<Fields>,items:string[][],label?:string)=>field(key,{required:'Select an option.'},props=><select {...props} aria-invalid={Boolean(errors[key])}>{items.map(([value,title])=><option key={value} value={value}>{title}</option>)}</select>,label)
  const identity=<div className="fields">{input('name','text',{validate:validName},kind==='application'?'Full name':kind==='referral'?'Representative name':undefined,'name')}{input('email','email',{validate:validEmail},kind==='referral'?'Work email':undefined,'email')}{input('phone','tel',{validate:validPhone},undefined,'tel')}</div>
  const consent=field('consent',{required:'Consent is required to submit.'},props=><span><input {...props} type="checkbox"/>I agree to be contacted about this inquiry and have read the <Link className="text-link" to="/privacy" target="_blank" rel="noreferrer">privacy notice</Link>.</span>)
  const values=getValues()
  const serviceItems=[['general','General transportation inquiry'],...services.value.map(x=>[x.slug,x.title])]
  const areaItems=[['unconfirmed','Ask about my area'],...areas.value.map(x=>[x.slug,x.title])]
  async function submit(data:Fields){
    setFailure('')
    const keys=Object.keys(schemas[kind].shape) as (keyof Fields)[]
    const parsed=schemas[kind].safeParse(Object.fromEntries(keys.map(key=>[key,data[key]])))
    if(!parsed.success){
      for(const issue of parsed.error.issues) setError(issue.path[0] as keyof Fields,{message:'Check this field.'})
      setFailure('Check the required fields before submitting.')
      return
    }
    let payload:unknown=parsed.data
    if(kind==='application'){
      const resume=data.resume?.[0]
      if(!resume){setError('resume',{message:'Upload a PDF resume.'});return}
      const form=new FormData()
      for(const [key,value] of Object.entries(parsed.data)) form.append(key,String(value))
      form.append('resume',resume)
      payload=form
    }
    try{
      const result=await api.post(endpoints[kind],payload)
      setReference(result.data.data.reference)
    }catch(error){setFailure(errorMessage(error))}
  }
  if(reference) return <div className="stack" role="status"><CheckCircle2 className="icon-tile"/><h2>{kind==='application'?'Application received':'Inquiry received'}</h2><p>Your reference number is <strong className="reference">{reference}</strong>.</p>{kind==='transport'&&<p>The team can follow up to discuss availability and arrangements.</p>}<Link to="/" className="text-link">Return Home</Link></div>
  return <form className="stack" noValidate onSubmit={kind==='transport'&&step<3?async event=>{
    event.preventDefault()
    const fields:FieldPath<Fields>[]=step===1?['name','email','phone','method']:['category','area','callback']
    if(await trigger(fields,{shouldFocus:true})){
      if(step===1){
        for(const [field,items] of [['category',serviceItems],['area',areaItems]] as const){
          const requested=params.get(field)
          if(requested&&items.some(([key])=>key===requested)) setValue(field,requested)
        }
      }
      setStep(step+1)
    }
  }:handleSubmit(submit)}>
    {kind==='transport'?<>
      <ol className="progress" aria-label="Form progress">{['Contact','Inquiry','Review'].map((label,index)=><li key={label} aria-current={step===index+1?'step':undefined}>{index+1}. {label}</li>)}</ol>
      {step===1&&<><h3>Contact information</h3>{identity}{select('method',[['phone','Phone'],['email','Email']])}</>}
      {step===2&&<><h3>General transportation inquiry</h3>
        {field('category',{required:'Select an option.'},props=><select {...props} defaultValue={serviceItems.some(([key])=>key===params.get('category'))?params.get('category')||'general':values.category}>{serviceItems.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>)}
        {field('area',{required:'Select an option.'},props=><select {...props} defaultValue={areaItems.some(([key])=>key===params.get('area'))?params.get('area')||'unconfirmed':values.area}>{areaItems.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>)}
        {input('callback','date')}
      </>}
      {step===3&&<><h3>Review and submit</h3><dl className="review">{(['name','email','phone','method','category','area','callback'] as const).map(key=><div className="contents" key={key}><dt>{labels[key]}</dt><dd>{(key==='category'?serviceItems.find(item=>item[0]===values[key])?.[1]:key==='area'?areaItems.find(item=>item[0]===values[key])?.[1]:values[key])||'Any date'}</dd></div>)}</dl>{consent}</>}
    </>:<>
      {kind==='referral'&&input('facility','text',{validate:validName})}{identity}
      {kind==='referral'&&select('slot',[['anytime','Any time'],['morning','Morning'],['afternoon','Afternoon']])}
      {(kind==='contact'||kind==='referral')&&field('category',{required:'Select an option.'},props=><select {...props} defaultValue={params.get('category')||values.category}>{(kind==='contact'?contactOptions:referralOptions).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>)}
      {kind==='application'?<>
        <input type="hidden" {...register('position')}/>
        {field('experience',{minLength:{value:10,message:'Enter at least 10 characters.'},maxLength:{value:1500,message:'Use 1,500 characters or fewer.'},required:'Enter your relevant experience.'},props=><textarea {...props} rows={5} maxLength={1500}/>)}
        {field('resume',{validate:files=>files instanceof FileList&&files[0]?.type==='application/pdf'&&files[0].size<=2*1024*1024||'Upload a PDF no larger than 2 MB.'},props=><input {...props} type="file" accept=".pdf,application/pdf"/>)}
      </>:consent}
    </>}
    {failure&&<p className="error" role="alert">{failure}</p>}
    <div className="action-row">{kind==='transport'&&step>1&&<button type="button" className="button secondary" onClick={()=>{setFailure('');setStep(step-1)}}>Back</button>}<button className="button" disabled={isSubmitting} type="submit">{isSubmitting?'Submitting…':kind==='transport'&&step<3?'Continue':kind==='application'?'Submit Application':'Submit Inquiry'}</button></div>
  </form>
}
