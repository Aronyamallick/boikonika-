import { localizeDigits, spacing } from '@boikonika/shared';
import { router, useFocusEffect } from 'expo-router';
import { Bell, ShoppingCart } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useLocale, useTranslations } from 'use-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { useTheme } from '@/lib/theme';
import { Text } from './ui';

function IconButton({ label, onPress, count, children }: { label: string; onPress: () => void; count?: number; children: ReactNode }) {
  const { c } = useTheme();
  const locale = useLocale();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      {children}
      {count ? (
        <View style={{ position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Text size="xs" weight="bold" style={{ color: c.dangerFg, fontSize: 11, lineHeight: 14 }}>
            {count > 99 ? '99+' : localizeDigits(count, locale)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Notifications and cart in the header, with counts in the labels so screen readers hear them too. */
export function HeaderActions() {
  const { c } = useTheme();
  const t = useTranslations();
  const { status } = useAuth();
  const { count } = useCart();
  const [unread, setUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticated') return setUnread(0);
      api<{ unread: number }>('/me/notifications/unread-count').then((r) => setUnread(r.unread), () => undefined);
    }, [status]),
  );
  return (
    <View style={{ flexDirection: 'row', marginRight: spacing[2] }}>
      {status === 'authenticated' ? (
        <IconButton label={unread ? t('notifications.bellUnread', { count: unread }) : t('notifications.bell')} count={unread} onPress={() => router.push('/notifications')}>
          <Bell size={22} color={c.text} />
        </IconButton>
      ) : null}
      <IconButton label={`${t('nav.cart')}${count ? `, ${t('common.items', { count })}` : ''}`} count={count} onPress={() => router.push('/cart')}>
        <ShoppingCart size={22} color={c.text} />
      </IconButton>
    </View>
  );
}
