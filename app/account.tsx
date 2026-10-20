import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationPanel } from '../src/features/notifications/NotificationPanel';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import { ProfilePanel } from '../src/features/auth/ProfilePanel';
import { useAuth } from '../src/features/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { colors, radius } from '../src/theme/tokens';

export default function Account() {
  const { session, loading, error: restoreError } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  async function submit() {
    if (!supabase || busy) return;
    setMessage(''); setFailed(false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
      setFailed(true); setMessage('Enter your email and password.'); return;
    }
    if (mode === 'signup' && password.length < 8) {
      setFailed(true); setMessage('Choose a password with at least 8 characters.'); return;
    }
    setBusy(true);
    try {
      const credentials = { email: email.trim(), password };
      const result = mode === 'signin' ? await supabase.auth.signInWithPassword(credentials) : await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: Linking.createURL('auth-callback') } });
      if (result.error) { setFailed(true); setMessage(result.error.message); }
      else {
        setPassword('');
        if (mode === 'signup' && !result.data.session) setMessage('Check your email for confirmation, then return here to sign in. If no email arrives, contact the developer to check email delivery.');
      }
    } catch { setFailed(true); setMessage('Could not connect. Check your internet and try again.'); }
    finally { setBusy(false); }
  }

  async function testEmailReturn() {
    if (!__DEV__ || !supabase || busy || !session?.user.email) return;
    setBusy(true); setFailed(false); setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: session.user.email, options: { shouldCreateUser: false, emailRedirectTo: Linking.createURL('auth-callback') } });
      if (error) { setFailed(true); setMessage(error.message); }
      else setMessage('Test link sent. Open it from your email on this phone, then tap Go to account.');
    } catch { setFailed(true); setMessage('Could not send the test link. Please try again.'); }
    finally { setBusy(false); }
  }

  async function resendConfirmation() {
    if (!supabase || busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setFailed(true); setMessage('Enter your email first.'); return; }
    setBusy(true); setFailed(false); setMessage('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: Linking.createURL('auth-callback') } });
      if (error) { setFailed(true); setMessage(error.message); }
      else setMessage('If your account needs confirmation, check your email for a new link.');
    } catch { setFailed(true); setMessage('Could not connect. Please try again.'); }
    finally { setBusy(false); }
  }

  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const token = await AsyncStorage.getItem('chat-push-token');
      if (token) { const removal = await supabase.from('device_tokens').delete().eq('token',token).eq('user_id',session!.user.id); if(removal.error) throw removal.error; await AsyncStorage.removeItem('chat-push-token'); }
      const { error } = await supabase.auth.signOut();
      if (error) { setFailed(true); setMessage('Sign-out did not finish. Please try again.'); }
    } catch { setFailed(true); setMessage('Could not sign out. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
    <Screen>
      {loading ? <><ActivityIndicator color={colors.primary} /><Text style={s.body}>Restoring your session…</Text></> : session ? <>
        <Text accessibilityRole="header" style={s.title}>You’re signed in.</Text>
        <Text style={s.body}>{session.user.email}</Text>
        <Text style={s.body}>Welcome, neighbor. Your profile is ready for the Puducherry pilot.</Text>
        <ProfilePanel key={session.user.id} userId={session.user.id} />
        <NotificationPanel key={`notifications-${session.user.id}`} />
        {__DEV__ && <View style={s.field}>
          <Text style={s.caption}>Development check: sends a one-time sign-in link to your own email to test returning to the app.</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={testEmailReturn} style={s.switch}><Text style={s.switchText}>Test email return</Text></Pressable>
        </View>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={signOut} style={[s.button, busy && s.disabled]}><Text style={s.buttonText}>{busy ? 'Signing out…' : 'Sign out'}</Text></Pressable>
      </> : <>
        <Text accessibilityRole="header" style={s.title}>{mode === 'signin' ? 'Welcome back.' : 'Meet your neighbors.'}</Text>
        <Text style={s.body}>{mode === 'signin' ? 'Sign in to your account.' : 'Create an account for everyday help.'}</Text>
        {restoreError && <Text accessibilityRole="alert" style={s.error}>{restoreError}</Text>}
        <View style={s.field}><Text style={s.label}>Email</Text><TextInput accessibilityLabel="Email" style={s.input} value={email} onChangeText={setEmail} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" placeholderTextColor={colors.muted} /></View>
        <View style={s.field}><Text style={s.label}>Password</Text><TextInput accessibilityLabel="Password" style={s.input} value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} textContentType={mode === 'signup' ? 'newPassword' : 'password'} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} placeholderTextColor={colors.muted} returnKeyType="done" onSubmitEditing={submit} /></View>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !supabase }} disabled={busy || !supabase} onPress={submit} style={[s.button, (busy || !supabase) && s.disabled]}><Text style={s.buttonText}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); setPassword(''); }} style={s.switch}><Text style={s.switchText}>{mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy || !supabase} onPress={resendConfirmation} style={s.switch}><Text style={s.switchText}>Resend confirmation email</Text></Pressable>
        <Text style={s.caption}>Development preview · Everyday volunteer help in Puducherry.</Text>
      </>}
      {!!message && <Text accessibilityLiveRegion="polite" style={failed ? s.error : s.body}>{message}</Text>}
    </Screen>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text },
  body: { fontSize: 16, lineHeight: 24, color: colors.muted },
  field: { gap: 8 }, label: { fontSize: 15, fontWeight: '600', color: colors.text },
  input: { minHeight: 52, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, backgroundColor: colors.surface, color: colors.text, fontSize: 16 },
  button: { minHeight: 56, padding: 16, justifyContent: 'center', borderRadius: radius.control, backgroundColor: colors.primary },
  buttonText: { color: colors.surface, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.6 }, switch: { minHeight: 48, justifyContent: 'center' },
  switchText: { color: colors.primary, fontSize: 16, textAlign: 'center', fontWeight: '600' },
  error: { color: '#A12626', fontSize: 15, lineHeight: 23 }, caption: { fontSize: 13, lineHeight: 20, color: colors.muted },
});
