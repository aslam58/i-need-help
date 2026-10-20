import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { dispatchPush,collectReceipts } from './_shared-push.ts';
// This internal endpoint uses a Vault-generated worker secret, never a client JWT.
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=req.headers.get('x-chat-worker');if(!secret||secret.length>200)return new Response('Unauthorized',{status:401});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const {data:valid,error}=await db.rpc('verify_chat_worker',{worker_secret:secret});if(error||valid!==true)return new Response('Unauthorized',{status:401});
 let body:{action?:string};try{body=await req.json();}catch{return new Response('Invalid request',{status:400});}
 if(body.action==='health')return Response.json({authenticated:true});
 const {data:pending,error:lookup}=await db.rpc('pending_chat_push');if(lookup)return new Response('Queue unavailable',{status:503});
 // Bound concurrent requests so a slow Expo request cannot hold a serial backlog.
 for(let i=0;i<(pending?.length??0);i+=5){await Promise.all(pending.slice(i,i+5).map(async(p:{message_id:string;sender_id:string})=>{
  const {data:message,error}=await db.from('messages').select('id,sender_id,conversation_id').eq('id',p.message_id).single();if(!error&&message)await dispatchPush(db,message);
 }));}
 const receipts=await collectReceipts(db,null);
 return Response.json({processed:pending?.length??0,receipts_ok:receipts.ok});
});
