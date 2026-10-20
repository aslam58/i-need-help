export async function dispatchPush(db:any,message:{id:string;sender_id:string;conversation_id:string}){
 const {data:targets,error:claimError}=await db.rpc('claim_chat_push',{target_message:message.id,actor:message.sender_id});
 if(claimError)return new Response('Could not claim delivery',{status:503});
 let accepted=0;
 for(const target of targets??[]){
  try{
   const res=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',...(Deno.env.get('EXPO_ACCESS_TOKEN')?{Authorization:`Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`}:{})},body:JSON.stringify({to:target.token,title:'I need help',body:'You have a new private chat message.',data:{conversation_id:message.conversation_id,message_id:message.id},channelId:'chat',sound:'default'}),signal:AbortSignal.timeout(10000)});
   if(!res.ok)throw Error(`Expo HTTP ${res.status}`);
   const payload=await res.json();const ticket=payload.data;
   await db.rpc('record_chat_ticket',{target_message:message.id,push_token:target.token,push_ticket:ticket?.status==='ok'?ticket.id:null,push_error:ticket?.status==='error'?(ticket.details?.error??'Expo rejected'):null});
   if(ticket?.status==='ok')accepted++;
   if(ticket?.details?.error==='DeviceNotRegistered')await db.from('device_tokens').delete().eq('token',target.token);
  }catch{await db.rpc('record_chat_ticket',{target_message:message.id,push_token:target.token,push_ticket:null,push_error:'Delivery outcome unknown; do not automatically resend'});}
 }
 return Response.json({claimed:targets?.length??0,accepted});
}

export async function collectReceipts(db:any,sender:string|null){
  const {data:pending,error}=await db.rpc('pending_chat_receipts',{sender});if(error)return new Response('Receipt lookup failed',{status:503});
  if(!pending?.length)return Response.json({checked:0});
  try{
   const res=await fetch('https://exp.host/--/api/v2/push/getReceipts',{method:'POST',headers:{'Content-Type':'application/json',...(Deno.env.get('EXPO_ACCESS_TOKEN')?{Authorization:`Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`}:{})},body:JSON.stringify({ids:pending.map((p:{ticket_id:string})=>p.ticket_id)}),signal:AbortSignal.timeout(10000)});
   if(!res.ok)throw Error();const payload=await res.json();let checked=0;
   for(const p of pending){const receipt=payload.data?.[p.ticket_id];if(receipt?.status==='ok'||receipt?.status==='error'){const {error}=await db.rpc('record_chat_receipt',{push_ticket:p.ticket_id,delivery_status:receipt.status,delivery_error:receipt.details?.error??null});if(!error)checked++;}}
   return Response.json({checked});
  }catch{return new Response('Receipt service unavailable',{status:503});}
 }
