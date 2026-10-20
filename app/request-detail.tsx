import { ChatLinks } from '../src/features/chat/ChatLinks';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '../src/components/Screen';
import { useAuth } from '../src/features/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { OffersPanel } from '../src/features/offers/OffersPanel';
import { StatusBadge } from '../src/features/requests/StatusBadge';
import { CATEGORIES, HelpRequest } from '../src/features/requests/location';
import { Action, s } from '../src/features/requests/ui';

export default function RequestDetail() {
  const params = useLocalSearchParams<{ id: string }>(); const id = typeof params.id === 'string' ? params.id : '';
  const { session } = useAuth(); const client = useQueryClient(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['request', id, session?.user.id], enabled: !!id && !!session, queryFn: async () => {
    if (!supabase) throw new Error('Not configured'); const { data, error } = await supabase.from('request_feed').select('*').eq('id', id).single(); if (error) throw error; return data as HelpRequest;
  }, refetchInterval: 30000 });
  async function transition(action: 'cancel_request' | 'complete_request') {
    if (!supabase || !session || busy) return; setBusy(true); setError('');
    try {
      const { error } = await supabase.rpc(action, { target_request: id }); if (error) throw error;
      await Promise.all([client.invalidateQueries({ queryKey: ['request', id] }), client.invalidateQueries({ queryKey: ['requests'] }), client.invalidateQueries({ queryKey: ['my-requests'] }), client.invalidateQueries({ queryKey: ['offers'] }), client.invalidateQueries({ queryKey: ['my-offers'] }), client.invalidateQueries({ queryKey: ['chats'] })]);
    } catch { setError('Could not update the request. It may have changed. Refresh and try again.'); }
    finally { setBusy(false); }
  }
  if (!session) return <Screen><Text style={s.body}>Sign in to view this request.</Text><Action label="Go to account" onPress={() => router.replace('/account')} /></Screen>;
  if (query.isPending && id) return <Screen><ActivityIndicator /></Screen>;
  if (!query.data || query.isError) return <Screen><Text style={s.body}>This request is unavailable. It may have expired or been cancelled.</Text><Action label="Retry" onPress={() => query.refetch()} /><Action secondary label="Back to requests" onPress={() => router.replace('/nearby')} /></Screen>;
  const row = query.data; const own = row.owner_id === session.user.id;
  return <Screen><Text style={s.caption}>{CATEGORIES.find(c => c.value === row.category)?.label}</Text><StatusBadge status={row.status} /><Text accessibilityRole="header" style={s.title}>{row.title}</Text><Text style={s.body}>{row.description}</Text><Text style={s.body}>{row.area_label} · Approximate area</Text><Text style={s.caption}>{row.status === 'accepted' || row.status === 'completed' ? 'Original request deadline' : 'Expires'} {new Date(row.expires_at).toLocaleString()}</Text>
    {row.completed_at && <Text style={s.caption}>Completed {new Date(row.completed_at).toLocaleString()}</Text>}
    {own && row.status === 'open' && <Action label="Edit request" disabled={busy} onPress={() => router.push({ pathname: '/request-editor', params: { id } })} />}
    {own && row.status === 'accepted' && <Action label={busy ? 'Please wait…' : 'Mark completed'} disabled={busy} onPress={() => Alert.alert('Mark this request completed?', 'Confirm that the task is done.', [{ text: 'Not yet', style: 'cancel' }, { text: 'Complete request', onPress: () => transition('complete_request') }])} />}
    {own && (row.status === 'open' || row.status === 'accepted') && <Action secondary label={busy ? 'Please wait…' : 'Cancel request'} disabled={busy} onPress={() => Alert.alert('Cancel this request?', 'It will no longer accept help. Existing offers will be cancelled.', [{ text: 'Keep request', style: 'cancel' }, { text: 'Cancel request', onPress: () => transition('cancel_request') }])} />}
    <OffersPanel key={id} request={row} />
    <ChatLinks requestId={id} />
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    <Action label="Refresh status" secondary onPress={() => { query.refetch(); client.invalidateQueries({ queryKey: ['offers', session.user.id, id] }); }} /><Action label="Back to requests" secondary onPress={() => router.replace('/nearby')} />
  </Screen>;
}
