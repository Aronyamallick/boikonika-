import { radius, spacing } from '@boikonika/shared';
import { Pressable, ScrollView } from 'react-native';
import { useTheme } from '@/lib/theme';
import { Text } from './ui';

/** A row of single-choice filter chips (feed tabs, shelves, sort orders). */
export function Chips<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label} contentContainerStyle={{ gap: spacing[2] }} style={{ flexGrow: 0 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing[4], borderRadius: radius.full, borderWidth: 1, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary : c.surface }}
          >
            <Text size="sm" weight="semibold" style={{ color: active ? c.primaryFg : c.text }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
