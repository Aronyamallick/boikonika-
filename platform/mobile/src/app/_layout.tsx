import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { ToastProvider } from '@/components/toast';
import { AuthProvider, useAuth } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { LocaleProvider } from '@/lib/i18n';
import { openLink } from '@/lib/links';
import { ThemeProvider, useTheme } from '@/lib/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocaleProvider>
          <AuthProvider>
            <CartProvider>
              <ToastProvider>
                <Navigation />
              </ToastProvider>
            </CartProvider>
          </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Tapping a push notification opens the page it is about (its link is a website URL). */
function usePushLinks() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string') void openLink(url);
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}

function Navigation() {
  const { c, scheme } = useTheme();
  const t = useTranslations();
  const { status } = useAuth();
  usePushLinks();
  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, primary: c.primary, background: c.bg, card: c.surface, text: c.text, border: c.border, notification: c.danger } };
  return (
    <NavigationTheme value={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('nav.home') }} />
        <Stack.Screen name="search" options={{ title: t('common.search') }} />
        <Stack.Screen name="cart" options={{ title: t('cart.title') }} />
        <Stack.Screen name="checkout" options={{ title: t('checkout.title') }} />
        <Stack.Screen name="notifications" options={{ title: t('notifications.title') }} />
        <Stack.Screen name="student-zone" options={{ title: t('student.title') }} />
        <Stack.Screen name="login" options={{ title: t('nav.login'), presentation: 'modal' }} />
        <Stack.Screen name="register" options={{ title: t('nav.register'), presentation: 'modal' }} />
        <Stack.Screen name="forgot-password" options={{ title: t('auth.resetTitle'), presentation: 'modal' }} />
        <Stack.Screen name="posts/new" options={{ title: t('community.newPost'), presentation: 'modal' }} />
      </Stack>
    </NavigationTheme>
  );
}
