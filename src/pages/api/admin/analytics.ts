import type { APIRoute } from 'astro';
import { getD1,getAnalyticsMetrics } from '../../../lib/runtime-db';
export const GET:APIRoute=async({locals})=>{try{return new Response(JSON.stringify({success:true,analytics:await getAnalyticsMetrics(getD1(locals))}),{headers:{'Content-Type':'application/json'}})}catch(e:any){return new Response(JSON.stringify({success:false,error:e.message}),{status:500})}};
