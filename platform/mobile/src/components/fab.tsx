import { radius, spacing } from '@boikonika/shared';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useTheme } from '@/lib/theme';
import { Text } from './ui';

/** The one main action of a screen (e.g. "New post"), floating above the list. */
export function Fab({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: spacing[4],
        bottom: spacing[4],
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        paddingHorizontal: spacing[5],
        borderRadius: radius.full,
        backgroundColor: c.primary,
        opacity: pressed ? 0.85 : 1,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      })}
    >
      <Icon size={20} color={c.primaryFg} />
      <Text weight="semibold" style={{ color: c.primaryFg }}>
        {label}
      </Text>
    </Pressable>
  );
}
