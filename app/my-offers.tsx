import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../src/features/auth/AuthProvider';
import { supabase } from '../src/lib/supabase';
import { Offer } from '../src/features/offers/types';
import { StatusBadge } from '../src/features/requests/StatusBadge';
import { Action, s } from '../src/features/requests/ui';
import { colors } from '../src/theme/tokens';
export default function MyOffers() {
 const { session } = useAuth();
 const query = useQuery({ queryKey: ['my-offers', session?.user.id], enabled: !!session, queryFn: async () => {
  if (!supabase || !session) throw new Error('Sign in first');
  const { data, error } = await supabase.from('offer_feed').select('*').eq('helper_id',session.user.id).order('created_at',{ascending:false});
  if (error) throw error; return data as Offer[];
 }, refetchInterval:15000 });
 return <SafeAreaView edges={['left','right']} style={{flex:1,backgroundColor:colors.background}}><FlatList style={{width:'100%',maxWidth:560,alignSelf:'center'}} contentContainerStyle={{padding:20,gap:14,paddingBottom:32}} data={session ? query.data ?? [] : []} keyExtractor={o=>o.id} refreshing={!!session&&query.isRefetching} onRefresh={()=>{if(session)query.refetch();}}
  ListHeaderComponent={<View style={{gap:14,paddingBottom:12}}><Text accessibilityRole="header" style={s.title}>The hands you’ve offered.</Text><Action secondary label="Back to requests" onPress={()=>router.replace('/nearby')} />{!session&&<Action label="Sign in to see offers" onPress={()=>router.push('/account')} />}{session&&query.isPending&&<ActivityIndicator color={colors.primary} />}{query.isError&&<><Text style={s.error}>Could not load your offers.</Text><Action label="Retry" onPress={()=>query.refetch()} /></>}</View>}
  renderItem={({item})=><Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/request-detail',params:{id:item.request_id}})} style={s.box}><Text style={s.heading}>{item.request_title}</Text><StatusBadge status={item.status} /><Text style={s.body}>{item.message}</Text><Text style={s.caption}>View request →</Text></Pressable>}
  ListEmptyComponent={session&&!query.isPending&&!query.isError?<View style={s.box}><Text style={s.body}>Your offers and their current status will appear here.</Text></View>:null}
 /></SafeAreaView>;
}
