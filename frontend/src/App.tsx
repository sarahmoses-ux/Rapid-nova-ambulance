import {lazy,Suspense,useEffect,useState,type ReactNode} from 'react'
import {BrowserRouter,Link,NavLink,Outlet,Route,Routes,useLocation,useParams} from 'react-router-dom'
import {Activity,Ambulance,Building2,CalendarDays,ChevronDown,HeartHandshake,MapPin,Menu,Phone,ShieldCheck,X} from 'lucide-react'
import {motion,MotionConfig,useReducedMotion} from 'framer-motion'
import {useData,type FAQ,type Listing,type Settings} from './api'
import type {FormKind} from './Forms'
import PhotoCarousel from './PhotoCarousel'

const Forms=lazy(()=>import('./Forms'))
const Admin=lazy(()=>import('./Admin'))
const request='/request-transport'
const cinematicEase=[.2,.65,.25,1] as const
const heroReveal={hidden:{opacity:0,y:18},visible:{opacity:1,y:0,transition:{duration:.65,ease:cinematicEase}}}
const heroLine={hidden:{y:'110%'},visible:{y:'0%',transition:{duration:.85,ease:cinematicEase}}}
const faqDefaults:FAQ[]=[
  {question:'How do I request transportation?',answer:'Submit a transportation inquiry with your contact information. The team can follow up to discuss availability and arrangements.'},
  {question:'How far in advance should I ask?',answer:'Send an inquiry as soon as you know your preferred date so the team can discuss scheduling options.'},
  {question:'Can I use insurance?',answer:'Contact the billing team to discuss your specific coverage and payment options.'},
  {question:'How much does transportation cost?',answer:'Request an estimate. Costs can depend on the type of transportation and travel distance.'},
  {question:'Which areas are served?',answer:'Check the service areas directory for confirmed locations or submit an inquiry about your area.'},
  {question:'Can someone accompany me?',answer:'Ask the team about accompaniment when discussing arrangements.'},
  {question:'How do I change or cancel arrangements?',answer:'Contact the transportation team to review the policy that applies to your arrangements.'},
  {question:'How do I check transportation eligibility?',answer:'Ask the team about the requirements for the transportation service you are considering.'},
]
const transportSteps=['Submit a transportation inquiry','Speak with the transportation team','Confirm your arrangements','Receive your scheduled transportation']
export function Button({to,children,secondary=false}:{to:string;children:ReactNode;secondary?:boolean}){
  return <Link className={'button'+(secondary?' secondary':'')} to={to}>{children}</Link>
}
function Brand(){return <Link to="/" className="brand" aria-label="Rapid Nova Ambulance home"><span className="brand-mark"><Activity size={25}/></span><span>RAPID NOVA<small>AMBULANCE</small></span></Link>}
function Emergency(){return <span>For medical emergencies, <a href="tel:911">call 911</a>.</span>}
function NavGroup({label,links}:{label:string;links:[string,string][]}){
  return <details className="nav-group"><summary>{label}<ChevronDown size={14}/></summary><div>{links.map(([to,text])=><NavLink key={to} to={to}>{text}</NavLink>)}</div></details>
}
function Shell({settings}:{settings:Settings}){
  const location=useLocation()
  const [open,setOpen]=useState('')
  const visible=open===location.key
  return <>
    <a href="#main" className="skip button">Skip to content</a>
    <div className="utility"><div className="wrap"><span><MapPin size={15}/>{settings.location||'Texas'}</span>{settings.phone&&<a href={'tel:'+settings.phone}>{settings.phone}</a>}{settings.hours&&<span>{settings.hours}</span>}{settings.email&&<a href={'mailto:'+settings.email}>{settings.email}</a>}<span className="emergency"><Emergency/></span></div></div>
    <header className="header"><div className="wrap head">
      <Brand/><button type="button" className="menu-toggle" aria-expanded={visible} aria-controls="main-nav" aria-label={visible?'Close navigation':'Open navigation'} onClick={()=>setOpen(visible?'':location.key)}>{visible?<X/>:<Menu/>}</button>
      <nav key={location.key} id="main-nav" className={visible?'show':''} aria-label="Main navigation">
        <NavLink to="/" end>Home</NavLink><NavLink to="/about">About Us</NavLink>
        <NavGroup label="Services" links={[[ '/services','Explore services'],['/referrals','Facility referrals']]}/>
        <NavLink to="/service-areas">Service Areas</NavLink>
        <NavGroup label="Patient Resources" links={[[ '/patient-resources','Frequently asked questions'],['/billing','Insurance and billing'],['/referrals','Facility referrals']]}/>
        <NavLink to="/careers">Careers</NavLink><NavLink to="/contact">Contact Us</NavLink>
      </nav>
      {settings.phone&&<a className="dispatch" aria-label="Call dispatch" href={'tel:'+settings.phone}><Phone size={16}/> <span>{settings.phone}</span></a>}
      <Button to={request}>Request Transport</Button>
    </div></header>
    {settings.announcement&&<p className="announcement">{settings.announcement}</p>}
    <main id="main" tabIndex={-1}><Outlet/></main>
    <footer className="dark"><div className="wrap footer">
      <div className="stack"><Brand/><p>Medical transportation inquiries for patients, families and healthcare facilities in Texas.</p><Emergency/></div>
      <div className="stack"><h3>Explore</h3><Link to="/about">About Us</Link><Link to="/services">Services</Link><Link to="/service-areas">Service Areas</Link><Link to="/careers">Careers</Link></div>
      <div className="stack"><h3>Patient resources</h3><Link to={request}>Request Transport</Link><Link to="/referrals">Facility Referrals</Link><Link to="/billing">Insurance &amp; Billing</Link><Link to="/patient-resources">Common Questions</Link></div>
      <div className="stack"><h3>Contact</h3>{settings.phone&&<a href={'tel:'+settings.phone}>{settings.phone}</a>}{settings.email&&<a href={'mailto:'+settings.email}>{settings.email}</a>}{settings.hours&&<p>{settings.hours}</p>}<Link to="/contact">Contact Us</Link>{settings.socials?.filter(Boolean).map(url=><a key={url} href={url}>{new URL(url).hostname}</a>)}</div>
    </div><div className="wrap footer-bottom"><span>© {new Date().getFullYear()} Rapid Nova Ambulance</span><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Use</Link><Link to="/accessibility">Accessibility</Link>{settings.npp&&<Link to="/notice-of-privacy-practices">Notice of Privacy Practices</Link>}</div></footer>
  </>
}
function Metadata(){
  const {pathname}=useLocation()
  useEffect(()=>{
    const segment=pathname.split('/').filter(Boolean).at(-1)
    const title=segment?segment.split('-').map(word=>word[0]?.toUpperCase()+word.slice(1)).join(' ')+' | Rapid Nova Ambulance':'Rapid Nova Ambulance | Medical Transportation'
    document.title=title
    const metadata=[
      ['name','description',segment?'Find information about '+segment.replaceAll('-',' ')+' at Rapid Nova Ambulance.':'Explore medical transportation inquiries and healthcare facility referrals at Rapid Nova Ambulance.'],
      ['property','og:title',title],['property','og:description',segment?'Explore '+segment.replaceAll('-',' ')+' at Rapid Nova Ambulance.':'Transportation inquiries and healthcare facility referrals at Rapid Nova Ambulance.'],['property','og:type','website'],['property','og:url',location.origin+pathname],
      ['name','robots',pathname.startsWith('/admin')?'noindex, nofollow':'index, follow'],
    ]
    for(const [attribute,key,content] of metadata){
      const tag=document.head.querySelector('meta['+attribute+'="'+key+'"]')||document.createElement('meta')
      tag.setAttribute(attribute,key);tag.setAttribute('content',content);document.head.append(tag)
    }
    const canonical=document.head.querySelector('link[rel="canonical"]')||document.createElement('link')
    canonical.setAttribute('rel','canonical');canonical.setAttribute('href',location.origin+pathname);document.head.append(canonical)
    window.scrollTo(0,0)
  },[pathname])
  return null
}
const pagePhotos={
  about:{file:'/about-crew.jpg',alt:'Medical transport crew reviewing a clipboard outdoors'},
  services:{file:'/services-ambulance.jpg',alt:'Ambulance parked in a vehicle bay'},
  'service-areas':{file:'/texas-service-areas.jpg',alt:'Downtown Texas street at dawn'},
  careers:{file:'/careers-crew.jpg',alt:'Medical transport technicians preparing an ambulance bay'},
  'patient-resources':{file:'/resources.jpg',alt:'An older adult speaking with a family member in a clinic lobby'},
  billing:{file:'/billing-desk.jpg',alt:'Billing coordinator working at a desk'},
  contact:{file:'/contact-desk.jpg',alt:'Receptionist wearing a headset at work'},
  transport:{file:'/planning.jpg',alt:'Scheduling coordinator taking a phone call at a desk'},
  referral:{file:'/facility-referral.jpg',alt:'Healthcare staff greeting each other at a facility desk'},
  privacy:{file:'/privacy-desk.jpg',alt:'Closed navy folder and pen on a desk'},
  terms:{file:'/terms-desk.jpg',alt:'Clipboard and glasses on a wooden desk'},
  accessibility:{file:'/accessible-entrance.jpg',alt:'Accessible ramp and handrails outside a healthcare building'},
  'notice-of-privacy-practices':{file:'/privacy-practices.jpg',alt:'Closed blue binder on a reception counter'},
}
type PagePhoto={file:string;alt:string}
function Intro({label,title,children,photo}:{label:string;title:string;children?:ReactNode;photo?:PagePhoto}){
  return <section className="intro soft"><div className={photo?'wrap split page-intro':'wrap'}><div className="stack"><p className="eyebrow">{label}</p><h1>{title}</h1>{children&&<p className="muted">{children}</p>}</div>
    {photo&&<figure className="editorial-photo intro-photo"><img src={photo.file} alt={photo.alt} width={1200} height={800} fetchPriority="high"/>{Object.values(pagePhotos).some(item=>item.file===photo.file)&&<figcaption>Illustrative photo</figcaption>}</figure>}
  </div></section>
}
function Questions({items}:{items:FAQ[]}){
  return <div className="accordion">{items.map(({question,answer})=><details key={question}><summary>{question}</summary><p className="muted">{answer}</p></details>)}</div>
}
function Listings({kind,items}:{kind:string;items:Listing[]}){
  return <div className="grid-cards">{items.map(item=><article className="card stack" key={item._id}>
    <Ambulance className="icon-tile"/>
    <h3>{item.title}</h3><p className="muted">{item.description}</p><Link className="text-link" to={'/'+kind+'/'+item.slug}>Learn more<span className="sr-only"> about {item.title}</span></Link>
  </article>)}</div>
}
function AreaMap({url,label}:{url:string;label:string}){
  const parsed=new URL(url)
  return <div className="stack">{parsed.origin==='https://www.openstreetmap.org'&&parsed.pathname==='/export/embed.html'&&<iframe className="area-map" src={url} title={label} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin"/>}<a className="text-link" href={url}>{label}</a></div>
}
function EditorialPhoto({name,alt}:{name:string;alt:string}){
  return <figure className="editorial-photo"><img src={'/'+name+'.jpg'} alt={alt} width={1200} height={800} loading="lazy"/><figcaption>Illustrative photo</figcaption></figure>
}
function Directory({kind}:{kind:string}){
  const list=useData<Listing[]>('/'+kind,[])
  const title=kind==='services'?'Transportation services':kind==='careers'?'Careers at Rapid Nova':'Texas service areas'
  return <><Intro label="Rapid Nova Ambulance" title={title} photo={pagePhotos[kind as 'services'|'service-areas'|'careers']}>{kind==='careers'?'Explore verified openings and apply for a position.':'Explore confirmed options and ask about transportation availability.'}</Intro>
    <section className="wrap section stack">{kind==='careers'&&<div className="split careers-feature"><div className="stack"><h2>Explore open positions</h2><p className="muted">Choose a published opening to review the role and apply.</p></div><PhotoCarousel careerFocus/></div>}{list.loading?<p role="status">Loading…</p>:list.error?<p role="alert">{list.error}</p>:list.value.length?<Listings kind={kind} items={list.value}/>:<p>{kind==='careers'?'There are no published openings at this time.':'Confirmed listings will appear here as they become available.'}</p>}{kind!=='careers'&&<Button to={request}>Request Transport</Button>}</section></>
}
function Detail({kind}:{kind:string}){
  const {slug}=useParams()
  const {value,loading,error}=useData<Listing|null>('/'+kind+'/'+encodeURIComponent(slug||''),null)
  const services=useData<Listing[]>('/services',[])
  if(loading||!value) return <section className="wrap section stack"><p role={error?'alert':'status'}>{loading?'Loading…':error||'Page unavailable.'}</p><Button to={'/'+kind}>Back to the directory</Button></section>
  return <><Intro label={kind.replace('-',' ')} title={value.title} photo={value.image?{file:value.image,alt:''}:undefined}>{value.description}</Intro><section className="wrap section stack">
    {value.audience&&<div className="stack"><h2>Who this service is for</h2><p>{value.audience}</p></div>}
    {Boolean(value.benefits?.length)&&<div className="stack"><h2>Service benefits</h2><ul className="list-disc pl-5">{value.benefits?.map(x=><li key={x}>{x}</li>)}</ul></div>}
    {value.phone&&<a className="text-link" href={'tel:'+value.phone}>{value.phone}</a>}
    {value.mapUrl&&<AreaMap url={value.mapUrl} label="View area map"/>}
    {Boolean(value.services?.length)&&<Listings kind="services" items={services.value.filter(service=>value.services?.includes(service.slug))}/>}
    {Boolean(value.faqs?.length)&&<Questions items={value.faqs||[]}/>}
    {kind==='careers'?<><p>{value.location} · {value.employmentType}</p><Forms kind="application" selected={value.slug}/></>:<Button to={request+'?'+(kind==='services'?'category':'area')+'='+value.slug}>Request Transport</Button>}
  </section></>
}
function Home({settings,faqs}:{settings:Settings;faqs:FAQ[]}){
  const reducedMotion=useReducedMotion()
  const services=useData<Listing[]>('/services',[])
  const areas=useData<Listing[]>('/service-areas',[])
  const testimonials=useData<{name:string;quote:string}[]>('/testimonials',[])
  return <>
    <section className="hero">
      <motion.img className="hero-image" src={settings.heroImage||'/ambulance.jpg'} alt="" fetchPriority="high"
        initial={reducedMotion?false:{scale:1.13,x:'1.8%'}} animate={{scale:1,x:'0%'}} transition={{duration:3.2,ease:cinematicEase}}/>
      <div className="wrap hero-content">
        <motion.div className="stack" initial={reducedMotion?false:'hidden'} animate="visible"
          variants={{hidden:{},visible:{transition:{staggerChildren:.16}}}}>
          <motion.p className="eyebrow" variants={heroReveal}>Medical transportation · Texas</motion.p>
          <motion.h1 className="hero-title" variants={{hidden:{},visible:{transition:{staggerChildren:.13}}}}>
            {(settings.heroHeadline?[settings.heroHeadline]:['Care in Motion.','Compassion in','Every Mile.']).map(line=><span className="hero-line" key={line}><motion.span variants={heroLine}>{line}</motion.span>{' '}</span>)}
          </motion.h1>
          <motion.p variants={heroReveal}>{settings.heroCopy||'Medical transportation inquiries for patients, families and healthcare facilities across Texas.'}</motion.p>
          <motion.div variants={heroReveal} className="action-row animated-cta"><Button to={request}>Request Transport</Button><Button to="/services" secondary>Explore Our Services</Button></motion.div>
        </motion.div>
      </div>
    </section>
    <div className="path-strip"><div className="wrap">
      {[[CalendarDays,'Scheduling',request],[Building2,'Facility Referrals','/referrals'],[HeartHandshake,'Insurance & Billing','/billing']].map(([Icon,label,to])=>{
        const Tile=Icon as typeof CalendarDays
        return <Link key={String(to)} to={String(to)}><Tile size={23}/><span>{String(label)}</span></Link>
      })}
    </div></div>
    <section className="wrap section stack"><p className="eyebrow">Transportation options</p><h2>Our services</h2>
      {services.loading?<p role="status">Loading services…</p>:services.error?<p role="alert">{services.error}</p>:services.value.length?<Listings kind="services" items={services.value.slice(0,6)}/>:<p className="muted">Ask about availability for your transportation needs.</p>}
      <Button to="/services" secondary>View Services</Button>
    </section>
    <section className="soft section"><div className="wrap split"><PhotoCarousel/><motion.div className="stack" initial={reducedMotion?false:{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.4}} transition={{duration:.45}}><p className="eyebrow">About Rapid Nova</p><h2>Care for the journey</h2><p>{settings.aboutCopy||'Our mission is to approach medical transportation with professionalism, respect and compassion. We value clear communication at every step of the inquiry process.'}</p><Button to="/about" secondary>About Rapid Nova</Button></motion.div></div></section>
    {Boolean(settings.strengths?.length||settings.credentials?.length)&&<section className="wrap section stack"><h2>Why choose Rapid Nova</h2><div className="grid-cards">{[...(settings.strengths||[]),...(settings.credentials||[])].map(item=><p className="card" key={item}><ShieldCheck className="icon-tile"/>{item}</p>)}</div></section>}
    <section className="wrap section stack"><p className="eyebrow">Scheduling</p><h2>How it works</h2><ol className="grid-cards steps">{transportSteps.map((step,index)=><motion.li className="card stack" key={step} initial={reducedMotion?false:{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.3}} transition={{duration:.35,delay:index*.06}}><span>{index+1}</span><h3>{step}</h3></motion.li>)}</ol><p className="muted">Submitting an inquiry does not guarantee a booking.</p></section>
    <section className="dark section"><div className="wrap split"><div className="stack"><p className="eyebrow">Healthcare facilities</p><h2>Coordinate transportation with us</h2><p>We welcome inquiries from hospitals, nursing homes, rehabilitation centers, dialysis centers, assisted living facilities and healthcare organizations.</p><div className="action-row"><Button to="/referrals?category=partnership">Become a Partner</Button><Button to="/referrals" secondary>Patient Referral Inquiry</Button></div></div><EditorialPhoto name="facility" alt="Healthcare facility coordinator speaking with a medical transport crew member"/></div></section>
    <section className="wrap section split"><div className="stack"><MapPin className="icon-tile"/><h2>Texas service areas</h2><p className="muted">{areas.value.length?areas.value.map(area=>area.title).join(' · '):'Ask about availability in your area.'}</p>{settings.mapUrl&&<AreaMap url={settings.mapUrl} label="View location map"/>}<div><Button to="/service-areas" secondary>Explore Service Areas</Button></div></div><div className="card stack"><h3>Insurance and billing</h3><p>Ask about coverage, self-pay, billing assistance, payment questions or a transportation estimate.</p><Link className="text-link" to="/billing">Explore billing options</Link></div></section>
    {Boolean(testimonials.value.length)&&<section className="wrap section stack"><h2>What people say</h2><div className="grid-cards">{testimonials.value.map(item=><blockquote key={item.name+item.quote} className="card stack"><p>{item.quote}</p><cite>{item.name}</cite></blockquote>)}</div></section>}
    <section className="soft section"><div className="wrap split faq-split"><div className="stack"><p className="eyebrow">Patient resources</p><h2>Frequently asked questions</h2></div><Questions items={faqs}/></div></section>
    <section className="section red-cta"><div className="wrap split"><div className="stack"><h2>Planning a trip?</h2><p>Tell us how to reach you so we can discuss arrangements.</p></div><div className="action-row animated-cta"><Button to={request} secondary>Request Transport</Button><Link to="/contact" className="button outline">Contact Us</Link></div></div></section>
  </>
}
function Info({page,settings,faqs}:{page:string;settings:Settings;faqs:FAQ[]}){
  if(page==='about') return <><Intro label="About us" title="Respect at every step" photo={pagePhotos.about}>{settings.aboutCopy||'Rapid Nova Ambulance is a Texas-based medical transportation company.'}</Intro><section className="wrap section stack"><div className="stack about-feature"><h2>Our approach</h2><p className="muted">We value clear communication, privacy and respect when discussing transportation arrangements.</p></div><div className="grid-cards">{[['Our mission','Approach each transportation inquiry with professionalism and compassion.'],['Our vision','Make transportation arrangements clearer for patients, families and facility teams.'],['Our values','Respect, privacy, safety and clear communication.'],['Professional standards','We require staff review before transportation arrangements are confirmed.']].map(([title,copy])=><article className="card stack" key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div>{Boolean(settings.team?.length)&&<div className="stack"><h2>Our team</h2>{settings.team?.map(person=><p key={person}>{person}</p>)}</div>}<Button to="/contact">Contact Us</Button></section></>
  if(page==='billing') return <><Intro label="Patient resources" title="Insurance and billing" photo={pagePhotos.billing}>Get help with insurance questions, self-pay, payment assistance and estimates.</Intro><section className="wrap section stack">{settings.billingEmail&&<a className="text-link" href={'mailto:'+settings.billingEmail}>{settings.billingEmail}</a>}<Questions items={faqDefaults.slice(2,4)}/><Button to="/contact?category=estimate">Request an Estimate</Button></section></>
  if(page==='patient-resources') return <><Intro label="Patient resources" title="Planning your transportation" photo={pagePhotos['patient-resources']}/><section className="wrap section stack"><Questions items={faqs}/><Button to="/billing" secondary>Insurance and Billing</Button></section></>
  const legal={privacy:['Privacy Policy',settings.privacy],terms:['Terms of Use',settings.terms],accessibility:['Accessibility Statement',settings.accessibility],'notice-of-privacy-practices':['Notice of Privacy Practices',settings.npp]}[page]
  return <><Intro label="Rapid Nova Ambulance" title={legal?.[0]||'Page unavailable'} photo={legal?pagePhotos[page as 'privacy'|'terms'|'accessibility'|'notice-of-privacy-practices']:undefined}/><section className="wrap section stack">{legal?<><p className="legal-text">{legal[1]||'Draft placeholder. This document requires legal review before production.'}</p><Button to="/contact" secondary>Contact Us</Button></>:<Button to="/">Return Home</Button>}</section></>
}
function Inquiry({kind,settings}:{kind:FormKind;settings:Settings}){
  const entries={
    transport:['Scheduled transportation','Request transport','Share your contact details and general inquiry. Submitting a request does not guarantee a booking.'],
    referral:['Healthcare facilities','Patient referral inquiry','Start a conversation about referral coordination or partnership opportunities.'],
    contact:['Get in touch','Contact us','Send a general question about scheduling, partnership or billing.'],
    application:['Careers','Apply for a position','Submit your application for an open role.'],
  }
  const [label,title,copy]=entries[kind]
  return <><Intro label={label} title={title} photo={kind==='application'?undefined:pagePhotos[kind]}>{copy}</Intro><section className="wrap section form-page"><div className="card"><Forms kind={kind}/></div><aside className="stack"><h3>{kind==='contact'?'Company information':'Before you submit'}</h3><p><Emergency/></p><p>Keep this inquiry general. Leave out patient details, diagnoses, records and insurance identifiers.</p>{kind==='contact'&&<>{settings.phone&&<a className="button" href={'tel:'+settings.phone}>Call Dispatch</a>}{settings.email&&<p><a className="text-link" href={'mailto:'+settings.email}>{settings.email}</a></p>}{settings.hours&&<p>{settings.hours}</p>}{settings.location&&<p>{settings.location}</p>}{settings.mapUrl&&<AreaMap url={settings.mapUrl} label="View location map"/>}</>}</aside></section></>
}
function PublicRoutes(){
  const settings=useData<Settings>('/settings/public',{}).value
  const custom=useData<FAQ[]>('/faqs',[]).value
  const faqs=custom.length?custom:faqDefaults
  return <Routes>
    <Route element={<Shell settings={settings}/>}>
      <Route index element={<Home settings={settings} faqs={faqs}/>}/>
      {['services','service-areas','careers'].map(kind=><Route key={kind} path={kind}><Route index element={<Directory kind={kind}/>}/><Route path=":slug" element={<Detail kind={kind}/>}/></Route>)}
      {['about','patient-resources','billing','privacy','terms','accessibility','notice-of-privacy-practices'].map(page=><Route key={page} path={page} element={<Info page={page} settings={settings} faqs={faqs}/>}/>)}
      <Route path="request-transport" element={<Inquiry key="transport" kind="transport" settings={settings}/>}/>
      <Route path="referrals" element={<Inquiry key="referral" kind="referral" settings={settings}/>}/>
      <Route path="contact" element={<Inquiry key="contact" kind="contact" settings={settings}/>}/>
      <Route path="*" element={<Info page="missing" settings={settings} faqs={faqs}/>}/>
    </Route>
  </Routes>
}
export default function App(){
  return <BrowserRouter><MotionConfig reducedMotion="user"><Metadata/><Suspense fallback={<p className="wrap section" role="status">Loading…</p>}><Routes><Route path="/admin/*" element={<Admin/>}/><Route path="*" element={<PublicRoutes/>}/></Routes></Suspense></MotionConfig></BrowserRouter>
}
