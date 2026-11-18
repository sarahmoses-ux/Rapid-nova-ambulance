import axios from 'axios'
import {useEffect,useState} from 'react'

export const api=axios.create({baseURL:import.meta.env.VITE_API_BASE || '/api',withCredentials:true,timeout:25000})
export function errorMessage(error:unknown){
  return axios.isAxiosError(error)&&typeof error.response?.data?.error==='string'?error.response.data.error:'The request could not be completed. Please try again.'
}
export function useData<T>(path:string,initial:T){
  const [state,setState]=useState({path,value:initial,loading:true,error:''})
  useEffect(()=>{
    const controller=new AbortController()
    api.get(path,{signal:controller.signal}).then(({data})=>setState({path,value:data.data,loading:false,error:''})).catch(error=>{
      if(!controller.signal.aborted) setState({path,value:initial,loading:false,error:errorMessage(error)})
    })
    return ()=>controller.abort()
  // The initial value is used only as a fallback when the path changes.
  },[path])
  return state.path===path?state:{value:initial,loading:true,error:''}
}
export type FAQ={question:string;answer:string}
export type Listing={_id:string;title:string;slug:string;description:string;image?:string;audience?:string;benefits?:string[];faqs?:FAQ[];phone?:string;mapUrl?:string;services?:string[];location?:string;employmentType?:string}
export type Settings={phone?:string;email?:string;hours?:string;location?:string;mapUrl?:string;billingEmail?:string;socials?:string[];announcement?:string;heroHeadline?:string;heroCopy?:string;heroImage?:string;aboutCopy?:string;strengths?:string[];credentials?:string[];team?:string[];privacy?:string;terms?:string;accessibility?:string;npp?:string}
