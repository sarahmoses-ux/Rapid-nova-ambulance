import {useState} from 'react'
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion'
import {ChevronLeft,ChevronRight} from 'lucide-react'

const homepagePhotos=[
  {file:'team',title:'Medical transport crew',alt:'Two uniformed crew members walking beside an ambulance'},
  {file:'roadside-ambulance',title:'On the road',alt:'An ambulance parked at a highway rest area'},
  {file:'clinic-exterior',title:'Healthcare destinations',alt:'A clinic entrance at twilight'},
]
const careerPhotos=[
  {file:'careers',title:'Equipment preparation',alt:'A technician checking equipment inside an ambulance'},
  {file:'stretcher-inspection',title:'Vehicle readiness',alt:'A technician inspecting an empty stretcher'},
  {file:'dispatch-radio',title:'Dispatch coordination',alt:'A dispatcher checking a radio at a desk'},
]

export default function PhotoCarousel({careerFocus=false}:{careerFocus?:boolean}){
  const slides=careerFocus?careerPhotos:homepagePhotos
  const [index,setIndex]=useState(0)
  const reducedMotion=useReducedMotion()
  const slide=slides[index]
  const step=(direction:number)=>setIndex(current=>(current+direction+slides.length)%slides.length)
  return <div className="photo-carousel" role="region" aria-roledescription="carousel" aria-label={careerFocus?"Careers photo gallery":"Medical transportation photos"} onKeyDown={event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault()
      step(event.key==='ArrowRight'?1:-1)
    }
  }}>
    <div className="carousel-frame">
      <AnimatePresence initial={false}>
        <motion.img key={slide.file} className="carousel-photo" src={'/'+slide.file+'.jpg'} alt={slide.alt} loading="lazy"
          initial={{opacity:reducedMotion?1:0}} animate={{opacity:1}} exit={{opacity:0}}
          transition={{duration:reducedMotion?0:.3}}/>
      </AnimatePresence>
      <span className="carousel-credit">Illustrative photo</span>
    </div>
    <div className="carousel-controls">
      <button type="button" aria-label="Previous photo" onClick={()=>step(-1)}><ChevronLeft size={22}/></button>
      <div className="carousel-indicators" aria-label="Choose a photo">{slides.map((item,i)=><button key={item.file} type="button" aria-label={item.title} aria-current={index===i?'true':undefined} onClick={()=>setIndex(i)}><span/></button>)}</div>
      <button type="button" aria-label="Next photo" onClick={()=>step(1)}><ChevronRight size={22}/></button>
    </div>
    <p className="carousel-caption" aria-live="polite" aria-atomic="true">{slide.title} <span>· {index+1} of {slides.length}</span></p>
  </div>
}
