import { dispatchPush,collectReceipts } from './_shared-push.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
// The gateway validates JWTs; getUser independently validates the caller with Auth.
Deno.serve(async (req: Request) => {
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const authorization=req.headers.get('Authorization');if(!authorization)return new Response('Unauthorized',{status:401});
 const url=Deno.env.get('SUPABASE_URL')!;
 const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const {data:{user},error:authError}=await caller.auth.getUser();if(authError||!user)return new Response('Unauthorized',{status:401});
 let id:string;let action:string|undefined;try{const body=await req.json();action=body.action;id=body.message_id;if(action==='receipts')id='00000000-0000-0000-0000-000000000000';if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw Error();}catch{return new Response('Invalid request',{status:400});}
 const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 if(action==='receipts')return collectReceipts(db,user.id);
 const {data:message,error}=await db.from('messages').select('id,sender_id,conversation_id,created_at').eq('id',id).single();
 if(error||message.sender_id!==user.id)return new Response('Unavailable',{status:403});
 // Notification hints are bounded; old messages cannot be used to replay push traffic.
 if(Date.now()-Date.parse(message.created_at)>10*60*1000)return Response.json({claimed:0,reason:'expired'});
 return dispatchPush(db,message);
});
