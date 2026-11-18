import {useEffect,useState,type FormEvent, type ReactNode} from 'react'
import {Link,NavLink,Route,Routes,useLocation,useNavigate} from 'react-router-dom'
import {Activity,ClipboardList,LogOut} from 'lucide-react'
import {statuses} from '../../shared/schemas'
import {api,errorMessage} from './api'

type User={email:string;role:string;permissions:string[]}
type RecordData={_id:string;reference?:string;title?:string;name?:string;email?:string;question?:string;action?:string;channel?:string;status?:string;createdAt?:string;archivedAt?:string;assignedTo?:string;role?:string;active?:boolean;[key:string]:unknown}
const groups=[
  ['transport','Transportation Inquiries','operations'],['referrals','Facility Referrals','operations'],['contacts','Customer Inquiries','operations'],
  ['careers','Careers','recruitment'],['applications','Job Applications','recruitment'],['services','Services','content'],['areas','Service Areas','content'],
  ['faqs','Content Management','content'],['testimonials','Testimonials','content'],['notifications','Notifications','operations'],
  ['users','Users and Roles','users'],['audit','Audit Logs','audit'],['settings','Settings','settings'],
]
const roles=['Administrator','Dispatch Staff','Content Manager','Recruitment Staff']
const fields:Record<string,string[]>={
  services:['title','slug','description','image','audience','benefits','faqs','published'],
  areas:['title','slug','description','image','phone','mapUrl','services','faqs','published'],
  careers:['title','slug','description','image','location','employmentType','published'],
  faqs:['question','answer','order','published'],testimonials:['name','quote','published'],
  settings:['phone','email','hours','location','mapUrl','billingEmail','socials','announcement','heroHeadline','heroCopy','heroImage','aboutCopy','strengths','credentials','team','privacy','terms','accessibility','npp'],
}
const arrays=['benefits','services','socials','strengths','credentials','team']
const paragraphs=['description','answer','quote','heroCopy','aboutCopy','privacy','terms','accessibility','npp']
const label=(key:string)=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase())
const date=(value:string)=>new Date(value).toLocaleDateString()
function useAdminData<T>(path:string,version=0){
  const [state,setState]=useState<{key:string;data?:T;error?:string}>({key:''})
  const key=path+':'+version
  useEffect(()=>{
    const controller=new AbortController()
    api.get(path,{signal:controller.signal}).then(result=>setState({key,data:result.data.data})).catch(error=>{
      if(!controller.signal.aborted) setState({key,error:errorMessage(error)})
    })
    return ()=>controller.abort()
  },[path,key])
  return state.key===key?state:{key}
}
function Notice({children}:{children:string}){return <p className="error" role="alert">{children}</p>}
function AdminForm({children,submit,onSuccess,button='Save changes'}:{children:ReactNode;submit:(data:FormData)=>Promise<unknown>;onSuccess?:()=>void;button?:string}){
  const [pending,setPending]=useState(false)
  const [error,setError]=useState('')
  const [saved,setSaved]=useState(false)
  async function send(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setPending(true);setError('');setSaved(false)
    try{await submit(new FormData(event.currentTarget));setSaved(true);onSuccess?.()}catch(error){setError(error instanceof SyntaxError?'Enter valid JSON for the FAQ entries.':errorMessage(error))}finally{setPending(false)}
  }
  return <form className="stack" onSubmit={send}>{children}{error&&<Notice>{error}</Notice>}{saved&&<p role="status">Saved.</p>}<button className="button" disabled={pending}>{pending?'Please wait…':button}</button></form>
}
function SignIn({onSignIn}:{onSignIn:(user:User)=>void}){
  const location=useLocation(),navigate=useNavigate()
  const [sent,setSent]=useState(false)
  const reset=location.pathname.endsWith('/reset'),forgot=location.pathname.endsWith('/forgot')
  return <main className="admin-gate"><div className="card stack"><Activity className="icon-tile"/><p className="eyebrow">Rapid Nova staff portal</p><h2>{reset?'Set a new password':forgot?'Reset your password':'Staff sign-in'}</h2>
    {sent&&forgot?<p role="status">If the account is eligible, a reset link will be sent to its email address.</p>:<AdminForm key={location.pathname} button={reset?'Reset password':forgot?'Send reset link':'Sign in'} submit={async data=>{
      const values=Object.fromEntries(data)
      if(reset){await api.post('/auth/reset-password',{...values,token:location.hash.slice(1)});navigate('/admin');return}
      if(forgot){await api.post('/auth/forgot-password',values);setSent(true);return}
      const result=await api.post('/auth/login',values);onSignIn(result.data.data);navigate('/admin')
    }}>
      {!reset&&<label className="field">Work email<input name="email" type="email" autoComplete="username" required/></label>}
      {!forgot&&<label className="field">Password<input name="password" type="password" required minLength={reset?14:1} maxLength={128} autoComplete={reset?'new-password':'current-password'}/></label>}
      {!forgot&&!reset&&<label className="field">Authenticator code<input name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required/></label>}
    </AdminForm>}
    {forgot||reset?<Link to="/admin" className="text-link">Back to Sign In</Link>:<Link to="/admin/forgot" className="text-link" onClick={()=>setSent(false)}>Forgot password?</Link>}<p><Link to="/" className="text-link">Public website</Link></p>
  </div></main>
}
function Overview({user}:{user:User}){
  const state=useAdminData<{counts:{_id:string;count:number}[];referrals:number|null;applications:number|null;recent:RecordData[]}>('/admin/overview')
  const data=state.data
  if(!data) return state.error?<Notice>{state.error}</Notice>:<p role="status">Loading overview…</p>
  const count=(status:string)=>data.counts.find(row=>row._id===status)?.count||0
  const total=data.counts.reduce((sum,row)=>sum+row.count,0)
  const metrics=[...(user.permissions.includes('operations')?[['Total transportation inquiries',total],['New inquiries',count('New')],['Pending inquiries',count('Contacted')+count('Under Review')],['Confirmed arrangements',count('Confirmed')],['Completed requests',count('Completed')],['Cancelled requests',count('Cancelled')],['Facility inquiries',data.referrals]]:[]),...(data.applications!==null?[['Career applications',data.applications]]:[])]
  return <div className="stack"><h2>Overview</h2>{metrics.length>0&&<div className="grid-cards">{metrics.map(([title,value])=><div className="card stack" key={String(title)}><p>{title}</p><strong className="metric">{value}</strong></div>)}</div>}
    {user.permissions.includes('operations')&&<><section className="card stack"><h3>Transportation inquiries by status</h3>{statuses.map(status=><div className="chart-row" key={status}><span>{status}</span><meter min={0} max={Math.max(total,1)} value={count(status)} aria-label={status}/><strong>{count(status)}</strong></div>)}</section><section className="card stack"><h3>Recent activity</h3>{data.recent.length?data.recent.map(row=><p key={row._id} className="reference">{row.reference} · {row.status} · {date(row.createdAt||'')}</p>):<p>No recent inquiries.</p>}</section></>}
    <div className="action-row">{groups.filter(([slug,,permission])=>['transport','services','careers'].includes(slug)&&user.permissions.includes(permission)).map(([slug,title])=><Link className="button secondary" to={'/admin/'+slug} key={slug}>{title}</Link>)}</div>
  </div>
}
function Editor({resource,row,onSave}:{resource:string;row?:RecordData;onSave:()=>void}){
  return <div className="card stack"><h3>{resource==='settings'?'Public site configuration':row?'Edit listing':'Create listing'}</h3><AdminForm onSuccess={onSave} submit={async form=>{
    const output:Record<string,unknown>={}
    for(const key of fields[resource]){
      const value=String(form.get(key)||'')
      if(key==='published') output[key]=form.has(key)
      else if(key==='order') output[key]=Number(value)
      else if(key==='faqs') output[key]=value?JSON.parse(value):[]
      else if(arrays.includes(key)) output[key]=value.split('\n').map(x=>x.trim()).filter(Boolean)
      else output[key]=value
    }
    const path='/admin/'+resource
    return resource==='settings'||row?api.put(path+(resource==='settings'?'':'/'+row?._id),output):api.post(path,output)
  }}>
    {fields[resource].map(key=>{
      const value=row?.[key]
      if(key==='published') return <label className="field" key={key}><span><input type="checkbox" name={key} defaultChecked={Boolean(value)}/>Publish verified information</span></label>
      if(arrays.includes(key)||paragraphs.includes(key)||key==='faqs') return <label className="field" key={key}>{label(key)}{arrays.includes(key)?' (one per line)':key==='faqs'?' (JSON question/answer list)':''}<textarea name={key} rows={3} defaultValue={key==='faqs'?JSON.stringify(value||[],null,2):Array.isArray(value)?value.join('\n'):String(value||'')}/></label>
      return <label className="field" key={key}>{label(key)}<input name={key} type={key==='order'?'number':'text'} defaultValue={String(value??(key==='order'?0:''))}/></label>
    })}
  </AdminForm></div>
}
function SettingsPanel(){
  const state=useAdminData<RecordData>('/admin/settings')
  return <div className="stack"><h2>Settings</h2>{state.error?<Notice>{state.error}</Notice>:state.data?<Editor resource="settings" row={state.data} onSave={()=>{}}/>:<p role="status">Loading settings…</p>}</div>
}
function Details({resource,row,onSave}:{resource:string;row:RecordData;onSave:()=>void}){
  const users=useAdminData<{_id:string;email:string}[]>(resource==='transport'?'/admin/dispatch-users':'/auth/me')
  const excluded=['_id','__v','updatedAt','expiresAt','passwordHash','resetHash','lastMfaCounter','resetExpires']
  return <div className="card stack"><h3>Record details</h3><dl className="review">{Object.entries(row).filter(([key,value])=>!excluded.includes(key)&&value!==null&&value!=='').map(([key,value])=><div className="contents" key={key}><dt>{label(key)}</dt><dd>{typeof value==='object'?<pre className="record-json">{JSON.stringify(value,null,2)}</pre>:key.endsWith('At')?date(String(value)):String(value)}</dd></div>)}</dl>
    {resource==='transport'&&<AdminForm onSuccess={onSave} submit={data=>api.patch('/admin/transport/'+row._id,{status:data.get('status')===row.status?undefined:data.get('status'),assignedTo:data.get('assignedTo')||null,note:data.get('note')||undefined,archive:data.has('archive')===Boolean(row.archivedAt)?undefined:data.has('archive')})}>
      <label className="field">Status<select name="status" defaultValue={row.status}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label>
      <label className="field">Assigned staff<select name="assignedTo" defaultValue={row.assignedTo||''}><option value="">Unassigned</option>{users.data?.map(user=><option key={user._id} value={user._id}>{user.email}</option>)}</select></label>
      <label className="field">Non-clinical administrative note<textarea name="note" maxLength={500} rows={3}/></label>
      <label className="field"><span><input type="checkbox" name="archive" defaultChecked={Boolean(row.archivedAt)}/>Archived</span></label>
    </AdminForm>}
    {resource==='users'&&row.role!=='Super Admin'&&<AdminForm onSuccess={onSave} submit={data=>api.patch('/admin/users/'+row._id,{role:data.get('role'),active:data.has('active')})}><label className="field">Role<select name="role" defaultValue={row.role}>{roles.map(role=><option key={role}>{role}</option>)}</select></label><label className="field"><span><input name="active" type="checkbox" defaultChecked={row.active}/>Active account</span></label></AdminForm>}
    {['referrals','contacts','applications'].includes(resource)&&<AdminForm onSuccess={onSave} submit={data=>api.patch('/admin/'+resource+'/'+row._id,{status:data.get('status')})}>
      <label className="field">Status<select name="status" defaultValue={row.status}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label>
    </AdminForm>}
    {resource==='applications'&&<a className="button secondary" href={(import.meta.env.VITE_API_BASE||'/api')+'/admin/applications/'+row._id+'/resume'}>Download Resume</a>}
  </div>
}
function Records({resource,title}:{resource:string;title:string}){
  const [page,setPage]=useState(1),[query,setQuery]=useState(''),[status,setStatus]=useState(''),[archived,setArchived]=useState(false),[version,setVersion]=useState(0)
  const [selected,setSelected]=useState<RecordData|null>(null),[editing,setEditing]=useState(false)
  const key=JSON.stringify([resource,page,query,status,archived,version])
  const [state,setState]=useState<{key:string;data?:RecordData[];total?:number;error?:string}>({key:''})
  useEffect(()=>{
    const controller=new AbortController()
    api.get('/admin/'+resource,{params:{page,q:query,status,archived},signal:controller.signal}).then(({data})=>setState({key,data:data.data,total:data.total})).catch(error=>{
      if(!controller.signal.aborted) setState({key,error:errorMessage(error)})
    })
    return ()=>controller.abort()
  },[key,resource,page,query,status,archived])
  const loaded=state.key===key
  const refresh=()=>{setSelected(null);setEditing(false);setVersion(version+1)}
  return <div className="stack"><h2>{title}</h2>
    {fields[resource]&&<button className="button" onClick={()=>{setSelected(null);setEditing(!editing)}}>{editing&&!selected?'Close Editor':'New Listing'}</button>}
    {editing&&<Editor key={selected?._id||'new'} resource={resource} row={selected||undefined} onSave={refresh}/>}
    {selected&&!editing&&<Details key={selected._id} resource={resource} row={selected} onSave={refresh}/>}
    <form className="card action-row" onSubmit={event=>{event.preventDefault();setQuery(String(new FormData(event.currentTarget).get('search')||''));setPage(1)}}>
      <label className="field">Search<input name="search" type="search" maxLength={80}/></label><button className="button secondary self-end">Search</button>
      {['transport','referrals','contacts','applications'].includes(resource)&&<label className="field">Status<select value={status} onChange={event=>{setStatus(event.target.value);setPage(1)}}><option value="">All statuses</option>{statuses.map(x=><option key={x}>{x}</option>)}</select></label>}
      {resource==='transport'&&<label className="field self-end"><span><input type="checkbox" checked={archived} onChange={event=>{setArchived(event.target.checked);setPage(1)}}/>Archived</span></label>}
    </form>
    {!loaded?<p role="status">Loading records…</p>:state.error?<Notice>{state.error}</Notice>:state.data?.length?<div className="table-scroll"><table><thead><tr><th scope="col">Record</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col">Action</th></tr></thead><tbody>{state.data.map(row=><tr key={row._id}><td>{row.reference||row.title||row.name||row.email||row.question||row.action||row.channel}</td><td>{row.status||row.role||(row.published?'Published':'—')}</td><td>{row.createdAt?date(row.createdAt):'—'}</td><td><button className="text-link" onClick={()=>{setSelected(row);setEditing(Boolean(fields[resource]));window.scrollTo(0,0)}}>{fields[resource]?'Edit':'View'}</button></td></tr>)}</tbody></table></div>:<p>No matching records.</p>}
    <div className="action-row"><button className="button secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span className="self-center">Page {page}</span><button className="button secondary" disabled={!loaded||page*20>=(state.total||0)} onClick={()=>setPage(page+1)}>Next</button></div>
  </div>
}
export default function Admin(){
  const [user,setUser]=useState<User|null|undefined>(undefined)
  const [error,setError]=useState('')
  useEffect(()=>{
    const controller=new AbortController()
    api.get('/auth/me',{signal:controller.signal}).then(result=>setUser(result.data.data)).catch(()=>{
      if(!controller.signal.aborted) setUser(null)
    })
    return ()=>controller.abort()
  },[])
  if(user===undefined) return <p className="section wrap" role="status">Checking staff session…</p>
  if(!user) return <SignIn onSignIn={setUser}/>
  const available=groups.filter(([, ,permission])=>user.permissions.includes(permission))
  return <div className="admin-shell"><aside className="admin-sidebar stack"><Link to="/admin" className="brand"><Activity/> Rapid Nova</Link><nav aria-label="Staff navigation"><NavLink to="/admin" end><ClipboardList size={17}/> Overview</NavLink>{available.map(([slug,title])=><NavLink key={slug} to={'/admin/'+slug}>{title}</NavLink>)}</nav><Link to="/">Public website</Link></aside>
    <main className="admin-main stack"><header className="admin-top"><div><strong>{user.email}</strong><p>{user.role}</p></div><button className="button secondary" onClick={async()=>{try{await api.post('/auth/logout');setUser(null)}catch(error){setError(errorMessage(error))}}}><LogOut size={16}/> Sign Out</button></header>
    {error&&<Notice>{error}</Notice>}
    <Routes><Route index element={<Overview user={user}/>}/>{available.map(([resource,title])=><Route key={resource} path={resource} element={resource==='settings'?<SettingsPanel/>:<Records key={resource} resource={resource} title={title}/>}/>)}<Route path="*" element={<div className="stack"><p>This staff page is unavailable.</p><Link className="text-link" to="/admin">Overview</Link></div>}/></Routes>
    </main></div>
}
