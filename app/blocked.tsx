import { useState } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/features/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { Action,s } from '../src/features/requests/ui';
export default function Blocked(){const {session}=useAuth();const [error,setError]=useState('');const [busy,setBusy]=useState(false);const q=useQuery({queryKey:['blocks',session?.user.id],enabled:!!session,queryFn:async()=>{const {data,error}=await supabase!.from('blocks').select('blocked_id,created_at').order('created_at');if(error)throw error;return data;}});
async function unblock(id:string){if(busy||!session)return;setBusy(true);setError('');try{const {error}=await supabase!.from('blocks').delete().eq('blocker_id',session.user.id).eq('blocked_id',id);if(error)throw error;await q.refetch();}catch{setError('Could not unblock. Try again.');}finally{setBusy(false);}}
return <Screen><Text style={s.title}>Blocked neighbors</Text>{!session?<Text style={s.body}>Sign in to manage blocks.</Text>:q.isPending?<Text style={s.body}>Loading…</Text>:q.isError?<><Text style={s.error}>Could not load blocks.</Text><Action label="Retry" onPress={()=>q.refetch()}/></>:<>{!q.data?.length&&<Text style={s.body}>No blocked neighbors.</Text>}{q.data?.map((b,i)=><Action key={b.blocked_id} secondary disabled={busy} label={`Unblock neighbor ${i+1} · ${new Date(b.created_at).toLocaleDateString()}`} onPress={()=>unblock(b.blocked_id)}/>)}</>}{!!error&&<Text style={s.error}>{error}</Text>}<Action secondary label="Back" onPress={()=>router.back()}/></Screen>;
}
