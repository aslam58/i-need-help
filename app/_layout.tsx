import { NotificationBridge } from '../src/features/notifications/NotificationBridge';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, Text } from 'react-native';
import { RequestProviders } from '../src/features/requests/RequestProviders';
import { AuthProvider } from '../src/features/auth/AuthProvider';
import { colors } from '../src/theme/tokens';

export default function Layout() {
  const insets = useSafeAreaInsets();
  return <AuthProvider><RequestProviders>
    <NotificationBridge />
    <StatusBar style="dark" />
    <Tabs backBehavior="history" screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700', fontSize: 20 },
      headerShadowVisible: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarActiveBackgroundColor: colors.tint,
      tabBarHideOnKeyboard: true,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.primary, borderTopWidth: 2, paddingTop: 6, height: 68 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8) },
      tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
      tabBarItemStyle: { minHeight: 52, borderRadius: 12, marginHorizontal: 8, paddingVertical: 4 },
      sceneStyle: { backgroundColor: colors.background },
    }}>
      <Tabs.Screen name="index" options={{ title: 'I need help', headerTitleStyle: { fontFamily: Platform.select({ android: 'serif', ios: 'Georgia' }), fontWeight: '700', fontSize: 28, color: colors.primary }, tabBarLabel: 'Home', tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 24 }}>⌂</Text> }} />
      <Tabs.Screen name="about" options={{ title: 'How it works', href: null, tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 23 }}>ⓘ</Text> }} />
      <Tabs.Screen name="nearby" options={{ title: 'Requests', tabBarLabel: 'Nearby', tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 23 }}>⌖</Text> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarLabel: 'Account', tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontSize: 23 }}>○</Text> }} />
      <Tabs.Screen name="auth-callback" options={{ href: null, title: 'Email confirmation', tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="request-editor" options={{ href: null, title: 'Your request' }} />
      <Tabs.Screen name="request-detail" options={{ href: null, title: 'Request' }} />
      <Tabs.Screen name="blocked" options={{ href: null, title: 'Blocked neighbors' }} />
      <Tabs.Screen name="chat" options={{ href: null, title: 'Private chat' }} />
      <Tabs.Screen name="my-offers" options={{ href: null, title: 'My offers' }} />
    </Tabs>
  </RequestProviders></AuthProvider>;
}
