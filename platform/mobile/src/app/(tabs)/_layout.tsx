import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, Home, Library, MessagesSquare, UserRound } from 'lucide-react-native';
import { useTranslations } from 'use-intl';
import { HeaderActions } from '@/components/header-actions';
import { Text } from '@/components/ui';
import { useTheme } from '@/lib/theme';

/** Five tabs, as on most phones: what's new, finding books, the community, my books, and me. */
export default function TabsLayout() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        // Bangla needs a taller line than the default tab bar allows, or the vowel signs are cut off.
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, height: 72 + insets.bottom, paddingTop: 4, paddingBottom: insets.bottom + 6 },
        tabBarLabel: ({ color, children }) => (
          <Text size="xs" weight="semibold" numberOfLines={1} style={{ color, marginTop: 2, flexShrink: 0 }}>
            {children}
          </Text>
        ),
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        headerRight: () => <HeaderActions />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home'), headerTitle: tCommon('appName'), tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="explore" options={{ title: t('explore'), tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }} />
      <Tabs.Screen name="community" options={{ title: t('community'), tabBarIcon: ({ color, size }) => <MessagesSquare color={color} size={size} /> }} />
      <Tabs.Screen name="library" options={{ title: t('library'), tabBarIcon: ({ color, size }) => <Library color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('profile'), tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />, headerRight: undefined }} />
    </Tabs>
  );
}
