import { radius, spacing } from '@boikonika/shared';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { Text } from './ui';

type Tone = 'default' | 'danger';
const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => undefined);

/** Short confirmations ("Added to your cart") above the tab bar, announced to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((message: string, tone: Tone = 'default') => {
    if (!message) return;
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: spacing[4], right: spacing[4], bottom: insets.bottom + 72, alignItems: 'center' }}>
          <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ backgroundColor: toast.tone === 'danger' ? c.danger : c.text, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], maxWidth: 480 }}>
            <Text size="sm" weight="medium" style={{ color: toast.tone === 'danger' ? c.dangerFg : c.textInverse }}>
              {toast.message}
            </Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
