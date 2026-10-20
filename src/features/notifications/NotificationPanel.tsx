import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import { Action, s } from '../requests/ui';
export function NotificationPanel(){
 const {session}=useAuth();const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');
 const q=useQuery({queryKey:['notification-preferences',session?.user.id],enabled:!!session,queryFn:async()=>{const {data,error}=await supabase!.from('notification_preferences').select('chat_enabled').maybeSingle();if(error)throw error;return data?.chat_enabled??false;}});
 async function preference(enabled:boolean){if(!supabase||!session||busy)return;setBusy(true);setStatus('');
 try{
  if(enabled){
   const projectId=Constants.expoConfig?.extra?.eas?.projectId??Constants.easConfig?.projectId;
   if(Constants.appOwnership==='expo'||!Device.isDevice||!projectId)throw new Error('Push needs an installed development build on a real phone and an EAS project. Chat still works in Expo Go.');
   const Notifications=await import('expo-notifications');
   if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('chat',{name:'Private chat',importance:Notifications.AndroidImportance.DEFAULT});
   const permission=await Notifications.requestPermissionsAsync();if(permission.status!=='granted')throw new Error('Notifications are not permitted. You can allow them in phone settings.');
   const {data:token}=await Notifications.getExpoPushTokenAsync({projectId});
   const {error}=await supabase.rpc('register_chat_device',{push_token:token,device_platform:Platform.OS});if(error)throw error;
   await AsyncStorage.setItem('chat-push-token',token);
  }
  const {error}=await supabase.from('notification_preferences').upsert({user_id:session.user.id,chat_enabled:enabled});if(error)throw error;
  await q.refetch();setStatus(enabled?'Chat alerts enabled. Delivery still requires device testing.':'Chat alerts disabled on all your devices.');
 }catch(e){setStatus(e instanceof Error?e.message:'Could not save notification settings.');}finally{setBusy(false);}}
 return <View style={s.box}><Text style={s.heading}>Chat notifications</Text><Text style={s.body}>{q.isPending?'Loading preferences…':q.isError?'Could not load preferences.':q.data?'Enabled':'Disabled'}</Text><Text style={s.caption}>Alerts contain no message text. Push requires a configured installed build; Expo Go can use chat without push.</Text><Action label={q.data?'Disable chat alerts':'Enable chat alerts on this phone'} disabled={busy||q.isPending||q.isError} onPress={()=>preference(!q.data)}/>{q.isError&&<Action label="Retry preferences" onPress={()=>q.refetch()}/>}<Action secondary label="Blocked neighbors" onPress={()=>{void import('expo-router').then(({router})=>router.push('/blocked'));}}/>{!!status&&<Text accessibilityLiveRegion="polite" style={s.caption}>{status}</Text>}</View>;
}
