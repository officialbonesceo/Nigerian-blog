import type { APIRoute } from 'astro';
import { getD1,logVisitorSession } from '../../../lib/runtime-db';
export const POST:APIRoute=async({request,locals})=>{try{const b=await request.json().catch(()=>({}));if(!b.session_id||!b.page_path)return new Response(JSON.stringify({success:false}),{status:400});await logVisitorSession(getD1(locals),b);return new Response(JSON.stringify({success:true}),{headers:{'Content-Type':'application/json'}})}catch{return new Response(JSON.stringify({success:false}),{status:500})}};
