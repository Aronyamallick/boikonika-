import { spacing } from '@boikonika/shared';
import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View, type FlatListProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

/** A screen-filling list with pull-to-refresh, load-more on scroll and the screen's background. */
export function List<T>({ refreshing, onRefresh, loadingMore, onEndReached, header, empty, gap = spacing[3], ...props }: Omit<FlatListProps<T>, 'ListHeaderComponent' | 'ListEmptyComponent'> & { refreshing?: boolean; onRefresh?: () => void; loadingMore?: boolean; header?: ReactElement | null; empty?: ReactElement | null; gap?: number }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: spacing[4], paddingBottom: insets.bottom + spacing[16], gap }}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} /> : undefined}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={header ? <View style={{ gap }}>{header}</View> : undefined}
      ListEmptyComponent={empty ?? undefined}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={c.primary} style={{ padding: spacing[4] }} /> : undefined}
      keyboardShouldPersistTaps="handled"
      {...props}
    />
  );
}
