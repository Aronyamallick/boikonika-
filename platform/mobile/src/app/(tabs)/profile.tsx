import { radius, spacing } from '@boikonika/shared';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { Bell, BookMarked, ChevronRight, ExternalLink, FileText, GraduationCap, HelpCircle, MapPin, Package, Shield, Users, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { Chips } from '@/components/chips';
import { Avatar } from '@/components/community';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { useToast } from '@/components/toast';
import { Button, Card, Heading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';
import { useLocaleSetting } from '@/lib/i18n';
import { openLink } from '@/lib/links';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';
import { useTheme, type ThemePreference } from '@/lib/theme';

function Row({ icon: Icon, label, onPress, external }: { icon: LucideIcon; label: string; onPress: () => void; external?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 52, paddingHorizontal: spacing[4], backgroundColor: pressed ? c.bgSubtle : c.surface })}>
      <Icon size={20} color={c.textMuted} />
      <Text style={{ flex: 1 }}>{label}</Text>
      {external ? <ExternalLink size={16} color={c.textSubtle} /> : <ChevronRight size={18} color={c.textSubtle} />}
    </Pressable>
  );
}

function Group({ children }: { children: ReactNode[] }) {
  const { c } = useTheme();
  return (
    <View style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
      {children.filter(Boolean).map((child, i) => (
        <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: c.border } : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Push on this phone: off until the reader turns it on, and never asked for at launch. */
function PushSetting() {
  const t = useTranslations();
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    pushState().then(setState, () => setState('unavailable'));
  }, []);
  if (!state) return null;
  const toggle = async () => {
    setBusy(true);
    try {
      if (state === 'on') {
        await disablePush();
        setState('off');
      } else setState(await enablePush());
    } catch (error) {
      toast(errorMessage(error, t), 'danger');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ gap: spacing[2] }}>
      <Text weight="semibold">{t('mobile.pushTitle')}</Text>
      <Text size="sm" tone="muted">
        {t(`mobile.push.${state}`)}
      </Text>
      {state === 'on' || state === 'off' ? <Button small variant={state === 'on' ? 'outline' : 'primary'} title={state === 'on' ? t('notifications.turnOffHere') : t('notifications.turnOnHere')} loading={busy} onPress={toggle} style={{ alignSelf: 'flex-start' }} /> : null}
    </Card>
  );
}

export default function ProfileScreen() {
  const t = useTranslations();
  const { status, user, signOut } = useAuth();
  const { locale, setLocale } = useLocaleSetting();
  const { preference, setPreference } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const go = (href: Href) => () => router.push(href);

  return (
    <Screen>
      {status === 'authenticated' && user ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <Avatar name={user.displayName} uri={user.avatarUrl} size={56} />
          <View style={{ flex: 1 }}>
            <Heading level={2}>{user.displayName}</Heading>
            <Text size="sm" tone="muted">
              @{user.username}
            </Text>
          </View>
        </View>
      ) : status === 'anonymous' ? (
        <SignInPrompt title={t('landing.ctaTitle')} />
      ) : null}

      {status === 'authenticated' ? (
        <Group>
          {[
            <Row key="orders" icon={Package} label={t('orders.title')} onPress={go('/account/orders')} />,
            <Row key="addr" icon={MapPin} label={t('addresses.title')} onPress={go('/account/addresses')} />,
            <Row key="notif" icon={Bell} label={t('nav.notifications')} onPress={go('/notifications')} />,
            <Row key="security" icon={Shield} label={t('account.security')} onPress={() => void openLink('/account/security')} external />,
          ]}
        </Group>
      ) : null}

      <Group>
        {[
          <Row key="student" icon={GraduationCap} label={t('nav.studentZone')} onPress={go('/student-zone')} />,
          <Row key="clubs" icon={Users} label={t('nav.bookClubs')} onPress={go('/clubs')} />,
          <Row key="saved" icon={BookMarked} label={t('nav.library')} onPress={go('/library')} />,
          <Row key="help" icon={HelpCircle} label={t('nav.help')} onPress={go('/help')} />,
        ]}
      </Group>

      <View style={{ gap: spacing[3] }}>
        <Heading level={3}>{t('nav.settings')}</Heading>
        <Text size="sm" weight="semibold">
          {t('common.language')}
        </Text>
        <Chips label={t('common.language')} value={locale} onChange={setLocale} options={[{ value: 'bn', label: 'বাংলা' }, { value: 'en', label: 'English' }]} />
        <Text size="sm" weight="semibold">
          {t('common.theme')}
        </Text>
        <Chips<ThemePreference>
          label={t('common.theme')}
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'system', label: t('common.themeSystem') },
            { value: 'light', label: t('common.themeLight') },
            { value: 'dark', label: t('common.themeDark') },
          ]}
        />
        {status === 'authenticated' ? <PushSetting /> : null}
      </View>

      <Group>
        {[
          <Row key="terms" icon={FileText} label={t('nav.terms')} onPress={go('/pages/terms')} />,
          <Row key="privacy" icon={FileText} label={t('nav.privacy')} onPress={go('/pages/privacy')} />,
        ]}
      </Group>

      {status === 'authenticated' ? (
        <Button
          variant="outline"
          title={t('nav.logout')}
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            await signOut();
            setSigningOut(false);
          }}
        />
      ) : null}
      <Text size="xs" tone="subtle" style={{ textAlign: 'center' }}>
        {t('mobile.version', { version: Constants.expoConfig?.version ?? '' })} · {t('common.developedBy')}
      </Text>
    </Screen>
  );
}
