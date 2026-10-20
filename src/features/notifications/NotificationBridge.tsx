import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
export function NotificationBridge() {
 const { session } = useAuth();
 useEffect(() => {
  if (!session || !supabase || Constants.appOwnership === 'expo') return;
  let active = true; let cleanup = () => {};
  const userId = session.user.id;
  void import('expo-notifications').then(async N => {
   if (!active) return;
   N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: active, shouldShowList: active, shouldPlaySound: false, shouldSetBadge: false }) });
   const open = (response: import('expo-notifications').NotificationResponse | null) => {
    const id = response?.notification.request.content.data?.conversation_id;
    if (active && typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) router.push({ pathname: '/chat', params: { id } });
   };
   let registering = false;
   const refreshToken = async () => {
    if (!active || registering) return; registering = true;
    try {
     const permission = await N.getPermissionsAsync();
     const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
     if (!active || permission.status !== 'granted' || !projectId) return;
     const { data: token } = await N.getExpoPushTokenAsync({ projectId });
     const current = await supabase!.auth.getSession();
     if (!active || current.data.session?.user.id !== userId) return;
     // Rebind this installation even if alerts are off for the new account.
     // Preferences remain authoritative and this never prompts for permission.
     const { error } = await supabase!.rpc('register_chat_device', { push_token: token, device_platform: Platform.OS });
     if (!error && active) await AsyncStorage.setItem('chat-push-token', token);
    } catch { /* Manual enable/retry remains available in Account. */ }
    finally { registering = false; }
   };
   const responseListener = N.addNotificationResponseReceivedListener(open);
   const tokenListener = N.addPushTokenListener(() => { void refreshToken(); });
   const appListener = AppState.addEventListener('change', state => { if (state === 'active') void refreshToken(); });
   cleanup = () => { responseListener.remove(); tokenListener.remove(); appListener.remove(); };
   void refreshToken();
   open(await N.getLastNotificationResponseAsync()); await N.clearLastNotificationResponseAsync();
  }).catch(() => {});
  return () => { active = false; cleanup(); };
 }, [session?.user.id]);
 return null;
}
