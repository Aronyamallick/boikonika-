import { spacing } from '@boikonika/shared';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState, type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslations } from 'use-intl';
import { useTheme } from '@/lib/theme';
import { Input } from './ui';

/** Password field with a show/hide toggle (announced to screen readers). */
export function PasswordInput(props: ComponentProps<typeof Input>) {
  const t = useTranslations('auth');
  const { c } = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <Input {...props} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} style={{ paddingRight: spacing[12] }} />
      <Pressable accessibilityRole="button" accessibilityLabel={visible ? t('hidePassword') : t('showPassword')} onPress={() => setVisible((v) => !v)} style={{ position: 'absolute', right: 0, top: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        {visible ? <EyeOff size={20} color={c.textMuted} /> : <Eye size={20} color={c.textMuted} />}
      </Pressable>
    </View>
  );
}

/** A 6-digit code field (accepts Bangla digits too; the API normalises them). */
export function CodeInput(props: ComponentProps<typeof Input>) {
  return <Input {...props} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={8} style={{ letterSpacing: 4, fontSize: 20 }} />;
}
