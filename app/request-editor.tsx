import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/features/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { CATEGORIES, Category, HelpRequest } from '../src/features/requests/location';
import { useArea } from '../src/features/requests/RequestProviders';
import { Action, AreaPicker, Chip, s } from '../src/features/requests/ui';

export default function RequestEditor() {
  const params = useLocalSearchParams<{ id?: string }>(); const id = typeof params.id === 'string' ? params.id : undefined;
  const { session } = useAuth(); const { area, locating } = useArea(); const client = useQueryClient();
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('other'); const [hours, setHours] = useState(24);
  const initialized = useRef<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const existing = useQuery({ queryKey: ['request', id, session?.user.id], enabled: !!id && !!session, queryFn: async () => {
    if (!supabase) throw new Error('Not configured'); const { data, error } = await supabase.from('request_feed').select('*').eq('id', id!).single(); if (error) throw error; return data as HelpRequest;
  }});
  useEffect(() => { initialized.current = null; setError(''); if (!id) { setTitle(''); setDescription(''); setCategory('other'); setHours(24); } }, [id, session?.user.id]);
  useEffect(() => { if (id && existing.data?.id === id && initialized.current !== id) { setTitle(existing.data.title); setDescription(existing.data.description); setCategory(existing.data.category); initialized.current = id; } }, [existing.data, id]);
  async function save() {
    if (!supabase || !session || busy) return;
    if (title.trim().length < 3 || description.trim().length < 5) { setError('Add a title of at least 3 characters and a description of at least 5.'); return; }
    setBusy(true); setError('');
    try {
      const content = { title: title.trim(), description: description.trim(), category };
      let savedId: string;
      if (id) {
        const { data, error } = await supabase.from('help_requests').update(content).eq('id', id).eq('owner_id', session.user.id).select('id').single();
        if (error) throw error; savedId = data.id;
      } else {
        const { data, error } = await supabase.rpc('create_help_request', { request_title: content.title, request_description: content.description, request_category: category, request_area: area.label, request_lat: area.latitude, request_lon: area.longitude, duration_hours: hours });
        if (error) throw error; savedId = data as string;
      }
      await Promise.all([client.invalidateQueries({ queryKey: ['requests'] }), client.invalidateQueries({ queryKey: ['my-requests'] }), client.invalidateQueries({ queryKey: ['request', id] })]);
      router.replace({ pathname: '/request-detail', params: { id: savedId } });
    } catch (e) { setError(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Could not save your request. Please retry.'); }
    finally { setBusy(false); }
  }
  if (!session) return <Screen><Text style={s.title}>Sign in to ask for help.</Text><Action label="Go to account" onPress={() => router.replace('/account')} /></Screen>;
  if (id && existing.isPending) return <Screen><ActivityIndicator /></Screen>;
  if (id && (existing.isError || existing.data?.owner_id !== session.user.id || existing.data?.status !== 'open')) return <Screen><Text style={s.body}>This request is unavailable or can no longer be edited.</Text><Action label="Back to requests" onPress={() => router.replace('/nearby')} /></Screen>;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}><Screen>
    <Text accessibilityRole="header" style={s.title}>{id ? 'Edit your request' : 'Ask for a hand'}</Text>
    <Text style={s.body}>Everyday volunteer help. Keep addresses, phone numbers and exact meeting details out of this public request.</Text>
    <Text style={s.label}>What do you need?</Text><TextInput accessibilityLabel="Request title" style={s.input} placeholder="A hand carrying a package" value={title} onChangeText={setTitle} maxLength={80} editable={!busy} />
    <Text style={s.label}>A few details</Text><TextInput accessibilityLabel="Request description" style={[s.input, { minHeight: 120, textAlignVertical: 'top' }]} multiline value={description} onChangeText={setDescription} maxLength={1000} editable={!busy} />
    <Text style={s.label}>Category</Text><View style={s.chips}>{CATEGORIES.map(c => <Chip key={c.value} label={c.label} selected={category === c.value} onPress={() => { if (!busy) setCategory(c.value); }} />)}</View>
    {id ? <Text style={s.caption}>Area and expiry stay unchanged when editing.</Text> : <><AreaPicker disabled={busy} /><Text style={s.label}>Keep this request open for</Text><View style={s.chips}>{[6,24,72].map(h => <Chip key={h} label={h < 24 ? `${h} hours` : `${h / 24} day${h > 24 ? 's' : ''}`} selected={hours === h} onPress={() => { if (!busy) setHours(h); }} />)}</View></>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Action disabled={busy || locating} label={busy ? 'Saving…' : id ? 'Save changes' : 'Post request'} onPress={save} />
    <Action secondary label="Back to requests" disabled={busy} onPress={() => router.replace('/nearby')} />
  </Screen></KeyboardAvoidingView>;
}
