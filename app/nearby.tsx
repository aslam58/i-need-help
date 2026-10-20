import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuth } from '../src/features/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { StatusBadge } from '../src/features/requests/StatusBadge';
import { CATEGORIES, Category, HelpRequest } from '../src/features/requests/location';
import { useArea } from '../src/features/requests/RequestProviders';
import { Action, AreaPicker, Chip, s } from '../src/features/requests/ui';
import { colors } from '../src/theme/tokens';

export default function Nearby() {
  const { session } = useAuth(); const { area } = useArea();
  const [mode, setMode] = useState<'nearby' | 'mine'>('nearby');
  const [category, setCategory] = useState<Category | null>(null);
  const [radius, setRadius] = useState(5);
  const nearby = useInfiniteQuery({ queryKey: ['requests', session?.user.id, area.latitude, area.longitude, radius, category], enabled: !!session && mode === 'nearby', initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!supabase) throw new Error('Not configured');
      const { data, error } = await supabase.rpc('nearby_requests', { search_lat: area.latitude, search_lon: area.longitude, radius_km: radius, filter_category: category, page_offset: pageParam });
      if (error) throw error; return data as HelpRequest[];
    }, getNextPageParam: (lastPage, pages) => lastPage.length === 20 && pages.length < 500 ? pages.length * 20 : undefined, refetchInterval: 30000 });
  const mine = useQuery({ queryKey: ['my-requests', session?.user.id], enabled: !!session && mode === 'mine', queryFn: async () => {
    if (!supabase || !session) throw new Error('Sign in first');
    const { data, error } = await supabase.from('request_feed').select('*').eq('owner_id', session.user.id).order('created_at', { ascending: false });
    if (error) throw error; return data as HelpRequest[];
  }, refetchInterval: 30000 });
  const query = mode === 'nearby' ? nearby : mine;
  const rows = mode === 'nearby' ? nearby.data?.pages.flat() ?? [] : (mine.data ?? []).filter(row => !category || row.category === category);
  return <SafeAreaView edges={['left','right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <FlatList style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 32 }} data={session ? rows : []} keyExtractor={row => row.id}
      refreshing={!!session && query.isRefetching} onRefresh={() => { if (session) query.refetch(); }}
      ListHeaderComponent={<View style={{ gap: 16, paddingBottom: 16 }}>
        <Text accessibilityRole="header" style={s.title}>A little help nearby.</Text>
        <View style={s.chips}><Chip label="Nearby" selected={mode === 'nearby'} onPress={() => setMode('nearby')} /><Chip label="My offers" selected={false} onPress={() => router.push('/my-offers')} /><Chip label="My requests" selected={mode === 'mine'} onPress={() => setMode('mine')} /></View>
        {mode === 'nearby' && <><AreaPicker /><Text style={s.label}>Search radius · approximate distances</Text><View style={s.chips}>{[2,5,10,25].map(km => <Chip key={km} label={`${km} km`} selected={radius === km} onPress={() => setRadius(km)} />)}</View></>}
        <View style={s.chips}><Chip label="All" selected={!category} onPress={() => setCategory(null)} />{CATEGORIES.map(c => <Chip key={c.value} label={c.label} selected={category === c.value} onPress={() => setCategory(c.value)} />)}</View>
        <Action label={session ? 'Ask for a hand' : 'Sign in to see requests'} onPress={() => router.push(session ? '/request-editor' : '/account')} />
        {session && query.isPending && <ActivityIndicator color={colors.primary} />}
        {session && query.isError && <><Text accessibilityRole="alert" style={s.error}>Could not load requests. Check your connection and retry.</Text><Action secondary label="Retry" onPress={() => query.refetch()} /></>}
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.status}`} onPress={() => router.push({ pathname: '/request-detail', params: { id: item.id } })} style={({ pressed }) => [s.box, pressed && { opacity: 0.7 }]}>
        <Text style={s.caption}>{CATEGORIES.find(c => c.value === item.category)?.label}</Text><StatusBadge status={item.status} /><Text style={s.heading}>{item.title}</Text><Text style={s.body}>{item.area_label}{item.distance_km !== undefined ? item.distance_km === 0 ? ' · Same approximate area' : ` · about ${item.distance_km} km` : ''}</Text><Text style={s.caption}>{item.owner_id === session?.user.id ? 'Your request · ' : ''}View request →</Text>
      </Pressable>}
      ListEmptyComponent={session && !query.isPending && !query.isError ? <View style={s.box}><Text style={s.heading}>{mode === 'mine' ? 'No requests yet.' : 'No open requests here yet.'}</Text><Text style={s.body}>{mode === 'mine' ? 'Your saved requests will appear here.' : 'Try another radius or category, or post the first request.'}</Text></View> : null}
      ListFooterComponent={session && mode === 'nearby' && nearby.hasNextPage ? <Action label={nearby.isFetchingNextPage ? 'Loading…' : 'Load more'} disabled={nearby.isFetchingNextPage} onPress={() => nearby.fetchNextPage()} secondary /> : null}
    />
  </SafeAreaView>;
}
