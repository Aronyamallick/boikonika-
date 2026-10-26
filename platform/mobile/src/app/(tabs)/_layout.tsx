import { Tabs } from 'expo-router/js-tabs';
import { Compass, Home, Library, MessagesSquare, UserRound } from 'lucide-react-native';
import { useTranslations } from 'use-intl';
import { HeaderActions } from '@/components/header-actions';
import { useTheme } from '@/lib/theme';

/** Five tabs, as on most phones: what's new, finding books, the community, my books, and me. */
export default function TabsLayout() {
  const { c } = useTheme();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
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
