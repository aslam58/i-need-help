import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { HelpRequest } from '../requests/location';
import { Action, s } from '../requests/ui';
import { StatusBadge } from '../requests/StatusBadge';
import { Offer } from './types';

export function OffersPanel({ request }: { request: HelpRequest }) {
  const { session } = useAuth(); const client = useQueryClient();
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const own = session?.user.id === request.owner_id;
  const offers = useQuery({ queryKey: ['offers', session?.user.id, request.id], enabled: !!session, queryFn: async () => {
    if (!supabase) throw new Error('Not configured'); const { data, error } = await supabase.from('offer_feed').select('*').eq('request_id', request.id).order('created_at', { ascending: true });
    if (error) throw error; return data as Offer[];
  }, refetchInterval: 15000 });
  const mine = offers.data?.find(o => o.helper_id === session?.user.id);
  async function act(name: 'submit_offer' | 'accept_offer' | 'withdraw_offer', offerId?: string) {
    if (!supabase || busy) return;
    if (name === 'submit_offer' && message.trim().length < 5) { setError('Add a short message of at least 5 characters.'); return; }
    setBusy(true); setError('');
    try {
      const args = name === 'submit_offer' ? { target_request: request.id, offer_message: message.trim() } : { target_offer: offerId };
      const { error } = await supabase.rpc(name, args); if (error) throw error;
      setMessage('');
      await Promise.all(['offers','my-offers','requests','my-requests','request','chats'].map(key => client.invalidateQueries({ queryKey: [key] })));
    } catch (e) { setError(e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Could not update the offer. Refresh and retry.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 14 }}>
    <Text accessibilityRole="header" style={s.heading}>{own ? 'Offers from neighbors' : 'Your offer'}</Text>
    {offers.isPending ? <Text style={s.body}>Loading offers…</Text> : offers.isError ? <><Text style={s.error}>Could not load offers.</Text><Action label="Retry offers" secondary onPress={() => offers.refetch()} /></> : own ? <>
      {!offers.data?.length && <Text style={s.body}>No offers yet. Check back when a neighbor offers a hand.</Text>}
      {offers.data?.map(offer => <View key={offer.id} style={s.box}>
        <Text style={s.heading}>{offer.helper_name}</Text><StatusBadge status={offer.status} /><Text style={s.body}>{offer.message}</Text>
        {request.status === 'open' && offer.status === 'pending' && <Action label={busy ? 'Please wait…' : 'Accept this helper'} disabled={busy} onPress={() => Alert.alert('Choose this helper?', 'Only one helper can be accepted. Other pending offers will be declined.', [{ text: 'Not now', style: 'cancel' }, { text: 'Accept helper', onPress: () => act('accept_offer', offer.id) }])} />}
      </View>)}
    </> : <>
      {mine && <View style={s.box}><StatusBadge status={mine.status} /><Text style={s.body}>{mine.message}</Text>
        {(mine.status === 'pending' || mine.status === 'accepted') && <Action label={busy ? 'Please wait…' : mine.status === 'accepted' ? 'Withdraw from helping' : 'Withdraw offer'} secondary disabled={busy} onPress={() => Alert.alert('Withdraw your offer?', mine.status === 'accepted' ? 'The request will reopen if its deadline has not passed.' : 'The requester will no longer be able to accept this offer.', [{ text: 'Keep offer', style: 'cancel' }, { text: 'Withdraw', onPress: () => act('withdraw_offer', mine.id) }])} />}
        {mine.status === 'accepted' && <Text style={s.caption}>You’ve been selected. The requester will mark the task complete. Open private chat below to coordinate.</Text>}
      </View>}
      {request.status === 'open' && (!mine || ['withdrawn','declined'].includes(mine.status)) && <>
        <Text style={s.body}>How can you help?</Text><TextInput accessibilityLabel="Offer message" style={[s.input, { minHeight: 110, textAlignVertical: 'top' }]} multiline value={message} onChangeText={setMessage} maxLength={500} editable={!busy} placeholder="I can lend a hand this afternoon." />
        <Text style={s.caption}>Your profile name and message will be shared with the requester. Keep exact addresses and private meeting details out of the message for now.</Text>
        <Action label={busy ? 'Sending…' : 'Offer a hand'} disabled={busy || offers.isError || offers.isPending} onPress={() => act('submit_offer')} />
      </>}
      {!mine && request.status !== 'open' && <Text style={s.body}>This request is no longer accepting offers.</Text>}
    </>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>;
}
