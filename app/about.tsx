import * as Linking from 'expo-linking';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationButton } from '../src/components/NavigationButton';
import { Screen } from '../src/components/Screen';
import { colors, radius } from '../src/theme/tokens';

const steps = [
  { title: 'Share what you need', body: 'Describe an everyday task and your general area.' },
  { title: 'Choose a helping hand', body: 'Choose a neighbor and agree on the details.' },
  { title: 'Wrap up together', body: 'Confirm when the task is done.' },
];

export default function About() {
  return <Screen>
    <Text accessibilityRole="header" style={s.title}>Help starts here.</Text>
    <Text style={s.body}>Ask for help, choose a neighbor, and mark the task complete.</Text>
    {steps.map((step, index) => <View key={step.title} style={s.step}>
      <View style={s.number}><Text style={s.numberText}>{index + 1}</Text></View>
      <View style={s.stepContent}>
        <Text accessibilityRole="header" style={s.stepTitle}>{step.title}</Text>
        <Text style={s.body}>{step.body}</Text>
      </View>
    </View>)}
    <View style={s.note}>
      <Text accessibilityRole="header" style={s.stepTitle}>Your privacy comes first</Text>
      <Text style={s.body}>Exact GPS coordinates are not stored. Public requests show an approximate area. Keep addresses and private meeting details out of request text.</Text>
    </View>
    <NavigationButton href="/" label="Back to home" />
    <Text style={s.caption}>Development pilot · Private chat opens after acceptance. Push alerts require an installed build and device testing. Not for emergencies.</Text>
    <Text accessibilityRole="link" onPress={() => Linking.openURL('https://www.geonames.org/advanced-search.html?country=IN')} style={[s.caption, { color: colors.primary, textDecorationLine: 'underline' }]}>Area reference: GeoNames (CC BY 4.0)</Text>
  </Screen>;
}

const s = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text },
  body: { fontSize: 16, lineHeight: 24, color: colors.muted },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.surface, padding: 16, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  number: { width: 32, minHeight: 32, borderRadius: 16, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  stepContent: { flex: 1, gap: 6 },
  stepTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: colors.text },
  note: { padding: 16, borderRadius: radius.card, backgroundColor: colors.tint, gap: 8 },
  caption: { fontSize: 13, lineHeight: 20, color: colors.muted },
});
