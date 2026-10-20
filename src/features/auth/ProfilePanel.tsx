import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors, radius } from '../../theme/tokens';

export function ProfilePanel({ userId }: { userId: string }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const client = supabase;
    setLoading(true); setMessage(''); setName(''); setRequested(false); setFailed(false);
    if (!client) { setLoading(false); setFailed(true); setMessage('Profile connection is unavailable.'); return; }
    (async () => {
      // Insert only the caller's profile; the database verifies ownership.
      const { error: insertError } = await client.from('profiles').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (insertError) throw insertError;
      const [{ data, error }, deletion] = await Promise.all([
        client.from('profiles').select('display_name').eq('user_id', userId).single(),
        client.from('account_deletion_requests').select('user_id').eq('user_id', userId).maybeSingle(),
      ]);
      if (error || deletion.error) throw error || deletion.error;
      if (active) { setName(data.display_name); setRequested(!!deletion.data); }
    })().catch(() => { if (active) { setFailed(true); setMessage('Could not load your profile. Please retry.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, retry]);

  async function save() {
    if (!supabase || busy) return;
    if (!name.trim() || name.trim().length > 60) { setFailed(true); setMessage('Use a name between 1 and 60 characters.'); return; }
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('user_id', userId).select('user_id').single();
      if (error) throw error;
      setName(name.trim()); setMessage('Profile saved.');
    } catch { setFailed(true); setMessage('Could not save. Please try again.'); }
    finally { setBusy(false); }
  }

  async function requestDeletion() {
    if (!supabase || busy || requested) return;
    setBusy(true); setFailed(false); setMessage('');
    try {
      const { error } = await supabase.from('account_deletion_requests').insert({ user_id: userId });
      if (error && error.code !== '23505') throw error;
      setRequested(true);
      setMessage('Deletion request recorded. Your account remains active until it is processed.');
    } catch { setFailed(true); setMessage('Could not record your request. Please try again.'); }
    finally { setBusy(false); }
  }

  return <View style={s.panel}>
    <Text accessibilityRole="header" style={s.title}>Your profile</Text>
    {loading ? <Text style={s.body}>Loading profile…</Text> : failed && !name ?
      <Pressable accessibilityRole="button" onPress={() => setRetry(retry + 1)} style={s.button}><Text style={s.buttonText}>Retry profile</Text></Pressable> : <>
      <Text style={s.label}>Your name</Text>
      <TextInput accessibilityLabel="Your name" value={name} onChangeText={setName} editable={!busy} maxLength={60} autoComplete="name" style={s.input} />
      <Text style={s.body}>Your name is shared with requesters when you offer to help.</Text>
      <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={save} style={[s.button, busy && s.disabled]}><Text style={s.buttonText}>{busy ? 'Please wait…' : 'Save profile'}</Text></Pressable>
      <Text accessibilityRole="header" style={s.title}>Account deletion</Text>
      <Text style={s.body}>{requested ? 'Your request is recorded. Your account is still active.' : 'You can record a deletion request. Processing is not yet available in this preview.'}</Text>
      {!requested && <Pressable accessibilityRole="button" disabled={busy} onPress={() => Alert.alert('Request account deletion?', 'This records your request. It does not delete your account immediately.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Record request', onPress: requestDeletion }])} style={s.secondary}><Text style={s.secondaryText}>Request account deletion</Text></Pressable>}
    </>}
    {!!message && <Text accessibilityLiveRegion="polite" style={[s.body, failed && s.error]}>{message}</Text>}
  </View>;
}
const s = StyleSheet.create({
  panel: { gap: 12, padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 18, fontWeight: '700', color: colors.text }, label: { fontSize: 15, fontWeight: '600', color: colors.text },
  body: { fontSize: 14, lineHeight: 22, color: colors.muted }, input: { fontSize: 16, padding: 14, minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, color: colors.text },
  button: { padding: 16, minHeight: 52, borderRadius: radius.control, backgroundColor: colors.primary }, buttonText: { fontSize: 16, fontWeight: '700', color: colors.surface, textAlign: 'center' },
  secondary: { padding: 14, minHeight: 48, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.control }, secondaryText: { color: colors.primary, fontWeight: '600', textAlign: 'center', fontSize: 15 },
  disabled: { opacity: 0.6 }, error: { color: '#A12626' },
});
