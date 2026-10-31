import { radius, spacing, typography } from '@boikonika/shared';
import { AlertCircle, BookOpen, CloudOff, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import { useTheme } from '@/lib/theme';

type Size = keyof typeof typography.fontSize;
type Tone = 'default' | 'muted' | 'subtle' | 'primary' | 'danger' | 'success' | 'inverse';

/** Text in the token type scale. Bangla needs the taller line heights the tokens carry. */
export function Text({ size = 'base', weight = 'regular', tone = 'default', style, ...props }: TextProps & { size?: Size; weight?: keyof typeof typography.fontWeight; tone?: Tone }) {
  const { c } = useTheme();
  const color = { default: c.text, muted: c.textMuted, subtle: c.textSubtle, primary: c.primary, danger: c.danger, success: c.successText, inverse: c.textInverse }[tone];
  const { size: fontSize, lineHeight } = typography.fontSize[size];
  return <RNText {...props} style={[{ color, fontSize, lineHeight, fontWeight: String(typography.fontWeight[weight]) as TextStyle['fontWeight'] }, style]} />;
}

export function Heading({ level = 2, children, style }: { level?: 1 | 2 | 3; children: ReactNode; style?: StyleProp<TextStyle> }) {
  const size: Size = level === 1 ? '2xl' : level === 2 ? 'xl' : 'lg';
  return (
    <Text accessibilityRole="header" size={size} weight="bold" style={style}>
      {children}
    </Text>
  );
}

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
export function Button({ title, variant = 'primary', loading, icon: Icon, style, disabled, small, ...props }: PressableProps & { title: string; variant?: Variant; loading?: boolean; icon?: LucideIcon; small?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const palette = {
    primary: { bg: c.primary, fg: c.primaryFg, border: c.primary },
    secondary: { bg: c.secondary, fg: c.secondaryFg, border: c.secondary },
    accent: { bg: c.accent, fg: c.accentFg, border: c.accent },
    danger: { bg: c.danger, fg: c.dangerFg, border: c.danger },
    outline: { bg: c.surface, fg: c.text, border: c.borderInput },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
  }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      style={({ pressed }) => [
        {
          minHeight: small ? 40 : 48,
          paddingHorizontal: small ? spacing[3] : spacing[5],
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[2],
          opacity: off ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : Icon ? <Icon size={18} color={palette.fg} /> : null}
      <Text weight="semibold" size={small ? 'sm' : 'base'} style={{ color: palette.fg }}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const { c } = useTheme();
  const base: ViewStyle = { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing[4] };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

/** A scrolling screen body with the safe-area bottom inset and optional pull-to-refresh. */
export function Screen({ children, refreshing, onRefresh, padded = true, style, ...props }: ScrollViewProps & { refreshing?: boolean; onRefresh?: () => void; padded?: boolean; children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ padding: padded ? spacing[4] : 0, paddingBottom: insets.bottom + spacing[8], gap: spacing[4] }, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} /> : undefined}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function Input({ invalid, style, multiline, ...props }: TextInputProps & { invalid?: boolean }) {
  const { c } = useTheme();
  return (
    <TextInput
      placeholderTextColor={c.textSubtle}
      multiline={multiline}
      style={[
        {
          minHeight: multiline ? 112 : 48,
          borderWidth: 1,
          borderColor: invalid ? c.danger : c.borderInput,
          borderRadius: radius.md,
          backgroundColor: c.surface,
          color: c.text,
          paddingHorizontal: spacing[3],
          paddingVertical: multiline ? spacing[3] : 0,
          fontSize: typography.fontSize.base.size,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
      {...props}
    />
  );
}

/** Label + control + hint/error, with the label and error announced for the control. */
export function Field({ label, hint, error, required, children }: { label: string; hint?: string; error?: string; required?: boolean; children: (a11y: { accessibilityLabel: string; accessibilityHint?: string; invalid: boolean }) => ReactNode }) {
  return (
    <View style={{ gap: spacing[1] }}>
      <Text weight="semibold" size="sm">
        {label}
        {required ? <Text tone="danger"> *</Text> : null}
      </Text>
      {children({ accessibilityLabel: label, accessibilityHint: error ?? hint, invalid: !!error })}
      {error ? (
        <Text size="sm" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text size="sm" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' }) {
  const { c } = useTheme();
  const map = {
    neutral: [c.bgSubtle, c.textMuted],
    primary: [c.primarySoft, c.primarySoftFg],
    secondary: [c.secondarySoft, c.secondarySoftFg],
    accent: [c.accentSoft, c.accentSoftFg],
    success: [c.successSoft, c.successSoftFg],
    warning: [c.warningSoft, c.warningSoftFg],
    danger: [c.dangerSoft, c.dangerSoftFg],
  }[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: map[0], borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2 }}>
      <Text size="xs" weight="semibold" style={{ color: map[1] }}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({ title, text, icon: Icon = BookOpen, action }: { title: string; text?: string; icon?: LucideIcon; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: spacing[8], gap: spacing[2], borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, borderRadius: radius.lg }}>
      <View style={{ backgroundColor: c.primarySoft, borderRadius: radius.full, padding: spacing[3] }}>
        <Icon size={24} color={c.primarySoftFg} />
      </View>
      <Text weight="semibold" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {text ? (
        <Text size="sm" tone="muted" style={{ textAlign: 'center' }}>
          {text}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

/** For a failed load: says whether it's the connection, and offers to try again. */
export function ErrorState({ offline, onRetry }: { offline?: boolean; onRetry?: () => void }) {
  const t = useTranslations();
  return (
    <EmptyState
      icon={offline ? CloudOff : AlertCircle}
      title={offline ? t('common.offlineTitle') : t('errors.generic')}
      text={offline ? t('common.offlineText') : undefined}
      action={onRetry ? <Button title={t('common.retry')} variant="outline" small onPress={onRetry} /> : undefined}
    />
  );
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: ViewStyle['width']; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ height, width, backgroundColor: c.skeleton, borderRadius: radius.sm }, style]} />;
}

export function Loading() {
  const { c } = useTheme();
  const t = useTranslations('common');
  return (
    <View style={{ padding: spacing[10], alignItems: 'center' }} accessibilityLabel={t('loading')}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

/** A thin notice shown when a screen is showing its saved copy because the phone is offline. */
export function OfflineNotice() {
  const { c } = useTheme();
  const t = useTranslations('mobile');
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: c.warningSoft, borderRadius: radius.md, padding: spacing[3] }}>
      <CloudOff size={16} color={c.warningSoftFg} />
      <Text size="sm" style={{ color: c.warningSoftFg, flex: 1 }}>
        {t('showingSaved')}
      </Text>
    </View>
  );
}
