import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/tokens';
import { useArea } from './RequestProviders';
export function Action({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || pressed) && { opacity: 0.65 }]}><Text style={[s.buttonText, secondary && { color: colors.primary }]}>{label}</Text></Pressable>;
}
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[s.chip, selected && s.chipSelected]}><Text style={{ color: selected ? colors.surface : colors.primary, fontSize: 14, fontWeight: '600' }}>{label}</Text></Pressable>;
}
export function AreaPicker({ disabled = false }: { disabled?: boolean }) {
  const { area, locating, message, locate, selectManual } = useArea();
  return <View style={s.box}>
    <Text accessibilityRole="header" style={s.heading}>Your area</Text><Text style={s.body}>{area.label} · Approximate area</Text>
    <Action label={locating ? 'Finding your area…' : 'Use my location'} onPress={locate} disabled={locating || disabled} />
    <Action label="Use Puducherry centre" onPress={selectManual} secondary disabled={disabled} />
    {!!message && <Text accessibilityLiveRegion="polite" style={s.caption}>{message}</Text>}
  </View>;
}
export const s = StyleSheet.create({
  title: { fontSize: 27, lineHeight: 34, fontWeight: '800', color: colors.text }, heading: { fontSize: 18, lineHeight: 25, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, lineHeight: 24, color: colors.muted }, caption: { fontSize: 13, lineHeight: 20, color: colors.muted }, error: { fontSize: 15, lineHeight: 22, color: '#A12626' },
  box: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12 },
  button: { minHeight: 50, backgroundColor: colors.primary, borderRadius: 14, padding: 15, justifyContent: 'center' }, secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: colors.primary }, chipSelected: { backgroundColor: colors.primary },
  label: { fontSize: 15, fontWeight: '600', color: colors.text }, input: { backgroundColor: colors.surface, minHeight: 52, padding: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 14, color: colors.text, fontSize: 16 },
});
