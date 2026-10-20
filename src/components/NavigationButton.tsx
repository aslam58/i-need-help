import { Href, router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '../theme/tokens';

export function NavigationButton({ href, label }: { href: Href; label: string }) {
  return <Pressable accessibilityRole="button" onPress={() => router.navigate(href)}
    style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
    <Text style={styles.label}>{label}</Text>
    <Text accessible={false} style={styles.arrow}>→</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.primary, paddingVertical: 16, paddingHorizontal: 20, borderRadius: radius.control, borderWidth: 1, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  label: { flex: 1, color: colors.surface, fontSize: 17, fontWeight: '700' },
  arrow: { color: colors.surface, fontSize: 22 },
});
