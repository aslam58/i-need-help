import { Text } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { Action, s } from '../requests/ui';
export function ChatLinks({requestId}:{requestId:string}){
 const {session}=useAuth();
 const q=useQuery({queryKey:['chats',session?.user.id,requestId],enabled:!!session,queryFn:async()=>{const {data,error}=await supabase!.from('conversations').select('id,closed_at').eq('request_id',requestId).order('created_at',{ascending:false});if(error)throw error;return data;},refetchInterval:10000});
 return <>{q.isError&&<Text style={s.error}>Could not load chats.</Text>}{q.data?.map((c,i)=><Action key={c.id} label={c.closed_at?`View previous chat ${i+1}`:'Open private chat'} onPress={()=>router.push({pathname:'/chat',params:{id:c.id}})}/>)}</>;
}
