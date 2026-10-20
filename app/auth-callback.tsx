import { useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Screen } from '../src/components/Screen';
import { supabase } from '../src/lib/supabase';
import { parseConfirmationCallback } from '../src/features/auth/callbackParams';
import { colors } from '../src/theme/tokens';

export default function ConfirmationCallback() {
  const url = Linking.useURL();
  const [status, setStatus] = useState<'checking' | 'success' | 'manual'>('checking');
  const request = useRef<{ url: string; promise: Promise<boolean> } | null>(null);
  useEffect(() => {
    if (!url) { setStatus('manual'); return; }
    let active = true;
    if (request.current?.url !== url) {
      const parsed = parseConfirmationCallback(url, Linking.createURL('auth-callback'));
      // PKCE binds the emailed code to the device that created the account.
      const promise = (async () => {
        if (!supabase || parsed.kind !== 'code') return false;
        const { error } = await supabase.auth.exchangeCodeForSession(parsed.code, parsed.flowId ? { flowId: parsed.flowId } : undefined);
        return !error;
      })().catch(() => false);
      request.current = { url, promise };
    }
    request.current.promise.then(ok => { if (active) setStatus(ok ? 'success' : 'manual'); });
    return () => { active = false; };
  }, [url]);
  return <Screen>
    <Text accessibilityRole="header" style={s.title}>{status === 'checking' ? 'Confirming your email…' : status === 'success' ? 'You’re ready, neighbor.' : 'Return to your account.'}</Text>
    {status === 'checking' ? <ActivityIndicator color={colors.primary} /> : <>
      <Text accessibilityLiveRegion="polite" style={s.body}>{status === 'success' ? 'Your email is confirmed and you’re signed in.' : 'This link may have expired, already been used, or opened on a different device. Try signing in. If your email is still unconfirmed, request a new confirmation email from Account.'}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/account')} style={s.button}><Text style={s.buttonText}>Go to account</Text></Pressable>
    </>}
  </Screen>;
}
const s = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text }, body: { fontSize: 16, lineHeight: 24, color: colors.muted },
  button: { backgroundColor: colors.primary, padding: 18, minHeight: 56, borderRadius: 14 }, buttonText: { color: colors.surface, fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
