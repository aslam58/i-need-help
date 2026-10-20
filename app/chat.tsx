import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/features/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { Action, s } from '../src/features/requests/ui';
type Message = { id: string; sender_id: string; body: string; created_at: string };
export default function Chat() {
 const { id } = useLocalSearchParams<{ id: string }>(); const { session } = useAuth();
 const [body,setBody]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 const pending=useRef<{id:string;body:string}|null>(null);
 const chat=useQuery({queryKey:['chat',session?.user.id,id],enabled:!!session&&typeof id==='string',queryFn:async()=>{
  const {data,error}=await supabase!.from('conversations').select('*').eq('id',id).single(); if(error)throw error; return data;
 },refetchInterval:15000});
 const messages=useQuery({queryKey:['messages',session?.user.id,id],enabled:!!chat.data,queryFn:async()=>{
  const {data,error}=await supabase!.from('messages').select('id,sender_id,body,created_at').eq('conversation_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100); if(error)throw error;return (data as Message[]).reverse();
 },refetchInterval:15000});
 useEffect(()=>{if(!supabase||!session||!id)return;
 const receipts=()=>{void supabase?.functions.invoke('dispatch-chat',{body:{action:'receipts'}}).catch(()=>{});};receipts();const timer=setInterval(receipts,60000); const channel=supabase.channel(`chat:${session.user.id}:${id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${id}`},()=>{void messages.refetch();}).subscribe();return()=>{clearInterval(timer);void supabase?.removeChannel(channel);};},[id,session?.user.id]);
 async function send(){if(!supabase||busy||!body.trim())return;setBusy(true);setError('');
  const draft=pending.current?.body===body.trim()?pending.current:{id:Crypto.randomUUID(),body:body.trim()};pending.current=draft;
  try{const {error}=await supabase.rpc('send_chat',{target_conversation:id,message_id:draft.id,message_body:draft.body});if(error)throw error;
   setBody('');pending.current=null;await messages.refetch();
   // Push failure must never retry the message mutation with a new ID.
   void supabase.functions.invoke('dispatch-chat',{body:{message_id:draft.id}}).then(({error})=>{if(error)setError('Message saved. The notification could not be confirmed; your neighbor can still read the chat.');}).catch(()=>setError('Message saved. The notification could not be confirmed.'));
  }catch(e){setError(e&&typeof e==='object'&&'message' in e?String(e.message):'Could not send. Retry to send the same message.');}finally{setBusy(false);}}
 const other=chat.data?.requester_id===session?.user.id?chat.data?.helper_id:chat.data?.requester_id;
 async function block(){if(!supabase||!session||!other)return;setBusy(true);const {error}=await supabase.from('blocks').upsert({blocker_id:session.user.id,blocked_id:other},{ignoreDuplicates:true});setBusy(false);setError(error?'Could not block. Try again.':'Neighbor blocked. Messages cannot be sent between you.');}
 return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={90}><Screen>
 <Text style={s.title}>Private chat</Text>
 {!session?<Text style={s.body}>Sign in to read your chat.</Text>:chat.isPending?<Text style={s.body}>Loading chat…</Text>:chat.isError?<><Text style={s.error}>Chat unavailable.</Text><Action label="Retry" onPress={()=>chat.refetch()}/></>:<>
 <Text style={s.caption}>{chat.data?.closed_at?'This chat is read-only.':'Only you and the accepted neighbor can read this chat.'} Latest 100 messages.</Text>
 {messages.isError&&<><Text style={s.error}>Could not load messages.</Text><Action label="Retry messages" onPress={()=>messages.refetch()}/></>}
 {!chat.isError&&messages.data?.map(m=><View key={m.id} style={s.box}><Text style={s.label}>{m.sender_id===session.user.id?'You':'Neighbor'}</Text><Text style={s.body}>{m.body}</Text><Text style={s.caption}>{new Date(m.created_at).toLocaleString()}</Text></View>)}
 {!chat.data?.closed_at&&<><TextInput accessibilityLabel="Message" multiline maxLength={2000} value={body} editable={!busy} onChangeText={setBody} style={s.input} placeholder="Write a message"/><Action label={busy?'Sending…':'Send message'} disabled={busy||!body.trim()} onPress={send}/></>}
 <Action secondary label="Block this neighbor" disabled={busy} onPress={block}/>
 </>}
 {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
 <Action secondary label="Back" onPress={()=>router.back()}/>
 </Screen></KeyboardAvoidingView>;
}
