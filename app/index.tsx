import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import { NavigationButton } from '../src/components/NavigationButton';
import { colors, radius } from '../src/theme/tokens';

export default function Home() {
  return <Screen>
    <View style={s.intro}>
      <Text accessibilityRole="header" style={s.title}>Hi, neighbor.</Text>
      <Text style={s.body}>A little help can make someone’s day.</Text>
    </View>
    <View style={s.status}>
      <Text style={s.statusTitle}>Demo preview</Text>
      <Text style={s.caption}>Puducherry pilot · Everyday volunteer help.</Text>
    </View>
    <Text accessibilityRole="header" style={s.section}>How can we help?</Text>
    <View style={[s.card, s.request]}>
      <View style={s.cardHeader}><Text style={s.symbol} accessible={false}>＋</Text><Text style={s.badge}>PUDUCHERRY PILOT</Text></View>
      <Text accessibilityRole="header" style={s.cardTitle}>I need a hand</Text>
      <Text style={s.body}>A small task is easier with a helping hand.</Text>
      <NavigationButton href="/request-editor" label="Ask for help" />
    </View>
    <View style={[s.card, s.offer]}>
      <View style={s.cardHeader}><Text style={s.symbol} accessible={false}>♡</Text><Text style={s.badge}>PUDUCHERRY PILOT</Text></View>
      <Text accessibilityRole="header" style={s.cardTitle}>I can lend a hand</Text>
      <Text style={s.body}>See what neighbors need and offer a helping hand.</Text>
      <NavigationButton href="/nearby" label="Browse nearby requests" />
    </View>
    <NavigationButton href="/about" label="How it works" />
    <Text style={s.caption}>Everyday help, freely given.</Text>
  </Screen>;
}

const s = StyleSheet.create({
  intro: { gap: 8, paddingTop: 4, paddingBottom: 4 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text },
  body: { fontSize: 16, lineHeight: 24, color: colors.muted },
  caption: { fontSize: 13, lineHeight: 20, color: colors.muted },
  status: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 12, gap: 4 },
  statusTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  section: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: colors.text, marginTop: 8 },
  card: { borderRadius: radius.card, padding: 20, gap: 8, borderWidth: 1, borderColor: colors.border },
  request: { backgroundColor: colors.tint },
  offer: { backgroundColor: colors.surface },
  cardHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  symbol: { fontSize: 28, color: colors.primary },
  badge: { fontSize: 10, letterSpacing: 1, fontWeight: '700', color: colors.muted },
  cardTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.text },
});
